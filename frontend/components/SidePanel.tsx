'use client';

import { useState } from 'react';
import { Character, GlossaryEntry, QAIssue } from '@/lib/types';
import { QAPanel } from './QAPanel';
import { GlossaryPanel } from './GlossaryPanel';
import { CharacterPanel } from './CharacterPanel';
import { ExportPanel } from './ExportPanel';

type Tab = 'qa' | 'glossary' | 'character' | 'export';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'qa', label: 'QA' },
  { key: 'glossary', label: 'Glossary' },
  { key: 'character', label: 'Nhân vật' },
  { key: 'export', label: 'Export' },
];

interface SidePanelProps {
  projectId: string;
  issues: QAIssue[];
  glossary: GlossaryEntry[];
  characters: Character[];
  onSeekSubtitle: (id: number) => void;
  onAddGlossary: (entry: GlossaryEntry) => void;
  onRemoveGlossary: (term: string) => void;
  onUpsertCharacter: (character: Character) => void;
  onRemoveCharacter: (id: string) => void;
}

export function SidePanel(props: SidePanelProps) {
  const [tab, setTab] = useState<Tab>('qa');

  return (
    <div className="bg-raised border border-hair rounded-lg p-3 flex flex-col gap-3">
      <div className="flex gap-1 border-b border-hair pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              tab === t.key ? 'bg-teal/20 text-teal' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
            {t.key === 'qa' && props.issues.length > 0 && (
              <span className="ml-1 text-[10px] bg-danger/30 text-danger px-1 rounded">{props.issues.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'qa' && <QAPanel issues={props.issues} onSeekSubtitle={props.onSeekSubtitle} />}
      {tab === 'glossary' && (
        <GlossaryPanel glossary={props.glossary} onAdd={props.onAddGlossary} onRemove={props.onRemoveGlossary} />
      )}
      {tab === 'character' && (
        <CharacterPanel characters={props.characters} onUpsert={props.onUpsertCharacter} onRemove={props.onRemoveCharacter} />
      )}
      {tab === 'export' && <ExportPanel projectId={props.projectId} />}
    </div>
  );
}
