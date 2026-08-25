import { AIProvider } from '../ai/AIProvider.js';
import { Character, GlossaryEntry, SubtitleEntry, TranslationCorrection, TranslationStyle } from '../../types/subtitle.js';
import { buildContextWindow } from '../translation/contextBuilder.js';
import { PROOFREAD_SYSTEM_PROMPT, buildProofreadUserPrompt } from '../translation/promptTemplates.js';
import { parseProofreadResponse } from '../translation/jsonSchema.js';

export interface ProofreadOptions {
  glossary: GlossaryEntry[];
  characters: Character[];
  style: TranslationStyle;
  contextBefore?: number;
  contextAfter?: number;
  batchSize?: number;
}

export interface ProofreadResult {
  subtitles: SubtitleEntry[]; // .translation đã cập nhật nếu có sửa
  corrections: TranslationCorrection[]; // chỉ những dòng thực sự bị sửa (changed=true)
}

const MAX_REPAIR_ATTEMPTS = 2;
const DEFAULT_BATCH_SIZE = 20;

/**
 * Chạy QA/biên tập bằng AI (mục 13). Có thể gọi cho toàn bộ video
 * ("chạy tự động sau khi dịch") hoặc cho một nhóm dòng cụ thể
 * (nút "✨ Cải thiện bản dịch" người dùng bấm thủ công).
 */
export class ProofreadService {
  constructor(private readonly ai: AIProvider) {}

  async proofread(
    allSubtitles: SubtitleEntry[],
    targetIds: number[] | 'all',
    options: ProofreadOptions
  ): Promise<ProofreadResult> {
    const { glossary, characters, style, contextBefore = 5, contextAfter = 5, batchSize = DEFAULT_BATCH_SIZE } = options;

    const result = allSubtitles.map((s) => ({ ...s }));
    const corrections: TranslationCorrection[] = [];

    const targetIndexes =
      targetIds === 'all'
        ? result.map((_, i) => i)
        : result.reduce<number[]>((acc, s, i) => (targetIds.includes(s.id) ? [...acc, i] : acc), []);

    for (let i = 0; i < targetIndexes.length; i += batchSize) {
      const indexBatch = targetIndexes.slice(i, i + batchSize);
      const batchStart = indexBatch[0];
      const batchEnd = indexBatch[indexBatch.length - 1] + 1;

      const window = buildContextWindow(result, batchStart, batchEnd, contextBefore, contextAfter);
      const currentBatch = indexBatch.map((idx) => result[idx]);

      const userPrompt = buildProofreadUserPrompt({
        prevContext: window.prevContext,
        currentBatch,
        nextContext: window.nextContext,
        characters,
        glossary,
        style,
      });

      let raw = await this.ai.chatCompletion(
        [
          { role: 'system', content: PROOFREAD_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { forceJson: true, temperature: 0.2 }
      );

      let parsed = parseProofreadResponse(raw);
      let attempts = 0;
      while (!parsed.ok && attempts < MAX_REPAIR_ATTEMPTS) {
        raw = await this.ai.chatCompletion(
          [
            { role: 'system', content: 'Bạn là công cụ sửa lỗi JSON. Chỉ trả về JSON hợp lệ.' },
            { role: 'user', content: `JSON lỗi (${parsed.error}):\n${raw}\n\nSửa lại đúng schema và chỉ trả JSON.` },
          ],
          { forceJson: true, temperature: 0 }
        );
        parsed = parseProofreadResponse(raw);
        attempts++;
      }

      if (!parsed.ok) continue; // không áp dụng thay đổi nếu không validate được (mục 12)

      const validIds = new Set(currentBatch.map((s) => s.id));
      for (const item of parsed.data.translations) {
        if (!validIds.has(item.id)) continue;
        const target = result.find((s) => s.id === item.id);
        if (!target) continue;
        if (item.changed) {
          target.translation = item.translation;
          corrections.push({ id: item.id, translation: item.translation, changed: true, reason: item.reason });
        }
      }
    }

    return { subtitles: result, corrections };
  }
}
