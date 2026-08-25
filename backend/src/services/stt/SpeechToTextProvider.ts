export interface SttSegment {
  start: number;
  end: number;
  speaker?: string;
  text: string;
  /** Nếu engine hỗ trợ word-level timestamp (vd Whisper word_timestamps=true) — giúp segmentation chia chính xác hơn. */
  words?: Array<{ start: number; end: number; text: string }>;
}

/**
 * Abstraction cho engine STT (mục 4) — cho phép thay engine sau này
 * (Whisper API, whisper.cpp local, engine của Vilao, v.v.) mà không phải
 * sửa route hay TranslationService.
 */
export interface SpeechToTextProvider {
  readonly providerName: string;
  transcribe(audioFilePath: string): Promise<SttSegment[]>;
}

export class SttNotConfiguredError extends Error {
  constructor() {
    super(
      'Chưa cấu hình Speech-to-Text engine thật. Theo yêu cầu "không fake kết quả" (mục 30 của spec), ' +
        'hệ thống không tự sinh transcript giả. Hãy implement interface SpeechToTextProvider với một ' +
        'engine thật (vd whisper.cpp chạy local, Whisper API, hoặc engine STT của Vilao nếu có) và đăng ký ' +
        'nó thay cho NotConfiguredSttProvider trong app.ts.'
    );
    this.name = 'SttNotConfiguredError';
  }
}

/**
 * Provider mặc định — cố tình throw thay vì trả kết quả giả. Sandbox dùng để
 * viết code này không có sẵn engine STT (không có model Whisper cài sẵn,
 * không có quyền gọi API STT bên ngoài qua egress), nên việc "giả lập" sẽ vi
 * phạm đúng yêu cầu quan trọng nhất của spec: không fake kết quả AI.
 */
export class NotConfiguredSttProvider implements SpeechToTextProvider {
  readonly providerName = 'not-configured';

  async transcribe(_audioFilePath: string): Promise<SttSegment[]> {
    throw new SttNotConfiguredError();
  }
}
