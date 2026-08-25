import 'dotenv/config';

/**
 * Cấu hình môi trường — CHỈ được import ở phía backend.
 * Không bao giờ export/serialize object này ra response gửi cho client,
 * và không bao giờ import file này từ code chạy trên frontend.
 */
export interface AppConfig {
  vilao: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  ai: {
    maxRetries: number;
    retryBaseDelayMs: number;
  };
  translation: {
    contextBefore: number;
    contextAfter: number;
    chunkSize: number;
    chunkOverlap: number;
  };
  server: {
    port: number;
    uploadDir: string;
    dataDir: string;
    dbPath: string;
    maxUploadSizeMb: number;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Thiếu biến môi trường bắt buộc: ${name}. Kiểm tra file .env (xem .env.example).`
    );
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

let cached: AppConfig | null = null;

/**
 * Lazy-load config. Việc chỉ *đọc* config (khởi động server, đọc port,
 * upload dir, v.v.) không được throw dù thiếu VILAO_API_KEY — server vẫn
 * phải chạy được cho các tính năng không cần AI (upload, export, render).
 * VILAO_API_KEY chỉ bắt buộc và được kiểm tra ngay tại nơi thực sự dùng nó
 * (xem `VilaoProvider`, gọi `requireVilaoApiKey()`).
 */
export function loadConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    vilao: {
      apiKey: process.env.VILAO_API_KEY || '',
      baseUrl: process.env.VILAO_BASE_URL || 'https://api.vilao.ai/v1',
      model: process.env.VILAO_MODEL || 'deepseek/deepseek-v4-pro',
    },
    ai: {
      maxRetries: intEnv('AI_MAX_RETRIES', 3),
      retryBaseDelayMs: intEnv('AI_RETRY_BASE_DELAY_MS', 800),
    },
    translation: {
      contextBefore: intEnv('TRANSLATION_CONTEXT_BEFORE', 5),
      contextAfter: intEnv('TRANSLATION_CONTEXT_AFTER', 5),
      chunkSize: intEnv('TRANSLATION_CHUNK_SIZE', 100),
      chunkOverlap: intEnv('TRANSLATION_CHUNK_OVERLAP', 5),
    },
    server: {
      port: intEnv('PORT', 4000),
      uploadDir: process.env.UPLOAD_DIR || './uploads',
      dataDir: process.env.DATA_DIR || './data',
      dbPath: process.env.DB_PATH || './data/app.db',
      maxUploadSizeMb: intEnv('MAX_UPLOAD_SIZE_MB', 2048),
    },
  };
  return cached;
}

/** Gọi ở nơi thực sự cần API key (VilaoProvider) — throw rõ ràng nếu thiếu, thay vì lỗi mờ ở HTTP layer. */
export function requireVilaoApiKey(): string {
  const key = loadConfig().vilao.apiKey;
  if (!key) {
    throw new Error(
      'Thiếu VILAO_API_KEY. Tính năng dịch/proofread cần biến này trong .env — xem .env.example.'
    );
  }
  return key;
}
