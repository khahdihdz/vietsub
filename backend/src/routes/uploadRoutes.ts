import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/env.js';
import { ProjectRepository } from '../db/projectRepository.js';
import { probeVideo } from '../services/video/ffmpegService.js';
import {
  assertAllowedExtension,
  assertMagicBytesMatch,
  assertPathWithinDir,
  assertWithinSizeLimit,
  sanitizeFilename,
  UploadValidationError,
} from '../services/security/uploadValidation.js';

const router = Router();
const projects = new ProjectRepository();
const config = loadConfig();

mkdirSync(config.server.uploadDir, { recursive: true });

// Lưu tạm vào thư mục riêng trước khi validate, tránh ghi thẳng file chưa kiểm tra vào nơi cuối cùng
const tempUpload = multer({
  dest: join(config.server.uploadDir, '.tmp'),
  limits: { fileSize: config.server.maxUploadSizeMb * 1024 * 1024 },
});

router.post('/upload', tempUpload.single('video'), async (req, res) => {
  const file = req.file;
  const projectId = req.body?.projectId as string | undefined;

  if (!file) return res.status(400).json({ error: 'Thiếu file "video".' });
  if (!projectId) {
    unlinkSync(file.path);
    return res.status(400).json({ error: 'Thiếu "projectId".' });
  }

  const project = projects.get(projectId);
  if (!project) {
    unlinkSync(file.path);
    return res.status(404).json({ error: 'Không tìm thấy project.' });
  }

  try {
    const safeName = sanitizeFilename(file.originalname);
    const ext = assertAllowedExtension(safeName);
    assertWithinSizeLimit(file.size, config.server.maxUploadSizeMb);

    const header = readFileSync(file.path).subarray(0, 64);
    assertMagicBytesMatch(ext, header);

    const finalDir = join(config.server.uploadDir, projectId);
    mkdirSync(finalDir, { recursive: true });
    const finalPath = join(finalDir, `${randomUUID()}${ext}`);
    assertPathWithinDir(finalPath, config.server.uploadDir);

    renameSync(file.path, finalPath);

    const info = await probeVideo(finalPath);

    const video = projects.addVideo({
      projectId,
      originalFilename: safeName,
      storedPath: finalPath,
      sizeBytes: file.size,
      durationSeconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      format: info.format,
      codec: info.codec,
    });

    projects.setProgress(projectId, 'upload', 100);

    res.status(201).json(video);
  } catch (err) {
    try {
      unlinkSync(file.path);
    } catch {
      /* file có thể đã được rename, bỏ qua */
    }
    if (err instanceof UploadValidationError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: `Lỗi xử lý upload: ${(err as Error).message}` });
  }
});

export default router;
