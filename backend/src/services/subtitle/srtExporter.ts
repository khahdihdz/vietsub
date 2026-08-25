import { SubtitleEntry } from '../../types/subtitle.js';

function formatSrtTimestamp(totalSeconds: number): string {
  const ms = Math.round(totalSeconds * 1000);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/**
 * Xuất SRT chuẩn (mục 17) — chỉ chứa text phụ đề thuần, không lẫn JSON/markdown.
 * Bỏ qua các dòng chưa có bản dịch để tránh xuất file lỗi.
 */
export function exportSrt(subtitles: SubtitleEntry[]): string {
  const sorted = [...subtitles].filter((s) => s.translation && s.translation.trim().length > 0).sort((a, b) => a.start - b.start);

  return sorted
    .map((s, index) => {
      const sequenceNumber = index + 1;
      return `${sequenceNumber}\n${formatSrtTimestamp(s.start)} --> ${formatSrtTimestamp(s.end)}\n${s.translation}\n`;
    })
    .join('\n');
}
