import { AIProvider } from '../ai/AIProvider.js';
import { CacheStore, buildCacheKey } from '../cache/cacheService.js';
import { Character, GlossaryEntry, SubtitleEntry, TranslationStyle } from '../../types/subtitle.js';
import { buildChunks, buildContextWindow } from './contextBuilder.js';
import { TRANSLATION_SYSTEM_PROMPT, buildTranslationUserPrompt } from './promptTemplates.js';
import { parseTranslationResponse } from './jsonSchema.js';

export interface TranslateOptions {
  glossary: GlossaryEntry[];
  characters: Character[];
  style: TranslationStyle;
  contextBefore?: number;
  contextAfter?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  /** Batch size trong mỗi lần gọi AI (số dòng dịch mới mỗi request). */
  batchSize?: number;
  /** Callback để báo tiến trình (mục 22 của spec) — vd để đẩy qua WebSocket/SSE. */
  onProgress?: (done: number, total: number) => void;
  /** Nếu đã dịch dở (retry sau lỗi), bắt đầu từ index này thay vì 0. */
  resumeFromIndex?: number;
}

export interface TranslateResult {
  subtitles: SubtitleEntry[]; // đã điền .translation
  failedIds: number[]; // các id không dịch được sau khi hết retry
}

const DEFAULT_BATCH_SIZE = 20;
const MAX_REPAIR_ATTEMPTS = 2;

export class TranslationService {
  constructor(
    private readonly ai: AIProvider,
    private readonly cache?: CacheStore
  ) {}

  async translate(allSubtitles: SubtitleEntry[], options: TranslateOptions): Promise<TranslateResult> {
    const {
      glossary,
      characters,
      style,
      contextBefore = 5,
      contextAfter = 5,
      chunkSize = 100,
      chunkOverlap = 5,
      batchSize = DEFAULT_BATCH_SIZE,
      onProgress,
      resumeFromIndex = 0,
    } = options;

    const result: SubtitleEntry[] = allSubtitles.map((s) => ({ ...s }));
    const failedIds: number[] = [];
    const total = allSubtitles.length;
    let done = Math.min(resumeFromIndex, total);

    const chunks = buildChunks(total, chunkSize, chunkOverlap);

    for (const chunk of chunks) {
      // Bỏ qua toàn bộ chunk nếu vùng "new" của nó đã nằm trước điểm resume
      if (chunk.newEndIndex <= resumeFromIndex) continue;

      const effectiveNewStart = Math.max(chunk.newStartIndex, resumeFromIndex);

      for (let batchStart = effectiveNewStart; batchStart < chunk.newEndIndex; batchStart += batchSize) {
        const batchEnd = Math.min(chunk.newEndIndex, batchStart + batchSize);
        const window = buildContextWindow(result, batchStart, batchEnd, contextBefore, contextAfter);

        const idsInBatch = window.currentBatch.map((s) => s.id);

        try {
          const translations = await this.translateBatch(window.prevContext, window.currentBatch, window.nextContext, {
            glossary,
            characters,
            style,
          });

          for (const t of translations) {
            const target = result.find((s) => s.id === t.id);
            if (target && idsInBatch.includes(t.id)) {
              target.translation = t.translation;
            }
          }

          const missingIds = idsInBatch.filter((id) => !translations.some((t) => t.id === id));
          failedIds.push(...missingIds);
        } catch (err) {
          failedIds.push(...idsInBatch);
        }

        done = batchEnd;
        onProgress?.(done, total);
      }
    }

    return { subtitles: result, failedIds: Array.from(new Set(failedIds)) };
  }

