import { SubtitleEntry } from '../../types/subtitle.js';

function formatVttTimestamp(totalSeconds: number): string {
  const ms = Math.round(totalSeconds * 1000);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

export function exportVtt(subtitles: SubtitleEntry[]): string {
  const sorted = [...subtitles].filter((s) => s.translation && s.translation.trim().length > 0).sort((a, b) => a.start - b.start);

  const cues = sorted
    .map((s) => `${formatVttTimestamp(s.start)} --> ${formatVttTimestamp(s.end)}\n${s.translation}`)
    .join('\n\n');

  return `WEBVTT\n\n${cues}\n`;
}
