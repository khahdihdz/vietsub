import { SubtitleEntry } from '../../types/subtitle.js';

/** Timestamp cấp từ, nếu engine STT hỗ trợ (vd Whisper với word_timestamps=true). */
export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
}

/** Một đoạn transcript thô từ STT (mục 4), trước khi đánh số thành subtitle cuối cùng. */
export interface TranscriptChunk {
  start: number;
  end: number;
  speaker?: string;
  text: string;
  /** Nếu có, dùng để chia chính xác theo thời gian thật của từng từ thay vì ước lượng theo tỉ lệ ký tự. */
  words?: TranscriptWord[];
}

export interface SegmentationOptions {
  maxCharsPerLine: number; // mỗi dòng hiển thị
  maxLinesPerSubtitle: number; // thường 1-2 dòng
  maxCps: number;
  minDurationSec: number;
  /** Không chia nhỏ hơn mức này dù còn dài — tránh mảnh vụn vô nghĩa khi không có dấu câu. */
  minSegmentChars: number;
}

export const DEFAULT_SEGMENTATION_OPTIONS: SegmentationOptions = {
  maxCharsPerLine: 42,
  maxLinesPerSubtitle: 2,
  maxCps: 20,
  minDurationSec: 0.7,
  minSegmentChars: 12,
};

// Ưu tiên tách tại dấu câu mạnh trước, rồi mới tới dấu phẩy — tránh cắt máy móc theo số ký tự.
const STRONG_BREAK_CHARS = ['.', '!', '?', '…'];
const WEAK_BREAK_CHARS = [',', ';', ':'];

/**
 * Tìm điểm tách gần vị trí `targetIndex` nhất trong `text`, ưu tiên dấu câu mạnh,
 * sau đó dấu phẩy, sau đó khoảng trắng — không bao giờ cắt giữa một từ.
 * Trả về -1 nếu không tìm được điểm tách nào hợp lệ (kể cả khoảng trắng).
 */
function findBreakPoint(text: string, targetIndex: number): number {
  const searchRadius = Math.max(15, Math.floor(text.length * 0.25));
  const lowerBound = Math.max(1, targetIndex - searchRadius);
  const upperBound = Math.min(text.length - 1, targetIndex + searchRadius);

  for (const chars of [STRONG_BREAK_CHARS, WEAK_BREAK_CHARS]) {
    let best = -1;
    let bestDistance = Infinity;
    for (let i = lowerBound; i <= upperBound; i++) {
      if (chars.includes(text[i])) {
        const distance = Math.abs(i - targetIndex);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }
    }
    if (best !== -1) return best + 1; // cắt ngay sau dấu câu
  }

  // Không có dấu câu phù hợp — tách tại khoảng trắng gần nhất để không cắt giữa từ
  for (let offset = 0; offset <= searchRadius; offset++) {
    const left = targetIndex - offset;
    const right = targetIndex + offset;
    if (left > 0 && text[left] === ' ') return left + 1;
    if (right < text.length && text[right] === ' ') return right + 1;
  }

  return -1; // không tách được — caller phải chấp nhận giữ nguyên
}

const capacityPerSubtitle = (opts: SegmentationOptions) => opts.maxCharsPerLine * opts.maxLinesPerSubtitle;

/**
 * QUAN TRỌNG — vì sao KHÔNG dùng CPS để quyết định có chia tiếp hay không:
 *
 * Khi không có timestamp cấp từ, thời gian của mỗi mảnh sau khi chia chỉ có thể
 * ước lượng theo tỉ lệ số ký tự so với mảnh gốc. Điều đó khiến CPS (ký tự/giây)
 * gần như KHÔNG ĐỔI qua mỗi lần chia — chia đôi văn bản cũng chia đôi thời lượng
 * được gán, nên tốc độ trung bình giữ nguyên. Nếu dùng "CPS vượt ngưỡng" làm điều
 * kiện đệ quy, thuật toán sẽ không bao giờ hội tụ và chẻ tới từng ký tự đơn lẻ
 * (bug thực tế đã gặp và sửa trong quá trình build — xem README phần Nhật ký sửa lỗi).
 *
 * CPS thật sự cao là đặc điểm của cả đoạn nói (nói nhanh), không phải lỗi do
 * chia sai — chỉ có thể sửa đúng bằng timestamp cấp từ thật (xem `words`) hoặc
 * bằng cách nới thời gian hiển thị sang khoảng lặng kế tiếp (việc này cần biết
 * subtitle liền sau, nằm ngoài phạm vi hàm chia 1 chunk). Vì vậy CPS ở đây chỉ
 * dùng để CẢNH BÁO qua QAService cho người dùng tự kiểm tra, không dùng để ép chia.
 */
