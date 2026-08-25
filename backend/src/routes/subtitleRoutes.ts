import { Router } from 'express';
import { ProjectRepository } from '../db/projectRepository.js';
import { SubtitleRepository } from '../db/subtitleRepository.js';
import { GlossaryRepository, CharacterRepository } from '../db/glossaryCharacterRepository.js';
import { segmentTranscript, TranscriptChunk } from '../services/subtitle/segmentationService.js';
import { QAService } from '../services/qa/qaService.js';

const router = Router();
const projects = new ProjectRepository();
const subtitleRepo = new SubtitleRepository();
const glossaryRepo = new GlossaryRepository();
const characterRepo = new CharacterRepository();
const qaService = new QAService();

router.get('/subtitle', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  res.json(subtitleRepo.listByProject(projectId));
});

/**
 * Tạo subtitle từ transcript đã có (mục 5). Vì STT chưa được cấu hình engine
 * thật trong module này (xem SpeechToTextProvider.ts), endpoint này cho phép
 * đưa transcript vào trực tiếp — từ engine STT chạy riêng, hoặc từ /api/transcribe
 * một khi bạn đã cắm engine thật.
 */
router.post('/subtitle/generate', (req, res) => {
  const { projectId, transcript, options } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: 'Thiếu "projectId".' });
  if (!Array.isArray(transcript)) {
    return res.status(400).json({ error: 'Thiếu "transcript" (mảng {start, end, speaker?, text}).' });
  }

  const project = projects.get(projectId);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy project.' });

  const chunks = transcript as TranscriptChunk[];
  const segmented = segmentTranscript(chunks, options ?? {});
  subtitleRepo.replaceAll(projectId, segmented);
  projects.setProgress(projectId, 'segment', 100);

  res.json({ subtitleCount: segmented.length, subtitles: segmented });
});

router.put('/subtitle/:id', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const id = parseInt(req.params.id, 10);
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID subtitle không hợp lệ.' });

  try {
    const updated = subtitleRepo.updateOne(projectId, id, req.body ?? {});
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

router.delete('/subtitle/:id', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const id = parseInt(req.params.id, 10);
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  subtitleRepo.deleteOne(projectId, id);
  res.status(204).send();
});

router.get('/qa', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });

  const subtitles = subtitleRepo.listByProject(projectId);
  const glossary = glossaryRepo.listByProject(projectId);
  const characters = characterRepo.listByProject(projectId);
  const issues = qaService.check(subtitles, glossary, characters);
  projects.setProgress(projectId, 'qa', 100);

  res.json({ issueCount: issues.length, issues });
});

// --- Glossary CRUD (mục 9) ---
router.get('/glossary', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  res.json(glossaryRepo.listByProject(projectId));
});

router.post('/glossary', (req, res) => {
  const { projectId, term, translation, note } = req.body ?? {};
  if (!projectId || !term || !translation) {
    return res.status(400).json({ error: 'Thiếu projectId/term/translation.' });
  }
  glossaryRepo.upsert(projectId, { term, translation, note });
  res.status(201).json({ term, translation, note });
});

router.delete('/glossary/:term', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  glossaryRepo.remove(projectId, req.params.term);
  res.status(204).send();
});

router.post('/glossary/import', (req, res) => {
  const { projectId, entries } = req.body ?? {};
  if (!projectId || typeof entries !== 'object') {
    return res.status(400).json({ error: 'Thiếu projectId hoặc entries ({ term: translation }).' });
  }
  glossaryRepo.importFlat(projectId, entries);
  res.json(glossaryRepo.listByProject(projectId));
});

router.get('/glossary/export', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  res.json(glossaryRepo.exportFlat(projectId));
});

// --- Character CRUD (mục 10) ---
router.get('/character', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  res.json(characterRepo.listByProject(projectId));
});

router.post('/character', (req, res) => {
  const { projectId, character } = req.body ?? {};
  if (!projectId || !character?.id || !character?.name) {
    return res.status(400).json({ error: 'Thiếu projectId hoặc character {id, name, ...}.' });
  }
  characterRepo.upsert(projectId, character);
  res.status(201).json(character);
});

router.delete('/character/:id', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) return res.status(400).json({ error: 'Thiếu query "projectId".' });
  characterRepo.remove(projectId, req.params.id);
  res.status(204).send();
});

export default router;