  /** Dịch lại riêng các subtitle bị lỗi trước đó (không dịch lại toàn bộ — mục 21). */
  async retryFailed(
    allSubtitles: SubtitleEntry[],
    failedIds: number[],
    options: TranslateOptions
  ): Promise<TranslateResult> {
    const idSet = new Set(failedIds);
    const result: SubtitleEntry[] = allSubtitles.map((s) => ({ ...s }));
    const stillFailed: number[] = [];

    for (const id of failedIds) {
      const index = allSubtitles.findIndex((s) => s.id === id);
      if (index === -1) continue;
      const window = buildContextWindow(
        result,
        index,
        index + 1,
        options.contextBefore ?? 5,
        options.contextAfter ?? 5
      );
      try {
        const translations = await this.translateBatch(window.prevContext, window.currentBatch, window.nextContext, {
          glossary: options.glossary,
          characters: options.characters,
          style: options.style,
        });
        const t = translations.find((x) => x.id === id);
        if (t) {
          result[index].translation = t.translation;
        } else {
          stillFailed.push(id);
        }
      } catch {
        stillFailed.push(id);
      }
    }

    return { subtitles: result, failedIds: stillFailed.filter((id) => idSet.has(id)) };
  }

  private async translateBatch(
    prevContext: SubtitleEntry[],
    currentBatch: SubtitleEntry[],
    nextContext: SubtitleEntry[],
    ctx: { glossary: GlossaryEntry[]; characters: Character[]; style: TranslationStyle }
  ): Promise<Array<{ id: number; translation: string }>> {
    // Kiểm tra cache cho từng dòng riêng lẻ trước, chỉ gửi AI những dòng chưa có cache
    const cached: Array<{ id: number; translation: string }> = [];
    const toTranslate: SubtitleEntry[] = [];

    for (const s of currentBatch) {
      const key = this.cache
        ? buildCacheKey({
            original: s.original,
            prevContext,
            nextContext,
            glossary: ctx.glossary,
            style: ctx.style,
            model: this.ai.modelName,
          })
        : undefined;
      const hit = key ? this.cache?.get(key) : undefined;
      if (hit !== undefined) {
        cached.push({ id: s.id, translation: hit });
      } else {
        toTranslate.push(s);
      }
    }

    if (toTranslate.length === 0) return cached;

    const userPrompt = buildTranslationUserPrompt({
      prevContext,
      currentBatch: toTranslate,
      nextContext,
      characters: ctx.characters,
      glossary: ctx.glossary,
      style: ctx.style,
    });

    const raw = await this.ai.chatCompletion(
      [
        { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { forceJson: true, temperature: 0.3 }
    );

    let parsed = parseTranslationResponse(raw);

    let repairAttempts = 0;
    let lastRaw = raw;
    while (!parsed.ok && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      lastRaw = await this.repairJson(lastRaw, parsed.error);
      parsed = parseTranslationResponse(lastRaw);
      repairAttempts++;
    }

    if (!parsed.ok) {
      // Không lưu response chưa validate được (mục 12) — báo lỗi để caller đánh dấu failed
      throw new Error(`Không thể validate JSON sau ${MAX_REPAIR_ATTEMPTS} lần repair: ${parsed.error}`);
    }

    // Chỉ chấp nhận id nằm trong batch đã gửi đi — không cho phép AI tự thêm/đổi id
    const validIds = new Set(toTranslate.map((s) => s.id));
    const accepted = parsed.data.translations.filter((t) => validIds.has(t.id));

    // Ghi cache cho các dòng dịch thành công
    if (this.cache) {
      for (const t of accepted) {
        const subtitle = toTranslate.find((s) => s.id === t.id);
        if (!subtitle) continue;
        const key = buildCacheKey({
          original: subtitle.original,
          prevContext,
          nextContext,
          glossary: ctx.glossary,
          style: ctx.style,
          model: this.ai.modelName,
        });
        this.cache.set(key, t.translation);
      }
    }

    return [...cached, ...accepted];
  }

  private async repairJson(brokenRaw: string, error: string): Promise<string> {
    const repairPrompt = `Response JSON sau đây bị lỗi: "${error}".

Response gốc:
${brokenRaw}

Hãy sửa lại thành JSON hợp lệ đúng schema {"translations":[{"id":number,"translation":string}]}. Chỉ trả về JSON, không giải thích.`;

    return this.ai.chatCompletion(
      [
        { role: 'system', content: 'Bạn là công cụ sửa lỗi JSON. Chỉ trả về JSON hợp lệ.' },
        { role: 'user', content: repairPrompt },
      ],
      { forceJson: true, temperature: 0 }
    );
  }
}
