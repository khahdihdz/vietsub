export interface VideoInfo {
  id: string;
  projectId: string;
  originalFilename: string;
  storedPath: string;
  sizeBytes: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  format?: string;
  codec?: string;
  uploadedAt: string;
}

export interface ProjectSettings {
  translationStyle: import('./subtitle.js').TranslationStyle;
  contextBefore: number;
  contextAfter: number;
  chunkSize: number;
  chunkOverlap: number;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  translationStyle: 'tu_nhien',
  contextBefore: 5,
  contextAfter: 5,
  chunkSize: 100,
  chunkOverlap: 5,
};

export interface Project {
  id: string;
  name: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineProgress {
  projectId: string;
  upload: number;
  stt: number;
  segment: number;
  translate: number;
  proofread: number;
  qa: number;
  export: number;
  updatedAt: string;
}

export type PipelineStep = 'upload' | 'stt' | 'segment' | 'translate' | 'proofread' | 'qa' | 'export';
