import { spawn } from 'node:child_process';

export interface VideoProbeInfo {
  durationSeconds?: number;
  width?: number;
  height?: number;
  format?: string;
  codec?: string;
  fps?: number;
}

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

/**
 * Lấy thông tin video thật bằng ffprobe (mục 2 — hiển thị dung lượng, thời lượng,
 * độ phân giải, định dạng, codec sau khi upload).
 */
export async function probeVideo(filePath: string): Promise<VideoProbeInfo> {
  const { stdout, code, stderr } = await runCommand('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,format_name:stream=width,height,codec_name,r_frame_rate',
    '-of',
    'json',
    filePath,
  ]);

  if (code !== 0) {
    throw new Error(`ffprobe thất bại: ${stderr.slice(0, 500)}`);
  }

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<{ width?: number; height?: number; codec_name?: string; r_frame_rate?: string }>;
  };

  const videoStream = parsed.streams?.find((s) => s.width && s.height);
  let fps: number | undefined;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (den) fps = num / den;
  }

  return {
    durationSeconds: parsed.format?.duration ? parseFloat(parsed.format.duration) : undefined,
    width: videoStream?.width,
    height: videoStream?.height,
    format: parsed.format?.format_name,
    codec: videoStream?.codec_name,
    fps,
  };
}

/** Trích audio từ video sang WAV 16kHz mono — định dạng phổ biến nhất cho các engine STT. */
export async function extractAudio(inputVideoPath: string, outputAudioPath: string): Promise<void> {
  const { code, stderr } = await runCommand('ffmpeg', [
    '-y',
    '-i',
    inputVideoPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-f',
    'wav',
    outputAudioPath,
  ]);
  if (code !== 0) {
    throw new Error(`ffmpeg trích audio thất bại: ${stderr.slice(0, 500)}`);
  }
}

export interface BurnSubtitleOptions {
  inputVideoPath: string;
  assSubtitlePath: string;
  outputVideoPath: string;
  /** Giữ nguyên chất lượng gốc càng nhiều càng tốt (mục 19) — dùng CRF thấp thay vì copy vì burn-in luôn cần re-encode video stream. */
  crf?: number;
  onProgress?: (percentDone: number) => void;
}

/**
 * Burn phụ đề ASS vào video bằng FFmpeg filter `ass`, giữ FPS gốc và copy
 * nguyên audio stream (không re-encode audio → không mất chất lượng âm thanh).
 */
export async function burnSubtitle(options: BurnSubtitleOptions): Promise<void> {
  const { inputVideoPath, assSubtitlePath, outputVideoPath, crf = 18, onProgress } = options;

  // Escape đường dẫn cho ffmpeg filter (dấu : và \ cần escape trong filtergraph)
  const escapedAssPath = assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');

  const args = [
    '-y',
    '-i',
    inputVideoPath,
    '-vf',
    `ass=${escapedAssPath}`,
    '-c:v',
    'libx264',
    '-crf',
    String(crf),
    '-preset',
    'medium',
    '-c:a',
    'copy',
    '-progress',
    'pipe:1',
    outputVideoPath,
  ];

  await new Promise<void>((resolveP, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/out_time_ms=(\d+)/);
      if (match && onProgress) {
        // Không biết tổng thời lượng chính xác ở đây; caller có thể tính % dựa trên duration đã probe trước đó.
        onProgress(parseInt(match[1], 10));
      }
    });
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolveP();
      else reject(new Error(`ffmpeg burn-in thất bại (exit ${code}): ${stderr.slice(-1000)}`));
    });
  });
}
