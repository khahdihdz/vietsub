import { z } from 'zod';

export const TranslationItemSchema = z.object({
  id: z.number(),
  translation: z.string(),
});

export const TranslationResponseSchema = z.object({
  translations: z.array(TranslationItemSchema),
});

export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;

export const ProofreadItemSchema = z.object({
  id: z.number(),
  translation: z.string(),
  changed: z.boolean().optional().default(false),
  reason: z.string().optional().default(''),
});

export const ProofreadResponseSchema = z.object({
  translations: z.array(ProofreadItemSchema),
});

export type ProofreadResponse = z.infer<typeof ProofreadResponseSchema>;

/**
 * Bóc JSON ra khỏi response AI có thể bị bọc trong ```json ... ``` hoặc
 * có text thừa trước/sau. Không sửa nội dung translation, chỉ tìm ranh giới
 * object JSON hợp lệ.
 */
export function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }
  return raw.trim();
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseTranslationResponse(raw: string): ParseResult<TranslationResponse> {
  return parseWithSchema<TranslationResponse>(raw, TranslationResponseSchema);
}

export function parseProofreadResponse(raw: string): ParseResult<ProofreadResponse> {
  return parseWithSchema<ProofreadResponse>(raw, ProofreadResponseSchema);
}

function parseWithSchema<T>(raw: string, schema: z.ZodTypeAny): ParseResult<T> {
  const jsonText = extractJsonBlock(raw);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (err) {
    return { ok: false, error: `JSON không hợp lệ: ${(err as Error).message}` };
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false, error: `Schema không khớp: ${result.error.message}` };
  }
  return { ok: true, data: result.data as T };
}
