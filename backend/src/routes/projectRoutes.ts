import { Router } from 'express';
import { createReadStream, statSync } from 'node:fs';
import { ProjectRepository } from '../db/projectRepository.js';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { GlossaryRepository, CharacterRepository } from '../db/glossaryCharacterRepository.js';

const router = Router();
const projects = new ProjectRepository();
const subtitles = new SubtitleRepository();
const glossary = new GlossaryRepository();
const characters = new CharacterRepository();

router.post('/project', (req, res) => {
  const { name, settings } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Thiếu "name" cho project.' });
  }
  const project = projects.create(name, settings ?? {});
  res.status(201).json(project);
});

router.get('/project', (_req, res) => {
  res.json(projects.list());
});

router.get('/project/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  res.json({
    project,
    video: projects.getVideoByProject(project.id) ?? null,
    subtitles: subtitles.listByProject(project.id),
    glossary: glossary.listByProject(project.id),
    characters: characters.listByProject(project.id),
    progress: projects.getProgress(project.id),
  });
});

router.put('/project/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const { name, settings } = req.body ?? {};
  if (name) projects.rename(project.id, name);
  if (settings) projects.updateSettings(project.id, settings);
  res.json(projects.get(project.id));
});

router.delete('/project/:id', (req, res) => {
  projects.delete(req.params.id);
  res.status(204).send();
});

router.get('/project/:id/progress', (req, res) => {
  const progress = projects.getProgress(req.params.id);
  if (!progress) return res.status(404).json({ error: 'Không tìm thấy project.' });
  res.json(progress);
});

/**
 * Stream video gốc cho video player ở frontend, hỗ trợ HTTP Range request
 * (bắt buộc để tua/seek hoạt động đúng trong thẻ <video>).
 */
router.get('/project/:id/video-stream', (req, res) => {
  const video = projects.getVideoByProject(req.params.id);
  if (!video) return res.status(404).json({ error: 'Project chưa có video.' });

  const stat = statSync(video.storedPath);
  const range = req.headers.range;
  const mimeType = extToMime(video.storedPath);

  if (!range) {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': mimeType });
    createReadStream(video.storedPath).pipe(res);
    return;
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? parseInt(match[1], 10) : 0;
  const end = match?.[2] ? parseInt(match[2], 10) : stat.size - 1;
  const chunkSize = end - start + 1;

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': mimeType,
  });
  createReadStream(video.storedPath, { start, end }).pipe(res);
});

function extToMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}

export default router;
