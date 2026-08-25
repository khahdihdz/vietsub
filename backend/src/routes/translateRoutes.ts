import { Router } from 'express';
import { ProjectRepository } from '../db/projectRepository.js';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { GlossaryRepository, CharacterRepository } from '../db/glossaryCharacterRepository.js';
import { VilaoProvider } from '../services/ai/VilaoProvider.js';
import { InMemoryCacheStore } from '../services/cache/cacheService.js';
import { TranslationService } from '../services/translation/translationService.js';
import { TranslationStyle } from '../types/subtitle.js';

const router = Router();
const projects = new ProjectRepository();
const subtitleRepo = new SubtitleRepository();
const glossaryRepo = new GlossaryRepository();
const characterRepo = new CharacterRepository();

// Cache sống trong suốt vòng đời process — đủ dùng cho phase này (nhiều project
// dùng chung cache theo hash nội dung nên vẫn an toàn khi tái sử dụng).
const sharedCache = new InMemoryCacheStore();

router.post('/translate', async (req, res) => {
  const { projectId, style, contextBefore, contextAfter, chunkSize, chunkOverlap } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: 'Thiếu "projectId".' });

  const project = projects.get(projectId);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const allSubtitles = subtitleRepo.listByProject(projectId);
  if (allSubtitles.length === 0) {
    return res.status(400).json({ error: 'Project chưa có subtitle nào để dịch. Chạy transcribe trước.' });
  }

  try {
    const ai = new VilaoProvider();
    const service = new TranslationService(ai, sharedCache);

    const result = await service.translate(allSubtitles, {
      glossary: glossaryRepo.listByProject(projectId),
      characters: characterRepo.listByProject(projectId),
      style: (style ?? project.settings.translationStyle) as TranslationStyle,
      contextBefore: contextBefore ?? project.settings.contextBefore,
      contextAfter: contextAfter ?? project.settings.contextAfter,
      chunkSize: chunkSize ?? project.settings.chunkSize,
      chunkOverlap: chunkOverlap ?? project.settings.chunkOverlap,
      onProgress: (done, total) => projects.setProgress(projectId, 'translate', (done / total) * 100),
    });

    const updates = result.subtitles
      .filter((s) => s.translation !== undefined)
      .map((s) => ({ id: s.id, translation: s.translation! }));
    subtitleRepo.updateTranslations(projectId, updates);

    res.json({ translatedCount: updates.length, failedIds: result.failedIds });
  } catch (err) {
    res.status(500).json({ error: `Lỗi dịch: ${(err as Error).message}` });
  }
});

export default router;
