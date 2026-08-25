import { Router } from 'express';
import { ProjectRepository } from '../db/projectRepository.js';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { GlossaryRepository, CharacterRepository } from '../db/glossaryCharacterRepository.js';
import { VilaoProvider } from '../services/ai/VilaoProvider.js';
import { ProofreadService } from '../services/proofread/proofreadService.js';
import { TranslationStyle } from '../types/subtitle.js';

const router = Router();
const projects = new ProjectRepository();
const subtitleRepo = new SubtitleRepository();
const glossaryRepo = new GlossaryRepository();
const characterRepo = new CharacterRepository();

/** ids: mảng số cụ thể (nút "✨ Cải thiện bản dịch" cho vài dòng) hoặc bỏ trống để chạy toàn bộ. */
router.post('/proofread', async (req, res) => {
  const { projectId, ids, style } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: 'Thiếu "projectId".' });

  const project = projects.get(projectId);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const allSubtitles = subtitleRepo.listByProject(projectId);
  if (allSubtitles.some((s) => !s.translation)) {
    // Không chặn hẳn — vẫn cho phép proofread các dòng đã dịch — chỉ cảnh báo qua log
  }

  try {
    const ai = new VilaoProvider();
    const service = new ProofreadService(ai);

    const result = await service.proofread(allSubtitles, Array.isArray(ids) && ids.length > 0 ? ids : 'all', {
      glossary: glossaryRepo.listByProject(projectId),
      characters: characterRepo.listByProject(projectId),
      style: (style ?? project.settings.translationStyle) as TranslationStyle,
      contextBefore: project.settings.contextBefore,
      contextAfter: project.settings.contextAfter,
    });

    subtitleRepo.updateTranslations(
      projectId,
      result.corrections.map((c) => ({ id: c.id, translation: c.translation }))
    );
    projects.setProgress(projectId, 'proofread', 100);

    res.json({ correctedCount: result.corrections.length, corrections: result.corrections });
  } catch (err) {
    res.status(500).json({ error: `Lỗi proofread: ${(err as Error).message}` });
  }
});

export default router;
