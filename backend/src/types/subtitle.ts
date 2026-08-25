export interface SubtitleEntry {
  id: number;
  start: number; // giây, có thể có phần thập phân (vd 0.52)
  end: number;
  speaker?: string;
  original: string;
  translation?: string;
}

export type TranslationStyle =
  | 'tu_nhien' // Tự nhiên
  | 'sat_nghia' // Sát nghĩa
  | 'dien_anh' // Điện ảnh
  | 'anime' // Anime / Manga
  | 'tien_hiep' // Tiên hiệp / Xianxia
  | 'game'; // Game localization

export const TRANSLATION_STYLE_LABELS: Record<TranslationStyle, string> = {
  tu_nhien: 'Tự nhiên — tiếng Việt đời thường, dễ nghe',
  sat_nghia: 'Sát nghĩa — ưu tiên chính xác nhưng vẫn tự nhiên',
  dien_anh: 'Điện ảnh — lời thoại cảm xúc, phù hợp phim',
  anime: 'Anime / Manga',
  tien_hiep: 'Tiên hiệp / Xianxia — văn phong nhất quán thuật ngữ',
  game: 'Game — phong cách localization game',
};

export interface GlossaryEntry {
  term: string; // thuật ngữ gốc, vd "灵气" hoặc "mana"
  translation: string; // bản dịch cố định, vd "Linh Khí"
  note?: string;
}

export interface Character {
  id: string;
  name: string;
  gender?: string;
  age?: number;
  role?: string;
  personality?: string;
  /**
   * Cách xưng hô: key là id nhân vật đối diện, value là cách nhân vật này
   * gọi/xưng hô với người đó. Ví dụ A → B: "con", B → A: "sư phụ".
   */
  addressing?: Record<string, string>;
}

export interface TranslationCorrection {
  id: number;
  translation: string;
  changed: boolean;
  reason?: string;
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
