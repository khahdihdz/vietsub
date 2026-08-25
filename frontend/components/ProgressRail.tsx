'use client';

import { PipelineProgress } from '@/lib/types';

const STEPS: Array<{ key: keyof Omit<PipelineProgress, 'projectId' | 'updatedAt'>; label: string }> = [
  { key: 'upload', label: 'Upload' },
  { key: 'stt', label: 'Speech-to-Text' },
  { key: 'segment', label: 'Phân đoạn' },
  { key: 'translate', label: 'Dịch' },
  { key: 'proofread', label: 'Proofread' },
  { key: 'qa', label: 'QA' },
  { key: 'export', label: 'Export' },
];

export function ProgressRail({ progress }: { progress: PipelineProgress }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto py-1">
      {STEPS.map((step, idx) => {
        const value = progress[step.key];
        const done = value >= 100;
        return (
          <div key={step.key} className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-center gap-1 w-16">
              <div className="relative w-8 h-8 rounded-full border border-hair flex items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full ${done ? 'bg-teal/20 border-teal' : value > 0 ? 'bg-amber/10' : ''}`}
                />
                <span className={`text-[10px] font-mono z-10 ${done ? 'text-teal' : 'text-muted'}`}>{value}%</span>
              </div>
              <span className="text-[10px] text-muted text-center leading-tight">{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && <div className="w-6 h-px bg-hair shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
