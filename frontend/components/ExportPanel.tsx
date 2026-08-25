'use client';

import { useState } from 'react';
import { ASS_PRESET_LABELS, AssPreset } from '@/lib/types';
import { api } from '@/lib/api';

export function ExportPanel({ projectId }: { projectId: string }) {
  const [preset, setPreset] = useState<AssPreset>('default');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-muted block mb-1.5">Preset ASS (font, màu, viền, vị trí)</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(ASS_PRESET_LABELS) as AssPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                preset === p ? 'bg-teal/20 border-teal text-teal' : 'bg-surface border-hair text-muted hover:border-teal/40'
              }`}
            >
              {ASS_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={api.exportUrl(projectId, 'srt')}
          className="text-center px-3 py-2 text-sm rounded bg-surface border border-hair hover:border-teal/50 transition-colors"
        >
          Tải SRT
        </a>
        <a
          href={api.exportUrl(projectId, 'vtt')}
          className="text-center px-3 py-2 text-sm rounded bg-surface border border-hair hover:border-teal/50 transition-colors"
        >
          Tải VTT
        </a>
        <a
          href={api.exportUrl(projectId, 'ass', preset)}
          className="text-center px-3 py-2 text-sm rounded bg-surface border border-hair hover:border-teal/50 transition-colors"
        >
          Tải ASS ({ASS_PRESET_LABELS[preset]})
        </a>
      </div>
    </div>
  );
}
