import { loadConfig, requireVilaoApiKey } from '../../config/env.js';
import { AIProvider, AIProviderError, ChatCompletionOptions, ChatMessage } from './AIProvider.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Provider thật cho Vilao API (OpenAI-compatible) chạy model
 * deepseek/deepseek-v4-pro. API key CHỈ được đọc từ env ở backend,
 * không bao giờ nhận từ request body/query của client.
 */
export class VilaoProvider implements AIProvider {
  readonly providerName = 'vilao';
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor() {
    const config = loadConfig();
    this.apiKey = requireVilaoApiKey();
    this.baseUrl = config.vilao.baseUrl.replace(/\/+$/, '');
    this.modelName = config.vilao.model;
    this.maxRetries = config.ai.maxRetries;
    this.retryBaseDelayMs = config.ai.retryBaseDelayMs;
  }

  async chatCompletion(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<string> {
    const body = {
      model: this.modelName,
      messages,
      temperature: options.temperature ?? 0.3,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.forceJson ? { response_format: { type: 'json_object' } } : {}),
    };

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new AIProviderError(
            `Vilao API trả lỗi HTTP ${response.status}: ${text.slice(0, 500)}`,
            response.status
          );
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.length === 0) {
          throw new AIProviderError('Vilao API trả về response không có nội dung.');
        }
        return content;
      } catch (err) {
        lastError = err;
        const isLastAttempt = attempt === this.maxRetries;
        // Không retry với lỗi 4xx do request sai (trừ 429 rate limit)
        if (err instanceof AIProviderError && err.statusCode && err.statusCode < 500 && err.statusCode !== 429) {
          throw err;
        }
        if (isLastAttempt) break;
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    throw new AIProviderError(
      `Gọi Vilao API thất bại sau ${this.maxRetries + 1} lần thử.`,
      undefined,
      lastError
    );
  }
}
