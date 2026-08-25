import { Router } from 'express';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectRepository } from '../db/projectRepository.js';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { ASS_STYLE_PRESETS, exportAss } from '../services/subtitle/assExporter.js';
import { burnSubtitle } from '../services/video/ffmpegService.js';

const router = Router();
const projects = new ProjectRepository();
const subtitleRepo = new SubtitleRepository();

router.post('/video/render', async (req, res) => {
  const { projectId, preset } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: 'Thiếu "projectId".' });

  const project = projects.get(projectId);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const video = projects.getVideoByProject(projectId);
  if (!video) return res.status(400).json({ error: 'Project chưa có video.' });

  const subtitles = subtitleRepo.listByProject(projectId);
  if (subtitles.length === 0) return res.status(400).json({ error: 'Project chưa có subtitle để render.' });

  try {
    const style = ASS_STYLE_PRESETS[(preset as keyof typeof ASS_STYLE_PRESETS) ?? 'default'] ?? ASS_STYLE_PRESETS.default;
    const assContent = exportAss(subtitles, style);

    const tempDir = mkdtempSync(join(tmpdir(), 'render-'));
    const assPath = join(tempDir, 'subtitle.ass');
    writeFileSync(assPath, assContent, 'utf-8');

    const outputPath = join(tempDir, `${project.name}_vietsub.mp4`);
    await burnSubtitle({ inputVideoPath: video.storedPath, assSubtitlePath: assPath, outputVideoPath: outputPath });

    res.download(outputPath, `${project.name}_vietsub.mp4`);
  } catch (err) {
    res.status(500).json({ error: `Lỗi render video: ${(err as Error).message}` });
  }
});

export default router;
