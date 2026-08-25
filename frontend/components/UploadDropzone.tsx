'use client';

import { useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  uploadedInfo?: { originalFilename: string; sizeBytes: number; durationSeconds?: number; width?: number; height?: number; codec?: string } | null;
}

const ACCEPTED = '.mp4,.mkv,.avi,.mov,.webm';

export function UploadDropzone({ onFileSelected, uploading, uploadedInfo }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFileSelected(file);
  };

  if (uploadedInfo) {
    return (
      <div className="border border-hair rounded-lg p-4 bg-surface">
        <p className="text-sm text-ink font-medium">{uploadedInfo.originalFilename}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted font-mono">
          <span>{formatBytes(uploadedInfo.sizeBytes)}</span>
          {uploadedInfo.durationSeconds && <span>{uploadedInfo.durationSeconds.toFixed(1)}s</span>}
          {uploadedInfo.width && uploadedInfo.height && (
            <span>
              {uploadedInfo.width}×{uploadedInfo.height}
            </span>
          )}
          {uploadedInfo.codec && <span>{uploadedInfo.codec}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 transition-colors ${
        dragOver ? 'border-teal bg-teal/5' : 'border-hair'
      }`}
    >
      <p className="text-ink text-sm">{uploading ? 'Đang tải lên…' : 'Kéo thả video vào đây'}</p>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-4 py-2 text-sm rounded bg-teal/20 text-teal border border-teal/40 hover:bg-teal/30 transition-colors disabled:opacity-50"
      >
        Chọn video
      </button>
      <p className="text-[11px] text-muted">MP4, MKV, AVI, MOV, WEBM</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
