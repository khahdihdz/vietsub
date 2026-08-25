'use client';

import { useState } from 'react';
import { GlossaryEntry } from '@/lib/types';

interface GlossaryPanelProps {
  glossary: GlossaryEntry[];
  onAdd: (entry: GlossaryEntry) => void;
  onRemove: (term: string) => void;
}

export function GlossaryPanel({ glossary, onAdd, onRemove }: GlossaryPanelProps) {
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');

  const submit = () => {
    if (!term.trim() || !translation.trim()) return;
    onAdd({ term: term.trim(), translation: translation.trim() });
    setTerm('');
    setTranslation('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Thuật ngữ gốc"
          className="flex-1 bg-surface border border-hair rounded px-2 py-1.5 text-sm focus:outline-none focus:border-teal/60"
        />
        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Bản dịch"
          className="flex-1 bg-surface border border-hair rounded px-2 py-1.5 text-sm focus:outline-none focus:border-teal/60"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          onClick={submit}
          className="px-3 py-1.5 text-sm rounded bg-teal/20 text-teal border border-teal/40 hover:bg-teal/30 transition-colors"
        >
          Thêm
        </button>
      </div>

      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {glossary.length === 0 && <p className="text-xs text-muted">Chưa có thuật ngữ nào.</p>}
        {glossary.map((g) => (
          <div key={g.term} className="flex items-center justify-between px-2 py-1.5 rounded bg-surface border border-hair text-sm">
            <span>
              <span className="text-ink">{g.term}</span>
              <span className="text-muted mx-1.5">→</span>
              <span className="text-teal">{g.translation}</span>
            </span>
            <button onClick={() => onRemove(g.term)} className="text-muted hover:text-danger text-xs transition-colors">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
