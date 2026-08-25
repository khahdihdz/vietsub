import { Character, GlossaryEntry, QAIssue, SubtitleEntry } from '../../types/subtitle.js';

export interface QAThresholds {
  maxCps: number; // ký tự/giây tối đa
  minDurationSec: number;
  maxDurationSec: number;
  maxLineLength: number; // ký tự mỗi dòng
}

export const DEFAULT_QA_THRESHOLDS: QAThresholds = {
  maxCps: 20,
  minDurationSec: 0.7,
  maxDurationSec: 8,
  maxLineLength: 42,
};

/**
 * QA hoàn toàn rule-based (không gọi AI) — chạy nhanh, dùng để hiển thị
 * cảnh báo ⚠ trong subtitle editor (mục 16).
 */
export class QAService {
  constructor(private readonly thresholds: QAThresholds = DEFAULT_QA_THRESHOLDS) {}

  check(subtitles: SubtitleEntry[], glossary: GlossaryEntry[], characters: Character[]): QAIssue[] {
    const issues: QAIssue[] = [];
    const sorted = [...subtitles].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const text = s.translation ?? '';
      const duration = s.end - s.start;

      if (s.end < s.start) {
        issues.push({ subtitleId: s.id, type: 'end_before_start', message: `Timestamp lỗi: end (${s.end}) < start (${s.start}).` });
      }

      if (duration > 0) {
        if (duration < this.thresholds.minDurationSec) {
          issues.push({ subtitleId: s.id, type: 'too_short_duration', message: `Thời gian hiển thị quá ngắn (${duration.toFixed(2)}s).` });
        }
        if (duration > this.thresholds.maxDurationSec) {
          issues.push({ subtitleId: s.id, type: 'too_long_duration', message: `Thời gian hiển thị quá dài (${duration.toFixed(2)}s).` });
        }
        const cps = text.replace(/\s/g, '').length / duration;
        if (cps > this.thresholds.maxCps) {
          issues.push({ subtitleId: s.id, type: 'cps_too_high', message: `CPS quá cao (${cps.toFixed(1)} ký tự/giây).` });
        }
      }

      const longestLine = Math.max(0, ...text.split('\n').map((l) => l.length));
      if (longestLine > this.thresholds.maxLineLength) {
        issues.push({ subtitleId: s.id, type: 'line_too_long', message: `Dòng dài ${longestLine} ký tự (giới hạn ${this.thresholds.maxLineLength}).` });
      }

      const next = sorted[i + 1];
      if (next && s.end > next.start) {
        issues.push({
          subtitleId: s.id,
          type: 'overlap',
          message: `Overlap với subtitle #${next.id} (end ${s.end} > start kế tiếp ${next.start}).`,
        });
      }
    }

    issues.push(...this.checkTerminologyConsistency(subtitles, glossary));
    issues.push(...this.checkAddressingConsistency(subtitles, characters));

    return issues;
  }

  /** Nếu glossary quy định "灵气" → "Linh Khí", cảnh báo nếu tìm thấy biến thể khác trong bản dịch. */
  private checkTerminologyConsistency(subtitles: SubtitleEntry[], glossary: GlossaryEntry[]): QAIssue[] {
    const issues: QAIssue[] = [];
    if (glossary.length === 0) return issues;

    // Gom các bản dịch đã dùng cho mỗi thuật ngữ gốc xuất hiện trong original
    const usageByTerm = new Map<string, Set<string>>();

    for (const g of glossary) {
      const usedTranslations = new Set<string>();
      for (const s of subtitles) {
        if (!s.original.includes(g.term) || !s.translation) continue;
        // Không thể biết chính xác cụm nào tương ứng, nên chỉ ghi nhận có dùng
        // đúng bản dịch glossary hay không như một tín hiệu nhất quán.
        if (s.translation.includes(g.translation)) {
          usedTranslations.add(g.translation);
        } else {
          usedTranslations.add('(khác glossary)');
          issues.push({
            subtitleId: s.id,
            type: 'inconsistent_term',
            message: `Thuật ngữ "${g.term}" nên dịch là "${g.translation}" theo glossary nhưng có thể chưa được dùng đúng.`,
          });
        }
      }
      usageByTerm.set(g.term, usedTranslations);
    }

    return issues;
  }

  /** Cảnh báo nếu speaker của một dòng có nhân vật được định nghĩa addressing nhưng bản dịch dùng đại từ khác lạ hoàn toàn. */
  private checkAddressingConsistency(subtitles: SubtitleEntry[], characters: Character[]): QAIssue[] {
    const issues: QAIssue[] = [];
    if (characters.length === 0) return issues;

    const byId = new Map(characters.map((c) => [c.id, c]));

    for (const s of subtitles) {
      if (!s.speaker || !s.translation) continue;
      const character = byId.get(s.speaker) ?? characters.find((c) => c.name === s.speaker);
      if (!character?.addressing) continue;

      const expectedTerms = Object.values(character.addressing);
      if (expectedTerms.length === 0) continue;

      const usesAnyExpectedTerm = expectedTerms.some((term) => s.translation!.includes(term));
      // Chỉ cảnh báo nhẹ (heuristic) — không chắc chắn nên không chặn, chỉ gợi ý kiểm tra thủ công
      if (!usesAnyExpectedTerm && s.translation.length > 0) {
        issues.push({
          subtitleId: s.id,
          type: 'inconsistent_addressing',
          message: `${character.name} thường xưng hô bằng "${expectedTerms.join('/')}", kiểm tra lại dòng này nếu có xưng hô.`,
        });
      }
    }

    return issues;
  }
}
