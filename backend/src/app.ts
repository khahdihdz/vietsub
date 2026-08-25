import express, { ErrorRequestHandler } from 'express';
import projectRoutes from './routes/projectRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import transcribeRoutes from './routes/transcribeRoutes.js';
import translateRoutes from './routes/translateRoutes.js';
import proofreadRoutes from './routes/proofreadRoutes.js';
import subtitleRoutes from './routes/subtitleRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import videoRoutes from './routes/videoRoutes.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // CORS: frontend (Next.js, port khác) cần gọi được API này từ trình duyệt.
  // Cho phép qua biến env CORS_ORIGIN (mặc định "*" cho local dev).
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Content-Disposition');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api', projectRoutes);
  app.use('/api', uploadRoutes);
  app.use('/api', transcribeRoutes);
  app.use('/api', translateRoutes);
  app.use('/api', proofreadRoutes);
  app.use('/api', subtitleRoutes);
  app.use('/api', exportRoutes);
  app.use('/api', videoRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Không tìm thấy route.' });
  });

  // Middleware xử lý lỗi tập trung — không bao giờ log hay trả về API key trong response.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('Lỗi không bắt được:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Lỗi server nội bộ.' });
  };
  app.use(errorHandler);

  return app;
}
