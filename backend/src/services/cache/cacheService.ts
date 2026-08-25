import { createHash } from 'node:crypto';
import { GlossaryEntry, SubtitleEntry, TranslationStyle } from '../../types/subtitle.js';

export interface CacheKeyInput {
  original: string;
  prevContext: SubtitleEntry[];
  nextContext: SubtitleEntry[];
  glossary: GlossaryEntry[];
  style: TranslationStyle;
  model: string;
}

export function buildCacheKey(input: CacheKeyInput): string {
  const contextText = (arr: SubtitleEntry[]) => arr.map((s) => s.original).join('|');
  const glossaryText = input.glossary.map((g) => `${g.term}=${g.translation}`).join(',');

  const raw = [
    input.original,
    contextText(input.prevContext),
    contextText(input.nextContext),
    glossaryText,
    input.style,
    input.model,
  ].join('::');

  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Cache trong bộ nhớ đơn giản cho module lõi này. Trong hệ thống đầy đủ,
 * đây là nơi cắm một backend cache bền vững hơn (SQLite/Postgres/Redis)
 * mà không cần đổi interface — chỉ cần implement lại CacheStore.
 */
export interface CacheStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export class InMemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, string>();

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}
