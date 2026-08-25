'use client';

import { QAIssue, SubtitleEntry } from '@/lib/types';
import { formatTimecode } from '@/lib/format';

interface TimelineProps {
  subtitles: SubtitleEntry[];
  issues: QAIssue[];
  durationSeconds: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

const ERROR_ISSUE_TYPES = new Set(['overlap', 'end_before_start', 'cps_too_high', 'line_too_long']);

function statusColor(subtitle: SubtitleEntry, issues: QAIssue[]): string {
  const subIssues = issues.filter((i) => i.subtitleId === subtitle.id);
  if (subIssues.some((i) => ERROR_ISSUE_TYPES.has(i.type))) return 'bg-danger';
  if (subIssues.length > 0) return 'bg-amber';
  if (subtitle.translation) return 'bg-teal';
  return 'bg-hair';
}

/**
 * Dải thời gian dạng "timeline" của editing suite — mỗi khối là một subtitle,
 * màu sắc phản ánh trạng thái QA, độ rộng tỉ lệ với thời lượng thật. Click để
 * tua video tới đúng thời điểm đó (mục 15).
 */
export function Timeline({ subtitles, issues, durationSeconds, currentTime, onSeek }: TimelineProps) {
  const total = Math.max(durationSeconds, 1);
  const playheadPct = Math.min(100, (currentTime / total) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono text-muted">
        <span>00:00.0</span>
        <span>{formatTimecode(durationSeconds)}</span>
      </div>
      <div className="relative h-9 rounded-md bg-surface border border-hair overflow-hidden">
        {subtitles.map((s) => {
          const leftPct = (s.start / total) * 100;
          const widthPct = Math.max(((s.end - s.start) / total) * 100, 0.4);
          return (
            <button
              key={s.id}
              onClick={() => onSeek(s.start)}
              title={`#${s.id} ${formatTimecode(s.start)} — ${s.original}`}
              className={`absolute top-1 bottom-1 rounded-sm ${statusColor(s, issues)} opacity-80 hover:opacity-100 transition-opacity`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            />
          );
        })}
        <div
          className="absolute top-0 bottom-0 w-px bg-ink shadow-[0_0_6px_rgba(234,242,238,0.8)]"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
        <LegendDot className="bg-hair" label="Chưa dịch" />
        <LegendDot className="bg-teal" label="Đã dịch, không lỗi" />
        <LegendDot className="bg-amber" label="Cảnh báo nhẹ" />
        <LegendDot className="bg-danger" label="Lỗi cần sửa" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
