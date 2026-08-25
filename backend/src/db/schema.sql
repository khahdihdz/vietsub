-- Schema cho Việt hóa phụ đề video (mục 23: Project chứa Video, Transcript/Subtitles,
-- Translation, Glossary, Characters, Settings).

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  format TEXT,
  codec TEXT,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtitles (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id INTEGER NOT NULL,
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  speaker TEXT,
  original TEXT NOT NULL,
  translation TEXT,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS glossary_entries (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  translation TEXT NOT NULL,
  note TEXT,
  PRIMARY KEY (project_id, term)
);

CREATE TABLE IF NOT EXISTS characters (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  role TEXT,
  personality TEXT,
  addressing_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, id)
);

-- Tiến trình từng bước của pipeline (mục 22) — poll qua GET /api/project/:id/progress
CREATE TABLE IF NOT EXISTS pipeline_progress (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  upload_pct INTEGER NOT NULL DEFAULT 0,
  stt_pct INTEGER NOT NULL DEFAULT 0,
  segment_pct INTEGER NOT NULL DEFAULT 0,
  translate_pct INTEGER NOT NULL DEFAULT 0,
  proofread_pct INTEGER NOT NULL DEFAULT 0,
  qa_pct INTEGER NOT NULL DEFAULT 0,
  export_pct INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
