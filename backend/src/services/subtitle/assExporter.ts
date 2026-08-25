import { SubtitleEntry } from '../../types/subtitle.js';

export interface AssStyle {
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  primaryColor: string; // &HAABBGGRR (ASS color format)
  outlineColor: string;
  outline: number;
  shadow: number;
  /** Alignment theo numpad layout của ASS (1-9), 2 = bottom-center. */
  alignment: number;
  marginLeft: number;
  marginRight: number;
  marginVertical: number;
}

export const ASS_STYLE_PRESETS: Record<'default' | 'movie' | 'anime' | 'drama' | 'gaming', AssStyle> = {
  default: {
    fontName: 'Arial',
    fontSize: 28,
    bold: false,
    italic: false,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginLeft: 20,
    marginRight: 20,
    marginVertical: 30,
  },
  movie: {
    fontName: 'Be Vietnam Pro',
    fontSize: 26,
    bold: false,
    italic: false,
    primaryColor: '&H00F5F5F5',
    outlineColor: '&H00101010',
    outline: 2,
    shadow: 0,
    alignment: 2,
    marginLeft: 40,
    marginRight: 40,
    marginVertical: 40,
  },
  anime: {
    fontName: 'Be Vietnam Pro',
    fontSize: 30,
    bold: true,
    italic: false,
    primaryColor: '&H0000D7FF',
    outlineColor: '&H00000000',
    outline: 3,
    shadow: 1,
    alignment: 2,
    marginLeft: 20,
    marginRight: 20,
    marginVertical: 30,
  },
  drama: {
    fontName: 'Times New Roman',
    fontSize: 26,
    bold: false,
    italic: true,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    outline: 1,
    shadow: 2,
    alignment: 2,
    marginLeft: 30,
    marginRight: 30,
    marginVertical: 35,
  },
  gaming: {
    fontName: 'JetBrains Mono',
    fontSize: 26,
    bold: true,
    italic: false,
    primaryColor: '&H0000FF00',
    outlineColor: '&H00000000',
    outline: 2,
    shadow: 0,
    alignment: 2,
    marginLeft: 20,
    marginRight: 20,
    marginVertical: 25,
  },
};

function formatAssTimestamp(totalSeconds: number): string {
  const centiseconds = Math.round(totalSeconds * 100);
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const seconds = Math.floor((centiseconds % 6_000) / 100);
  const cs = centiseconds % 100;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
}

function escapeAssText(text: string): string {
  // ASS dùng \N cho xuống dòng cứng bên trong 1 dialogue line
  return text.replace(/\r\n|\r|\n/g, '\\N');
}

export function exportAss(subtitles: SubtitleEntry[], style: AssStyle = ASS_STYLE_PRESETS.default): string {
  const sorted = [...subtitles].filter((s) => s.translation && s.translation.trim().length > 0).sort((a, b) => a.start - b.start);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},&H00000000,${style.bold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},${style.marginLeft},${style.marginRight},${style.marginVertical},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = sorted
    .map(
      (s) =>
        `Dialogue: 0,${formatAssTimestamp(s.start)},${formatAssTimestamp(s.end)},Default,${s.speaker ?? ''},0,0,0,,${escapeAssText(
          s.translation!
        )}`
    )
    .join('\n');

  return `${header}\n${events}\n`;
}
