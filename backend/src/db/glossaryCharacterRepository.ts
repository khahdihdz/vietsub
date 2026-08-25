import { getDb } from './client.js';
import { Character, GlossaryEntry } from '../types/subtitle.js';

export class GlossaryRepository {
  listByProject(projectId: string): GlossaryEntry[] {
    const db = getDb();
    const rows = db
      .prepare(`SELECT term, translation, note FROM glossary_entries WHERE project_id = ? ORDER BY term ASC`)
      .all(projectId) as unknown as Array<{ term: string; translation: string; note: string | null }>;
    return rows.map((r) => ({ term: r.term, translation: r.translation, note: r.note ?? undefined }));
  }

  upsert(projectId: string, entry: GlossaryEntry): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO glossary_entries (project_id, term, translation, note)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, term) DO UPDATE SET translation = excluded.translation, note = excluded.note`
    ).run(projectId, entry.term, entry.translation, entry.note ?? null);
  }

  remove(projectId: string, term: string): void {
    const db = getDb();
    db.prepare(`DELETE FROM glossary_entries WHERE project_id = ? AND term = ?`).run(projectId, term);
  }

  importFlat(projectId: string, json: Record<string, string>): void {
    for (const [term, translation] of Object.entries(json)) {
      this.upsert(projectId, { term, translation });
    }
  }

  exportFlat(projectId: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of this.listByProject(projectId)) {
      result[entry.term] = entry.translation;
    }
    return result;
  }
}

export class CharacterRepository {
  listByProject(projectId: string): Character[] {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM characters WHERE project_id = ?`).all(projectId) as unknown as Array<{
      id: string;
      name: string;
      gender: string | null;
      age: number | null;
      role: string | null;
      personality: string | null;
      addressing_json: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      gender: r.gender ?? undefined,
      age: r.age ?? undefined,
      role: r.role ?? undefined,
      personality: r.personality ?? undefined,
      addressing: JSON.parse(r.addressing_json || '{}'),
    }));
  }

  upsert(projectId: string, character: Character): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO characters (project_id, id, name, gender, age, role, personality, addressing_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, id) DO UPDATE SET
         name = excluded.name, gender = excluded.gender, age = excluded.age,
         role = excluded.role, personality = excluded.personality, addressing_json = excluded.addressing_json`
    ).run(
      projectId,
      character.id,
      character.name,
      character.gender ?? null,
      character.age ?? null,
      character.role ?? null,
      character.personality ?? null,
      JSON.stringify(character.addressing ?? {})
    );
  }

  remove(projectId: string, id: string): void {
    const db = getDb();
    db.prepare(`DELETE FROM characters WHERE project_id = ? AND id = ?`).run(projectId, id);
  }
}
