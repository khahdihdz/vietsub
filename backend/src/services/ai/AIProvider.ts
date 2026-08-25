export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  /** Bắt AI trả về JSON thuần, không kèm markdown/backticks/giải thích. */
  forceJson?: boolean;
}

/**
 * Abstraction để có thể đổi provider/model (vd sang model khác, hoặc
 * provider khác ngoài Vilao) mà không phải sửa toàn bộ ứng dụng.
 */
export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;
  chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
