import {
  AssPreset,
  Character,
  GlossaryEntry,
  PipelineProgress,
  Project,
  ProjectDetail,
  QAIssue,
  SubtitleEntry,
  TranslationStyle,
  VideoInfo,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Projects
  listProjects: () => request<Project[]>('/api/project'),
  createProject: (name: string) => request<Project>('/api/project', { method: 'POST', body: JSON.stringify({ name }) }),
  getProject: (id: string) => request<ProjectDetail>(`/api/project/${id}`),
  updateProjectSettings: (id: string, settings: Partial<ProjectDetail['project']['settings']>) =>
    request<Project>(`/api/project/${id}`, { method: 'PUT', body: JSON.stringify({ settings }) }),
  deleteProject: (id: string) => request<void>(`/api/project/${id}`, { method: 'DELETE' }),
  getProgress: (id: string) => request<PipelineProgress>(`/api/project/${id}/progress`),

  // Upload
  uploadVideo: async (projectId: string, file: File): Promise<VideoInfo> => {
    const form = new FormData();
    form.append('projectId', projectId);
    form.append('video', file);
    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
    }
    return res.json();
  },

  // Subtitles
  generateFromTranscript: (projectId: string, transcript: unknown[]) =>
    request<{ subtitleCount: number; subtitles: SubtitleEntry[] }>('/api/subtitle/generate', {
      method: 'POST',
      body: JSON.stringify({ projectId, transcript }),
    }),
  updateSubtitle: (projectId: string, id: number, fields: Partial<SubtitleEntry>) =>
    request<SubtitleEntry>(`/api/subtitle/${id}?projectId=${projectId}`, { method: 'PUT', body: JSON.stringify(fields) }),
  deleteSubtitle: (projectId: string, id: number) =>
    request<void>(`/api/subtitle/${id}?projectId=${projectId}`, { method: 'DELETE' }),

  // Translation / proofread
  translate: (projectId: string, style?: TranslationStyle) =>
    request<{ translatedCount: number; failedIds: number[] }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ projectId, style }),
    }),
  proofread: (projectId: string, ids?: number[]) =>
    request<{ correctedCount: number; corrections: unknown[] }>('/api/proofread', {
      method: 'POST',
      body: JSON.stringify({ projectId, ids }),
    }),

  // QA
  runQA: (projectId: string) => request<{ issueCount: number; issues: QAIssue[] }>(`/api/qa?projectId=${projectId}`),

  // Glossary
  addGlossary: (projectId: string, entry: GlossaryEntry) =>
    request<GlossaryEntry>('/api/glossary', { method: 'POST', body: JSON.stringify({ projectId, ...entry }) }),
  removeGlossary: (projectId: string, term: string) =>
    request<void>(`/api/glossary/${encodeURIComponent(term)}?projectId=${projectId}`, { method: 'DELETE' }),

  // Characters
  upsertCharacter: (projectId: string, character: Character) =>
    request<Character>('/api/character', { method: 'POST', body: JSON.stringify({ projectId, character }) }),
  removeCharacter: (projectId: string, id: string) =>
    request<void>(`/api/character/${encodeURIComponent(id)}?projectId=${projectId}`, { method: 'DELETE' }),

  // Export / render
  exportUrl: (projectId: string, format: 'srt' | 'vtt' | 'ass', preset?: AssPreset) =>
    `${API_BASE}/api/export/${projectId}?format=${format}${preset ? `&preset=${preset}` : ''}`,
  videoStreamUrl: (projectId: string) => `${API_BASE}/api/project/${projectId}/video-stream`,
};

export { API_BASE };
