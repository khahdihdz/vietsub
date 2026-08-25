import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: DatabaseSync | null = null;

/**
 * Mở (hoặc tạo) database SQLite và áp dụng schema. Dùng node:sqlite (built-in
 * từ Node 22+) — nhất quán với pattern node:sqlite đã dùng ở sepay-webhook-backend.
 * SQLite phù hợp cho phase này; có thể thay bằng Postgres sau bằng cách viết
 * lại các repository mà không đổi interface gọi từ routes.
 */
export function getDb(): DatabaseSync {
  if (db) return db;

  const config = loadConfig();
  mkdirSync(config.server.dataDir, { recursive: true });

  db = new DatabaseSync(config.server.dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
