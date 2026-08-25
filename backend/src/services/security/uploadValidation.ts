import { extname, basename, resolve, sep } from 'node:path';

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm']);

// "Magic bytes" tối thiểu để xác thực định dạng thật của file, không chỉ dựa vào đuôi file
// (đuôi file có thể bị đổi tùy ý bởi người dùng).
const MAGIC_BYTE_CHECKS: Array<{ ext: string; check: (buf: Buffer) => boolean }> = [
  { ext: '.mp4', check: (b) => b.length > 11 && b.subarray(4, 8).toString('ascii') === 'ftyp' },
  { ext: '.mov', check: (b) => b.length > 11 && b.subarray(4, 8).toString('ascii') === 'ftyp' },
  { ext: '.webm', check: (b) => b.length > 3 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { ext: '.mkv', check: (b) => b.length > 3 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { ext: '.avi', check: (b) => b.length > 11 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 11).toString('ascii') === 'AVI' },
];

export class UploadValidationError extends Error {}

/** Loại bỏ path traversal (../, đường dẫn tuyệt đối) và ký tự nguy hiểm khỏi tên file. */
export function sanitizeFilename(originalName: string): string {
  const base = basename(originalName); // bỏ mọi thư mục cha trong tên file
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'video';
}

/** Đảm bảo đường dẫn đích thực sự nằm trong thư mục upload cho phép (chống path traversal). */
export function assertPathWithinDir(targetPath: string, allowedDir: string): void {
  const resolvedTarget = resolve(targetPath);
  const resolvedAllowed = resolve(allowedDir);
  if (!resolvedTarget.startsWith(resolvedAllowed + sep) && resolvedTarget !== resolvedAllowed) {
    throw new UploadValidationError('Đường dẫn file không hợp lệ (phát hiện path traversal).');
  }
}

export function assertAllowedExtension(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
    throw new UploadValidationError(
      `Định dạng "${ext}" không được hỗ trợ. Chỉ chấp nhận: ${Array.from(ALLOWED_VIDEO_EXTENSIONS).join(', ')}.`
    );
  }
  return ext;
}

/** Đọc vài chục byte đầu để xác thực magic bytes khớp với đuôi file khai báo. */
export function assertMagicBytesMatch(ext: string, headerBuffer: Buffer): void {
  const checkers = MAGIC_BYTE_CHECKS.filter((c) => c.ext === ext);
  if (checkers.length === 0) return; // không có rule cụ thể, bỏ qua (đã chặn bằng extension)
  const matches = checkers.some((c) => c.check(headerBuffer));
  if (!matches) {
    throw new UploadValidationError(
      `Nội dung file không khớp với định dạng "${ext}" khai báo. File có thể bị đổi đuôi.`
    );
  }
}

export function assertWithinSizeLimit(sizeBytes: number, maxMb: number): void {
  const maxBytes = maxMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    throw new UploadValidationError(`File vượt quá giới hạn ${maxMb}MB.`);
  }
}
