import { SubtitleEntry } from '../../types/subtitle.js';

export interface ContextWindow {
  prevContext: SubtitleEntry[];
  currentBatch: SubtitleEntry[];
  nextContext: SubtitleEntry[];
}

/**
 * Lấy N dòng trước + batch hiện tại + N dòng sau, dựa trên vị trí (index)
 * trong mảng toàn bộ subtitle của video/chunk — không dựa trên id, để tránh
 * lỗi nếu id không liên tục.
 */
export function buildContextWindow(
  allSubtitles: SubtitleEntry[],
  batchStartIndex: number,
  batchEndIndexExclusive: number,
  contextBefore: number,
  contextAfter: number
): ContextWindow {
  const prevStart = Math.max(0, batchStartIndex - contextBefore);
  const nextEnd = Math.min(allSubtitles.length, batchEndIndexExclusive + contextAfter);

  return {
    prevContext: allSubtitles.slice(prevStart, batchStartIndex),
    currentBatch: allSubtitles.slice(batchStartIndex, batchEndIndexExclusive),
    nextContext: allSubtitles.slice(batchEndIndexExclusive, nextEnd),
  };
}

export interface Chunk {
  /** index bắt đầu chunk (bao gồm overlap) trong mảng toàn bộ subtitle */
  startIndex: number;
  /** index kết thúc (exclusive), bao gồm overlap */
  endIndex: number;
  /** các subtitle thực sự cần dịch mới trong chunk này (không tính overlap đã dịch) */
  newStartIndex: number;
  newEndIndex: number;
}

/**
 * Chia video dài thành các chunk theo mục 20 của spec: mỗi chunk có
 * overlap với chunk trước để không mất ngữ cảnh ở ranh giới.
 *
 * Ví dụ chunkSize=100, overlap=5:
 *   Chunk 1: new 0–99
 *   Chunk 2: overlap 95–99 (đã dịch) + new 100–199
 */
export function buildChunks(totalSubtitles: number, chunkSize: number, overlap: number): Chunk[] {
  if (totalSubtitles <= 0) return [];
  const chunks: Chunk[] = [];
  let newStart = 0;

  while (newStart < totalSubtitles) {
    const newEnd = Math.min(totalSubtitles, newStart + chunkSize);
    const startIndex = Math.max(0, newStart - overlap);
    chunks.push({
      startIndex,
      endIndex: newEnd,
      newStartIndex: newStart,
      newEndIndex: newEnd,
    });
    newStart = newEnd;
  }

  return chunks;
}
