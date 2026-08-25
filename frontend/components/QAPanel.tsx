'use client';

import { QAIssue } from '@/lib/types';

export function QAPanel({ issues, onSeekSubtitle }: { issues: QAIssue[]; onSeekSubtitle: (id: number) => void }) {
  if (issues.length === 0) {
    return <p className="text-sm text-ok">✓ Không phát hiện lỗi QA nào.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
      {issues.map((issue, idx) => (
        <button
          key={idx}
          onClick={() => onSeekSubtitle(issue.subtitleId)}
          className="text-left px-2.5 py-2 rounded bg-surface border border-hair hover:border-danger/50 transition-colors text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-muted">#{issue.subtitleId}</span>
            <span className="text-danger">{issue.type}</span>
          </div>
          <p className="text-ink/80 mt-0.5">{issue.message}</p>
        </button>
      ))}
    </div>
  );
}
