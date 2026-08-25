import { Router } from 'express';
import { join } from 'node:path';
import { ProjectRepository } from '../db/projectRepository.js';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { extractAudio } from '../services/video/ffmpegService.js';
import { NotConfiguredSttProvider, SttNotConfiguredError, SpeechToTextProvider } from '../services/stt/SpeechToTextProvider.js';
import { segmentTranscript } from '../services/subtitle/segmentationService.js';
import { loadConfig } from '../config/env.js';

const router = Router();
const projects = new ProjectRepository();
const subtitles = new SubtitleRepository();

/**
 * Provider STT đang dùng. Mặc định chưa cấu hình (xem SpeechToTextProvider.ts).
 * Để cắm engine thật: implement SpeechToTextProvider và thay dòng dưới đây.
 */
const sttProvider: SpeechToTextProvider = new NotConfiguredSttProvider();

router.post('/transcribe', async (req, res) => {
  const { projectId } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: 'Thiếu "projectId".' });

  const project = projects.get(projectId);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const video = projects.getVideoByProject(projectId);
  if (!video) return res.status(400).json({ error: 'Project chưa có video. Upload video trước.' });

  try {
    const config = loadConfig();
    const audioPath = join(config.server.uploadDir, projectId, 'audio.wav');
    await extractAudio(video.storedPath, audioPath);
    projects.setProgress(projectId, 'stt', 30);

    const sttSegments = await sttProvider.transcribe(audioPath);
    projects.setProgress(projectId, 'stt', 100);

    const segmented = segmentTranscript(sttSegments);
    projects.setProgress(projectId, 'segment', 100);

    subtitles.replaceAll(projectId, segmented);

    res.json({ subtitleCount: segmented.length, subtitles: segmented });
  } catch (err) {
    if (err instanceof SttNotConfiguredError) {
      return res.status(501).json({ error: err.message });
    }
    res.status(500).json({ error: `Lỗi transcribe: ${(err as Error).message}` });
  }
});

export default router;
