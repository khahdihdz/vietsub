export type TranslationStyle = 'tu_nhien' | 'sat_nghia' | 'dien_anh' | 'anime' | 'tien_hiep' | 'game';

export const TRANSLATION_STYLE_LABELS: Record<TranslationStyle, string> = {
  tu_nhien: 'Tự nhiên',
  sat_nghia: 'Sát nghĩa',
  dien_anh: 'Điện ảnh',
  anime: 'Anime / Manga',
  tien_hiep: 'Tiên hiệp / Xianxia',
  game: 'Game',
};

export interface ProjectSettings {
  translationStyle: TranslationStyle;
  contextBefore: number;
  contextAfter: number;
  chunkSize: number;
  chunkOverlap: number;
}

export interface Project {
  id: string;
  name: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

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

export interface SubtitleEntry {
  id: number;
  start: number;
  end: number;
  speaker?: string;
  original: string;
  translation?: string;
}

export interface GlossaryEntry {
  term: string;
  translation: string;
  note?: string;
}

export interface Character {
  id: string;
  name: string;
  gender?: string;
  age?: number;
  role?: string;
  personality?: string;
  addressing?: Record<string, string>;
}

export interface QAIssue {
  subtitleId: number;
  type:
    | 'overlap'
    | 'end_before_start'
    | 'too_long_duration'
    | 'too_short_duration'
    | 'cps_too_high'
    | 'line_too_long'
    | 'inconsistent_term'
    | 'inconsistent_addressing';
  message: string;
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

export interface ProjectDetail {
  project: Project;
  video: VideoInfo | null;
  subtitles: SubtitleEntry[];
  glossary: GlossaryEntry[];
  characters: Character[];
  progress: PipelineProgress;
}

export type AssPreset = 'default' | 'movie' | 'anime' | 'drama' | 'gaming';

export const ASS_PRESET_LABELS: Record<AssPreset, string> = {
  default: 'Default',
  movie: 'Movie',
  anime: 'Anime',
  drama: 'Drama',
  gaming: 'Gaming',
};
