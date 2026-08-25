import { Character, GlossaryEntry, SubtitleEntry, TranslationStyle, TRANSLATION_STYLE_LABELS } from '../../types/subtitle.js';

/**
 * System prompt — không hard-code cứng trong TranslationService, để
 * PromptEngine (advanced settings ở UI) có thể override sau này.
 */
export const TRANSLATION_SYSTEM_PROMPT = `Bạn là biên tập viên phụ đề tiếng Việt chuyên nghiệp.

Nhiệm vụ của bạn là chuyển lời thoại từ ngôn ngữ nguồn sang tiếng Việt tự nhiên, chính xác và phù hợp hoàn toàn với ngữ cảnh.

TUYỆT ĐỐI KHÔNG dịch từng từ.
TUYỆT ĐỐI KHÔNG giữ nguyên cấu trúc câu của ngôn ngữ nguồn nếu điều đó khiến tiếng Việt cứng, máy móc hoặc không tự nhiên.

Trước khi dịch phải hiểu: ngữ cảnh, câu trước, câu sau, tình huống, nhân vật, quan hệ giữa các nhân vật, tuổi tác, vai vế, cảm xúc, giọng điệu, thể loại nội dung.

Ưu tiên cách diễn đạt mà một người Việt thực sự sẽ nói. Nếu có thành ngữ, tiếng lóng hoặc cách nói đặc biệt, hãy tìm cách diễn đạt tương đương trong tiếng Việt.

Không thêm thông tin không có trong bản gốc. Không bỏ mất thông tin quan trọng. Không tự ý giải thích. Không tự ý thay đổi ý nghĩa.
Không thay đổi ID subtitle. Không thay đổi timestamp. Không thay đổi speaker. Chỉ được thay đổi phần translation.

Bản dịch phải tự nhiên, mạch lạc, đúng ngữ cảnh và phù hợp với phong cách được lựa chọn.

Bạn PHẢI trả lời CHỈ bằng một object JSON hợp lệ, không kèm markdown, không kèm giải thích, đúng định dạng:
{"translations":[{"id":1,"translation":"..."},{"id":2,"translation":"..."}]}`;

export interface BuildTranslationPromptInput {
  prevContext: SubtitleEntry[];
  currentBatch: SubtitleEntry[];
  nextContext: SubtitleEntry[];
  characters: Character[];
  glossary: GlossaryEntry[];
  style: TranslationStyle;
}

function formatSubtitleLine(s: SubtitleEntry): string {
  const speaker = s.speaker ? ` [${s.speaker}]` : '';
  return `${s.id}.${speaker} ${s.original}`;
}

function formatCharacters(characters: Character[]): string {
  if (characters.length === 0) return '(không có thông tin nhân vật)';
  return characters
    .map((c) => {
      const parts = [
        `- ${c.name}`,
        c.gender ? `Giới tính: ${c.gender}` : null,
        c.age !== undefined ? `Tuổi: ${c.age}` : null,
        c.role ? `Vai trò: ${c.role}` : null,
        c.personality ? `Tính cách: ${c.personality}` : null,
      ].filter(Boolean);
      const addressing = c.addressing
        ? Object.entries(c.addressing)
            .map(([otherId, term]) => {
              const other = characters.find((x) => x.id === otherId);
              return `${c.name} gọi ${other?.name ?? otherId} là "${term}"`;
            })
            .join('; ')
        : '';
      return parts.join(' | ') + (addressing ? `\n  Xưng hô: ${addressing}` : '');
    })
    .join('\n');
}

function formatGlossary(glossary: GlossaryEntry[]): string {
  if (glossary.length === 0) return '(không có glossary)';
  return glossary.map((g) => `- "${g.term}" → "${g.translation}"${g.note ? ` (${g.note})` : ''}`).join('\n');
}

export function buildTranslationUserPrompt(input: BuildTranslationPromptInput): string {
  const { prevContext, currentBatch, nextContext, characters, glossary, style } = input;

  return `PHONG CÁCH DỊCH: ${TRANSLATION_STYLE_LABELS[style]}

GLOSSARY (phải tuân thủ tuyệt đối, không tự ý đổi cách dịch thuật ngữ đã có trong danh sách này):
${formatGlossary(glossary)}

NHÂN VẬT VÀ CÁCH XƯNG HÔ (phải duy trì nhất quán xuyên suốt):
${formatCharacters(characters)}

NGỮ CẢNH TRƯỚC (chỉ để tham khảo, KHÔNG dịch lại các dòng này):
${prevContext.length ? prevContext.map(formatSubtitleLine).join('\n') : '(không có)'}

CÁC DÒNG CẦN DỊCH (dịch tất cả các dòng dưới đây, giữ nguyên ID):
${currentBatch.map(formatSubtitleLine).join('\n')}

NGỮ CẢNH SAU (chỉ để tham khảo, KHÔNG dịch lại các dòng này):
${nextContext.length ? nextContext.map(formatSubtitleLine).join('\n') : '(không có)'}

Trả về JSON theo đúng schema đã nêu ở system prompt, chỉ chứa các ID nằm trong "CÁC DÒNG CẦN DỊCH".`;
}

export const PROOFREAD_SYSTEM_PROMPT = `Bạn là biên tập viên phụ đề tiếng Việt chuyên nghiệp, đang làm bước kiểm duyệt chất lượng (QA biên tập).

Với mỗi dòng được cung cấp, hãy kiểm tra bản dịch hiện tại so với bản gốc và ngữ cảnh, tìm các lỗi sau:
- Sai nghĩa
- Dịch máy móc, không tự nhiên
- Sai xưng hô so với thông tin nhân vật
- Sai thuật ngữ so với glossary
- Thiếu nội dung / thừa nội dung so với bản gốc
- Mâu thuẫn với ngữ cảnh trước/sau

Nếu bản dịch đã tốt, giữ nguyên. Nếu có lỗi, sửa lại cho tự nhiên và chính xác hơn.

Không thay đổi ID, không thêm dòng mới, không giải thích ngoài JSON.

Trả lời CHỈ bằng JSON:
{"translations":[{"id":1,"translation":"...","changed":true,"reason":"..."}]}
"changed" là true nếu bạn có sửa so với bản dịch hiện tại, false nếu giữ nguyên. "reason" ngắn gọn, có thể bỏ trống nếu changed=false.`;

export interface BuildProofreadPromptInput {
  prevContext: SubtitleEntry[];
  currentBatch: SubtitleEntry[]; // phải có .translation đã điền
  nextContext: SubtitleEntry[];
  characters: Character[];
  glossary: GlossaryEntry[];
  style: TranslationStyle;
}

export function buildProofreadUserPrompt(input: BuildProofreadPromptInput): string {
  const { prevContext, currentBatch, nextContext, characters, glossary, style } = input;

  const lines = currentBatch
    .map((s) => {
      const speaker = s.speaker ? ` [${s.speaker}]` : '';
      return `${s.id}.${speaker}\n  Gốc: ${s.original}\n  Đang dịch: ${s.translation ?? ''}`;
    })
    .join('\n');

  return `PHONG CÁCH DỊCH: ${TRANSLATION_STYLE_LABELS[style]}

GLOSSARY:
${formatGlossary(glossary)}

NHÂN VẬT:
${formatCharacters(characters)}

NGỮ CẢNH TRƯỚC:
${prevContext.length ? prevContext.map(formatSubtitleLine).join('\n') : '(không có)'}

CÁC DÒNG CẦN KIỂM TRA:
${lines}

NGỮ CẢNH SAU:
${nextContext.length ? nextContext.map(formatSubtitleLine).join('\n') : '(không có)'}`;
}
