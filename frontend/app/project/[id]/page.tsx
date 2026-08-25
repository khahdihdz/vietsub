'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Character, GlossaryEntry, PipelineProgress, ProjectDetail, QAIssue, SubtitleEntry } from '@/lib/types';
import { UploadDropzone } from '@/components/UploadDropzone';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Timeline } from '@/components/Timeline';
import { SubtitleTable } from '@/components/SubtitleTable';
import { SidePanel } from '@/components/SidePanel';
import { ProgressRail } from '@/components/ProgressRail';

const HISTORY_LIMIT = 50;

export default function EditorPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // label of in-flight pipeline action
  const [uploading, setUploading] = useState(false);
  const [issues, setIssues] = useState<QAIssue[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSubtitleId, setActiveSubtitleId] = useState<number | null>(null);

  const [past, setPast] = useState<SubtitleEntry[][]>([]);
  const [future, setFuture] = useState<SubtitleEntry[][]>([]);

  const load = useCallback(() => {
    api
      .getProject(projectId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được project.'));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshQA = useCallback(async () => {
    try {
      const result = await api.runQA(projectId);
      setIssues(result.issues);
    } catch {
      /* QA không chạy được không nên chặn UI */
    }
  }, [projectId]);

  useEffect(() => {
    if (detail?.subtitles.length) refreshQA();
  }, [detail?.subtitles.length, refreshQA]);

  if (error) {
    return (
      <main className="min-h-screen bg-void flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-danger text-sm mb-2">{error}</p>
          <p className="text-muted text-xs">Kiểm tra backend đang chạy và NEXT_PUBLIC_API_BASE_URL đúng.</p>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-void flex items-center justify-center">
        <p className="text-muted text-sm">Đang tải project…</p>
      </main>
    );
  }

  const subtitles = detail.subtitles;

  const pushHistory = () => {
    setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), subtitles]);
    setFuture([]);
  };

  const applySubtitles = (next: SubtitleEntry[]) => {
    setDetail((d) => (d ? { ...d, subtitles: next } : d));
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [subtitles, ...f]);
    applySubtitles(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, subtitles]);
    applySubtitles(next);
  };

  const handleChangeField = async (id: number, field: 'original' | 'translation', value: string) => {
    pushHistory();
    const next = subtitles.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    applySubtitles(next);
    try {
      await api.updateSubtitle(projectId, id, { [field]: value });
      refreshQA();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu subtitle thất bại.');
    }
  };

  const handleChangeTiming = async (id: number, field: 'start' | 'end', value: number) => {
    pushHistory();
    const next = subtitles.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    applySubtitles(next);
    try {
      await api.updateSubtitle(projectId, id, { [field]: value });
      refreshQA();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu timestamp thất bại.');
    }
  };

  const handleDelete = async (id: number) => {
    pushHistory();
    applySubtitles(subtitles.filter((s) => s.id !== id));
    try {
      await api.deleteSubtitle(projectId, id);
      refreshQA();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xóa subtitle thất bại.');
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await api.uploadVideo(projectId, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime = seconds;
  };

  const seekToSubtitleId = (id: number) => {
    const target = subtitles.find((s) => s.id === id);
    if (target) seekTo(target.start);
  };

  const runPipelineStep = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      load();
      refreshQA();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${label} thất bại.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-void px-4 md:px-8 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">{detail.project.name}</h1>
          <p className="text-xs text-muted">{subtitles.length} dòng phụ đề</p>
        </div>
        <ProgressRail progress={detail.progress} />
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded bg-danger/10 border border-danger/40 text-danger text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-danger/70 hover:text-danger">
            ✕
          </button>
        </div>
      )}

      {!detail.video ? (
        <div className="max-w-xl mx-auto mt-16">
          <UploadDropzone onFileSelected={handleUpload} uploading={uploading} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="flex flex-col gap-4">
            <VideoPlayer
              ref={videoRef}
              src={api.videoStreamUrl(projectId)}
              subtitles={subtitles}
              onTimeUpdate={setCurrentTime}
              onCurrentSubtitleChange={(s) => setActiveSubtitleId(s?.id ?? null)}
            />

            <Timeline
              subtitles={subtitles}
              issues={issues}
              durationSeconds={detail.video.durationSeconds ?? 0}
              currentTime={currentTime}
              onSeek={seekTo}
            />

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                label="Bắt đầu Việt hóa"
                busyLabel="Đang dịch…"
                busy={busy}
                onClick={() => runPipelineStep('Đang dịch…', () => api.translate(projectId))}
                primary
              />
              <ActionButton
                label="✨ Cải thiện bản dịch"
                busyLabel="Đang proofread…"
                busy={busy}
                onClick={() => runPipelineStep('Đang proofread…', () => api.proofread(projectId))}
              />
              <ActionButton label="Chạy QA" busyLabel="Đang QA…" busy={busy} onClick={() => runPipelineStep('Đang QA…', refreshQA)} />
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={undo}
                  disabled={past.length === 0}
                  className="px-2.5 py-1.5 text-xs rounded border border-hair bg-surface hover:border-teal/50 disabled:opacity-30 transition-colors"
                >
                  ↶ Undo
                </button>
                <button
                  onClick={redo}
                  disabled={future.length === 0}
                  className="px-2.5 py-1.5 text-xs rounded border border-hair bg-surface hover:border-teal/50 disabled:opacity-30 transition-colors"
                >
                  ↷ Redo
                </button>
              </div>
            </div>

            <SubtitleTable
              subtitles={subtitles}
              issues={issues}
              activeSubtitleId={activeSubtitleId}
              onChangeField={handleChangeField}
              onChangeTiming={handleChangeTiming}
              onSeek={seekTo}
              onDelete={handleDelete}
            />
          </div>

          <SidePanel
            projectId={projectId}
            issues={issues}
            glossary={detail.glossary}
            characters={detail.characters}
            onSeekSubtitle={seekToSubtitleId}
            onAddGlossary={async (entry: GlossaryEntry) => {
              await api.addGlossary(projectId, entry);
              load();
            }}
            onRemoveGlossary={async (term: string) => {
              await api.removeGlossary(projectId, term);
              load();
            }}
            onUpsertCharacter={async (character: Character) => {
              await api.upsertCharacter(projectId, character);
              load();
            }}
            onRemoveCharacter={async (id: string) => {
              await api.removeCharacter(projectId, id);
              load();
            }}
          />
        </div>
      )}
    </main>
  );
}

function ActionButton({
  label,
  busyLabel,
  busy,
  onClick,
  primary,
}: {
  label: string;
  busyLabel: string;
  busy: string | null;
  onClick: () => void;
  primary?: boolean;
}) {
  const isBusy = busy === busyLabel;
  return (
    <button
      onClick={onClick}
      disabled={!!busy}
      className={`px-3.5 py-2 text-sm rounded border transition-colors disabled:opacity-50 ${
        primary
          ? 'bg-teal/20 text-teal border-teal/40 hover:bg-teal/30'
          : 'bg-surface text-ink border-hair hover:border-amber/50'
      }`}
    >
      {isBusy ? busyLabel : label}
    </button>
  );
}