function splitChunkByLength(chunk: TranscriptChunk, opts: SegmentationOptions): TranscriptChunk[] {
  const capacity = capacityPerSubtitle(opts);
  const text = chunk.text.trim();

  if (text.length <= capacity || text.length <= opts.minSegmentChars) {
    return [{ ...chunk, text }];
  }

  const duration = chunk.end - chunk.start;
  const targetIndex = Math.floor(text.length / 2);
  const breakPoint = findBreakPoint(text, targetIndex);

  if (breakPoint <= 0 || breakPoint >= text.length) {
    // Không tìm được điểm tách tự nhiên — giữ nguyên, để QAService cảnh báo "dòng quá dài"
    return [{ ...chunk, text }];
  }

  const leftText = text.slice(0, breakPoint).trim();
  const rightText = text.slice(breakPoint).trim();

  // Nếu một bên sau khi tách quá ngắn để có ý nghĩa, không tách (tránh mảnh vụn)
  if (leftText.length < opts.minSegmentChars || rightText.length < opts.minSegmentChars) {
    return [{ ...chunk, text }];
  }

  const ratio = leftText.length / text.length;
  const splitTime = chunk.start + duration * ratio;

  const left: TranscriptChunk = { start: chunk.start, end: splitTime, speaker: chunk.speaker, text: leftText };
  const right: TranscriptChunk = { start: splitTime, end: chunk.end, speaker: chunk.speaker, text: rightText };

  return [...splitChunkByLength(left, opts), ...splitChunkByLength(right, opts)];
}

/**
 * Khi có timestamp cấp từ (word-level), chia chính xác hơn: tìm từ gần điểm
 * tách nhất và dùng đúng thời gian bắt đầu/kết thúc của từ đó, thay vì ước lượng.
 */
function splitChunkByWords(
  chunk: { start: number; end: number; speaker?: string; text: string; words: TranscriptWord[] },
  opts: SegmentationOptions
): TranscriptChunk[] {
  const capacity = capacityPerSubtitle(opts);
  const text = chunk.text.trim();

  if (text.length <= capacity || chunk.words.length <= 1) {
    return [{ start: chunk.start, end: chunk.end, speaker: chunk.speaker, text }];
  }

  const targetIndex = Math.floor(text.length / 2);
  const breakPoint = findBreakPoint(text, targetIndex);
  if (breakPoint <= 0 || breakPoint >= text.length) {
    return [{ start: chunk.start, end: chunk.end, speaker: chunk.speaker, text }];
  }

  // Tìm từ mà điểm tách rơi vào, dựa trên vị trí ký tự tích lũy trong text gốc (nối bằng khoảng trắng)
  let charOffset = 0;
  let splitWordIndex = chunk.words.length - 1;
  for (let i = 0; i < chunk.words.length; i++) {
    charOffset += chunk.words[i].text.length + 1; // +1 cho khoảng trắng nối từ
    if (charOffset >= breakPoint) {
      splitWordIndex = i;
      break;
    }
  }

  const leftWords = chunk.words.slice(0, splitWordIndex + 1);
  const rightWords = chunk.words.slice(splitWordIndex + 1);

  if (leftWords.length === 0 || rightWords.length === 0) {
    return [{ start: chunk.start, end: chunk.end, speaker: chunk.speaker, text }];
  }

  const leftText = leftWords.map((w) => w.text).join(' ').trim();
  const rightText = rightWords.map((w) => w.text).join(' ').trim();

  if (leftText.length < opts.minSegmentChars || rightText.length < opts.minSegmentChars) {
    return [{ start: chunk.start, end: chunk.end, speaker: chunk.speaker, text }];
  }

  const left = { start: leftWords[0].start, end: leftWords[leftWords.length - 1].end, speaker: chunk.speaker, text: leftText, words: leftWords };
  const right = { start: rightWords[0].start, end: rightWords[rightWords.length - 1].end, speaker: chunk.speaker, text: rightText, words: rightWords };

  return [...splitChunkByWords(left, opts), ...splitChunkByWords(right, opts)];
}

function splitChunk(chunk: TranscriptChunk, opts: SegmentationOptions): TranscriptChunk[] {
  if (chunk.words && chunk.words.length > 0) {
    return splitChunkByWords({ ...chunk, words: chunk.words }, opts);
  }
  return splitChunkByLength(chunk, opts);
}

/**
 * Chuyển transcript thô (từ STT) thành danh sách SubtitleEntry cuối cùng,
 * đánh số ID tuần tự. Chỉ chia theo độ dài hiển thị (có thể chia chính xác
 * theo từ nếu có word-level timestamp); CPS cao được để lại cho QAService
 * cảnh báo, không dùng để ép chia (xem giải thích ở splitChunkByLength).
 */
export function segmentTranscript(
  chunks: TranscriptChunk[],
  options: Partial<SegmentationOptions> = {}
): SubtitleEntry[] {
  const opts: SegmentationOptions = { ...DEFAULT_SEGMENTATION_OPTIONS, ...options };
  const result: SubtitleEntry[] = [];
  let nextId = 1;

  for (const chunk of chunks) {
    const pieces = splitChunk(chunk, opts);
    for (const piece of pieces) {
      if (piece.text.length === 0) continue;
      result.push({
        id: nextId++,
        start: piece.start,
        end: piece.end,
        speaker: piece.speaker,
        original: piece.text,
      });
    }
  }

  return result;
}
