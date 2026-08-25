'use client';

import { useState } from 'react';
import { Character } from '@/lib/types';

interface CharacterPanelProps {
  characters: Character[];
  onUpsert: (character: Character) => void;
  onRemove: (id: string) => void;
}

export function CharacterPanel({ characters, onUpsert, onRemove }: CharacterPanelProps) {
  const [draft, setDraft] = useState<Partial<Character>>({});

  const submit = () => {
    if (!draft.name?.trim()) return;
    const id = draft.id?.trim() || draft.name.trim().toLowerCase().replace(/\s+/g, '_');
    onUpsert({ id, name: draft.name.trim(), gender: draft.gender, age: draft.age, role: draft.role });
    setDraft({});
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={draft.name ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Tên nhân vật"
          className="bg-surface border border-hair rounded px-2 py-1.5 text-sm focus:outline-none focus:border-teal/60"
        />
        <input
          value={draft.role ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          placeholder="Vai trò (vd: Sư phụ)"
          className="bg-surface border border-hair rounded px-2 py-1.5 text-sm focus:outline-none focus:border-teal/60"
        />
        <input
          value={draft.gender ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
          placeholder="Giới tính"
          className="bg-surface border border-hair rounded px-2 py-1.5 text-sm focus:outline-none focus:border-teal/60"
        />
        <input
          type="number"
          value={draft.age ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
          placeholder="Tuổi"
          className="bg-surface border border-hair rounded px-2 py-1.5 text-sm focus:outline-none focus:border-teal/60"
        />
      </div>
      <button
        onClick={submit}
        className="self-start px-3 py-1.5 text-sm rounded bg-teal/20 text-teal border border-teal/40 hover:bg-teal/30 transition-colors"
      >
        Thêm nhân vật
      </button>

      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {characters.length === 0 && <p className="text-xs text-muted">Chưa có nhân vật nào.</p>}
        {characters.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-surface border border-hair text-sm">
            <span className="flex flex-col">
              <span className="text-ink">{c.name}</span>
              <span className="text-[11px] text-muted">
                {[c.role, c.gender, c.age ? `${c.age} tuổi` : null].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            <button onClick={() => onRemove(c.id)} className="text-muted hover:text-danger text-xs transition-colors">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
