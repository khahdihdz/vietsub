'use client';

import { useRef } from 'react';
import { QAIssue, SubtitleEntry } from '@/lib/types';
import { cps, formatTimecode } from '@/lib/format';

interface SubtitleTableProps {
  subtitles: SubtitleEntry[];
  issues: QAIssue[];
  activeSubtitleId?: number | null;
  onChangeField: (id: number, field: 'original' | 'translation', value: string) => void;
  onChangeTiming: (id: number, field: 'start' | 'end', value: number) => void;
  onSeek: (seconds: number) => void;
  onDelete: (id: number) => void;
}

export function SubtitleTable({
  subtitles,
  issues,
  activeSubtitleId,
  onChangeField,
  onChangeTiming,
  onSeek,
  onDelete,
}: SubtitleTableProps) {
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const issuesFor = (id: number) => issues.filter((i) => i.subtitleId === id);

  return (
    <div className="border border-hair rounded-lg overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-raised text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2 w-12">ID</th>
            <th className="px-3 py-2 w-40 font-mono">Thời gian</th>
            <th className="px-3 py-2 w-24">Speaker</th>
            <th className="px-3 py-2">Original</th>
            <th className="px-3 py-2">Tiếng Việt</th>
            <th className="px-3 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {subtitles.map((s) => {
            const rowIssues = issuesFor(s.id);
            const isActive = s.id === activeSubtitleId;
            const rowCps = s.translation ? cps(s.translation, s.end - s.start) : 0;

            return (
              <tr
                key={s.id}
                ref={(el) => {
                  rowRefs.current[s.id] = el;
                }}
                onClick={() => onSeek(s.start)}
                className={`border-t border-hair cursor-pointer transition-colors ${
                  isActive ? 'bg-teal/10' : 'hover:bg-surface'
                }`}
              >
                <td className="px-3 py-2 align-top font-mono text-muted">{s.id}</td>
                <td className="px-3 py-2 align-top font-mono text-xs text-muted">
                  <div className="flex flex-col gap-1">
                    <TimingInput value={s.start} onCommit={(v) => onChangeTiming(s.id, 'start', v)} />
                    <TimingInput value={s.end} onCommit={(v) => onChangeTiming(s.id, 'end', v)} />
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-xs text-muted">{s.speaker ?? '—'}</td>
                <td className="px-3 py-2 align-top text-ink/80" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    className="w-full bg-transparent resize-none focus:outline-none focus:bg-surface rounded px-1 py-0.5"
                    rows={2}
                    defaultValue={s.original}
                    onBlur={(e) => onChangeField(s.id, 'original', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    className="w-full bg-surface border border-hair rounded px-2 py-1 resize-none focus:outline-none focus:border-teal/60"
                    rows={2}
                    placeholder="Chưa dịch…"
                    defaultValue={s.translation ?? ''}
                    onBlur={(e) => onChangeField(s.id, 'translation', e.target.value)}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-wrap gap-1">
                      {rowIssues.map((issue, idx) => (
                        <span
                          key={idx}
                          title={issue.message}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/40"
                        >
                          ⚠ {issue.type}
                        </span>
                      ))}
                    </div>
                    {s.translation && <span className="text-[10px] font-mono text-muted">{rowCps.toFixed(1)} cps</span>}
                  </div>
                </td>
                <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="text-muted hover:text-danger transition-colors text-xs"
                    title="Xóa dòng này"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TimingInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  return (
    <input
      className="w-16 bg-transparent focus:bg-surface rounded px-1 focus:outline-none"
      defaultValue={formatTimecode(value)}
      onBlur={(e) => {
        const parsed = parseTimecode(e.target.value);
        if (parsed !== null) onCommit(parsed);
        else e.target.value = formatTimecode(value);
      }}
    />
  );
}

function parseTimecode(text: string): number | null {
  const match = /^(\d+):(\d+(?:\.\d+)?)$/.exec(text.trim());
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
}
