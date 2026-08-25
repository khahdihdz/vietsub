'use client';

import { forwardRef, useEffect, useState } from 'react';
import { SubtitleEntry } from '@/lib/types';

interface VideoPlayerProps {
  src: string;
  subtitles: SubtitleEntry[];
  onTimeUpdate: (currentTime: number) => void;
  onCurrentSubtitleChange?: (subtitle: SubtitleEntry | null) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer(
  { src, subtitles, onTimeUpdate, onCurrentSubtitleChange },
  ref
) {
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleEntry | null>(null);

  const videoEl = () => (ref as React.RefObject<HTMLVideoElement>).current;

  const handleTimeUpdate = () => {
    const el = videoEl();
    if (!el) return;
    onTimeUpdate(el.currentTime);
    const active = subtitles.find((s) => el.currentTime >= s.start && el.currentTime < s.end) ?? null;
    if (active?.id !== currentSubtitle?.id) {
      setCurrentSubtitle(active);
      onCurrentSubtitleChange?.(active);
    }
  };

  const nudge = (deltaSeconds: number) => {
    const el = videoEl();
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime + deltaSeconds);
  };

  const seekRelative = (direction: 1 | -1) => {
    const el = videoEl();
    if (!el) return;
    const idx = subtitles.findIndex((s) => s.id === currentSubtitle?.id);
    const targetIdx = idx === -1 ? (direction === 1 ? 0 : -1) : idx + direction;
    const target = subtitles[targetIdx];
    if (target) el.currentTime = target.start;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative bg-black rounded-lg overflow-hidden border border-hair">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={ref}
          src={src}
          controls
          onTimeUpdate={handleTimeUpdate}
          className="w-full max-h-[420px] bg-black"
        />
        {currentSubtitle?.translation && (
          <div className="pointer-events-none absolute bottom-14 left-0 right-0 flex justify-center px-6">
            <span className="bg-black/70 text-ink text-sm md:text-base px-3 py-1 rounded font-medium text-center max-w-[90%]">
              {currentSubtitle.translation}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PlayerButton onClick={() => seekRelative(-1)} label="◀◀ Dòng trước" />
        <PlayerButton onClick={() => nudge(-0.5)} label="-0.5s" />
        <PlayerButton onClick={() => nudge(-0.1)} label="-0.1s" />
        <PlayerButton onClick={() => nudge(0.1)} label="+0.1s" />
        <PlayerButton onClick={() => nudge(0.5)} label="+0.5s" />
        <PlayerButton onClick={() => seekRelative(1)} label="Dòng sau ▶▶" />
      </div>
    </div>
  );
});

function PlayerButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-xs font-mono rounded border border-hair bg-surface hover:bg-raised hover:border-teal/50 transition-colors"
    >
      {label}
    </button>
  );
}
