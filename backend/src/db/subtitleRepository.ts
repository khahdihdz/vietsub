import { getDb } from './client.js';
import { SubtitleEntry } from '../types/subtitle.js';

interface SubtitleRow {
  project_id: string;
  id: number;
  start_sec: number;
  end_sec: number;
  speaker: string | null;
  original: string;
  translation: string | null;
}

function rowToEntry(row: SubtitleRow): SubtitleEntry {
  return {
    id: row.id,
    start: row.start_sec,
    end: row.end_sec,
    speaker: row.speaker ?? undefined,
    original: row.original,
    translation: row.translation ?? undefined,
  };
}

export class SubtitleRepository {
  /** Ghi đè toàn bộ subtitle của project (dùng sau bước phân đoạn/STT). */
  replaceAll(projectId: string, subtitles: SubtitleEntry[]): void {
    const db = getDb();
    db.exec('BEGIN');
    try {
      db.prepare(`DELETE FROM subtitles WHERE project_id = ?`).run(projectId);
      const insert = db.prepare(
        `INSERT INTO subtitles (project_id, id, start_sec, end_sec, speaker, original, translation)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of subtitles) {
        insert.run(projectId, s.id, s.start, s.end, s.speaker ?? null, s.original, s.translation ?? null);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  listByProject(projectId: string): SubtitleEntry[] {
    const db = getDb();
    const rows = db
      .prepare(`SELECT * FROM subtitles WHERE project_id = ? ORDER BY id ASC`)
      .all(projectId) as unknown as SubtitleRow[];
    return rows.map(rowToEntry);
  }

  /** Cập nhật hàng loạt bản dịch sau bước translate/proofread — chỉ ghi field translation. */
  updateTranslations(projectId: string, updates: Array<{ id: number; translation: string }>): void {
    const db = getDb();
    const stmt = db.prepare(`UPDATE subtitles SET translation = ? WHERE project_id = ? AND id = ?`);
    db.exec('BEGIN');
    try {
      for (const u of updates) {
        stmt.run(u.translation, projectId, u.id);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  /** Sửa thủ công một dòng trong subtitle editor (mục 14) — cho phép sửa nội dung/timestamp/speaker. */
  updateOne(
    projectId: string,
    id: number,
    fields: Partial<Pick<SubtitleEntry, 'start' | 'end' | 'speaker' | 'original' | 'translation'>>
  ): SubtitleEntry {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM subtitles WHERE project_id = ? AND id = ?`).get(projectId, id) as unknown as
      | SubtitleRow
      | undefined;
    if (!existing) throw new Error(`Không tìm thấy subtitle id=${id} trong project.`);

    const merged: SubtitleRow = {
      ...existing,
      start_sec: fields.start ?? existing.start_sec,
      end_sec: fields.end ?? existing.end_sec,
      speaker: fields.speaker ?? existing.speaker,
      original: fields.original ?? existing.original,
      translation: fields.translation ?? existing.translation,
    };

    db.prepare(
      `UPDATE subtitles SET start_sec = ?, end_sec = ?, speaker = ?, original = ?, translation = ? WHERE project_id = ? AND id = ?`
    ).run(merged.start_sec, merged.end_sec, merged.speaker, merged.original, merged.translation, projectId, id);

    return rowToEntry(merged);
  }

  deleteOne(projectId: string, id: number): void {
    const db = getDb();
    db.prepare(`DELETE FROM subtitles WHERE project_id = ? AND id = ?`).run(projectId, id);
  }
}
