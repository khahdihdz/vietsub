import { randomUUID } from 'node:crypto';
import { getDb } from './client.js';
import { DEFAULT_PROJECT_SETTINGS, PipelineProgress, PipelineStep, Project, ProjectSettings, VideoInfo } from '../types/project.js';

function nowIso(): string {
  return new Date().toISOString();
}

export class ProjectRepository {
  create(name: string, settings: Partial<ProjectSettings> = {}): Project {
    const db = getDb();
    const id = randomUUID();
    const timestamp = nowIso();
    const finalSettings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS, ...settings };

    db.prepare(
      `INSERT INTO projects (id, name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, JSON.stringify(finalSettings), timestamp, timestamp);

    db.prepare(
      `INSERT INTO pipeline_progress (project_id, updated_at) VALUES (?, ?)`
    ).run(id, timestamp);

    return { id, name, settings: finalSettings, createdAt: timestamp, updatedAt: timestamp };
  }

  get(id: string): Project | undefined {
    const db = getDb();
    const row = db
      .prepare(`SELECT id, name, settings_json, created_at, updated_at FROM projects WHERE id = ?`)
      .get(id) as unknown as { id: string; name: string; settings_json: string; created_at: string; updated_at: string } | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      settings: JSON.parse(row.settings_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  list(): Project[] {
    const db = getDb();
    const rows = db
      .prepare(`SELECT id, name, settings_json, created_at, updated_at FROM projects ORDER BY updated_at DESC`)
      .all() as unknown as Array<{ id: string; name: string; settings_json: string; created_at: string; updated_at: string }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      settings: JSON.parse(row.settings_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  updateSettings(id: string, settings: Partial<ProjectSettings>): void {
    const db = getDb();
    const project = this.get(id);
    if (!project) throw new Error(`Không tìm thấy project id="${id}".`);
    const merged = { ...project.settings, ...settings };
    db.prepare(`UPDATE projects SET settings_json = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(merged),
      nowIso(),
      id
    );
  }

  rename(id: string, name: string): void {
    const db = getDb();
    db.prepare(`UPDATE projects SET name = ?, updated_at = ? WHERE id = ?`).run(name, nowIso(), id);
  }

  delete(id: string): void {
    const db = getDb();
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  }

  addVideo(video: Omit<VideoInfo, 'id' | 'uploadedAt'>): VideoInfo {
    const db = getDb();
    const id = randomUUID();
    const uploadedAt = nowIso();
    db.prepare(
      `INSERT INTO videos (id, project_id, original_filename, stored_path, size_bytes, duration_seconds, width, height, format, codec, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      video.projectId,
      video.originalFilename,
      video.storedPath,
      video.sizeBytes,
      video.durationSeconds ?? null,
      video.width ?? null,
      video.height ?? null,
      video.format ?? null,
      video.codec ?? null,
      uploadedAt
    );
    return { ...video, id, uploadedAt };
  }

  getVideoByProject(projectId: string): VideoInfo | undefined {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM videos WHERE project_id = ? ORDER BY uploaded_at DESC LIMIT 1`).get(projectId) as unknown as
      | {
          id: string;
          project_id: string;
          original_filename: string;
          stored_path: string;
          size_bytes: number;
          duration_seconds: number | null;
          width: number | null;
          height: number | null;
          format: string | null;
          codec: string | null;
          uploaded_at: string;
        }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      projectId: row.project_id,
      originalFilename: row.original_filename,
      storedPath: row.stored_path,
      sizeBytes: row.size_bytes,
      durationSeconds: row.duration_seconds ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      format: row.format ?? undefined,
      codec: row.codec ?? undefined,
      uploadedAt: row.uploaded_at,
    };
  }

  getProgress(projectId: string): PipelineProgress | undefined {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM pipeline_progress WHERE project_id = ?`).get(projectId) as unknown as
      | {
          project_id: string;
          upload_pct: number;
          stt_pct: number;
          segment_pct: number;
          translate_pct: number;
          proofread_pct: number;
          qa_pct: number;
          export_pct: number;
          updated_at: string;
        }
      | undefined;
    if (!row) return undefined;
    return {
      projectId: row.project_id,
      upload: row.upload_pct,
      stt: row.stt_pct,
      segment: row.segment_pct,
      translate: row.translate_pct,
      proofread: row.proofread_pct,
      qa: row.qa_pct,
      export: row.export_pct,
      updatedAt: row.updated_at,
    };
  }

  setProgress(projectId: string, step: PipelineStep, percent: number): void {
    const db = getDb();
    const column = `${step}_pct`;
    db.prepare(`UPDATE pipeline_progress SET ${column} = ?, updated_at = ? WHERE project_id = ?`).run(
      Math.max(0, Math.min(100, Math.round(percent))),
      nowIso(),
      projectId
    );
  }
}
