import { Router } from 'express';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { exportSrt } from '../services/subtitle/srtExporter.js';
import { exportVtt } from '../services/subtitle/vttExporter.js';
import { ASS_STYLE_PRESETS, exportAss } from '../services/subtitle/assExporter.js';
import { ProjectRepository } from '../db/projectRepository.js';

const router = Router();
const projects = new ProjectRepository();
const subtitleRepo = new SubtitleRepository();

const CONTENT_TYPES: Record<string, string> = {
  srt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  ass: 'text/plain; charset=utf-8',
};

router.get('/export/:id', (req, res) => {
  const projectId = req.params.id;
  const format = (req.query.format as string) || 'srt';
  const preset = (req.query.preset as keyof typeof ASS_STYLE_PRESETS) || 'default';

  const project = projects.get(projectId);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const subtitles = subtitleRepo.listByProject(projectId);
  if (subtitles.length === 0) {
    return res.status(400).json({ error: 'Project chưa có subtitle để export.' });
  }

  let content: string;
  let filename: string;

  switch (format) {
    case 'srt':
      content = exportSrt(subtitles);
      filename = `${project.name}.srt`;
      break;
    case 'vtt':
      content = exportVtt(subtitles);
      filename = `${project.name}.vtt`;
      break;
    case 'ass': {
      const style = ASS_STYLE_PRESETS[preset] ?? ASS_STYLE_PRESETS.default;
      content = exportAss(subtitles, style);
      filename = `${project.name}.ass`;
      break;
    }
    default:
      return res.status(400).json({ error: `Định dạng "${format}" không hỗ trợ. Dùng srt/vtt/ass.` });
  }

  projects.setProgress(projectId, 'export', 100);
  res.setHeader('Content-Type', CONTENT_TYPES[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(content);
});

export default router;
