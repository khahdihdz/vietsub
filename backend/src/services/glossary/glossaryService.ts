import { GlossaryEntry } from '../../types/subtitle.js';

/**
 * Quản lý glossary trong bộ nhớ cho một project. Import/export dùng
 * cùng định dạng JSON đơn giản: { "term": "translation", ... } giống
 * ví dụ trong spec (mục 9), để tương thích ngược với file glossary có sẵn.
 */
export class GlossaryService {
  private entries = new Map<string, GlossaryEntry>();

  add(entry: GlossaryEntry): void {
    this.entries.set(entry.term, entry);
  }

  update(term: string, translation: string, note?: string): void {
    const existing = this.entries.get(term);
    if (!existing) throw new Error(`Không tìm thấy thuật ngữ "${term}" trong glossary.`);
    this.entries.set(term, { ...existing, translation, note });
  }

  remove(term: string): void {
    this.entries.delete(term);
  }

  list(): GlossaryEntry[] {
    return Array.from(this.entries.values());
  }

  /** Import từ định dạng phẳng { "term": "translation" } như ví dụ trong spec. */
  importFlat(json: Record<string, string>): void {
    for (const [term, translation] of Object.entries(json)) {
      this.add({ term, translation });
    }
  }

  exportFlat(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of this.entries.values()) {
      result[entry.term] = entry.translation;
    }
    return result;
  }
}
