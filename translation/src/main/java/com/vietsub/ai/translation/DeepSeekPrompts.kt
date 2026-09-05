package com.vietsub.ai.translation

import com.vietsub.ai.domain.model.TranscriptSegment
import com.vietsub.ai.domain.model.TranslationChunk
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject

/** Nguyen van spec §9 — khong duoc doi noi dung, day la hop dong hanh vi voi model. */
object DeepSeekPrompts {

    const val SYSTEM_PROMPT = """Bạn là một biên tập viên phụ đề chuyên nghiệp.

Nhiệm vụ:
Chuyển lời thoại gốc thành phụ đề tiếng Việt tự nhiên.

Yêu cầu:

1. Dịch đúng nghĩa.
2. Không dịch máy móc từng từ.
3. Không thêm thông tin không có trong bản gốc.
4. Không bỏ mất ý chính.
5. Giữ nguyên tên riêng nếu phù hợp.
6. Giữ nguyên số, thời gian, đơn vị và thuật ngữ quan trọng.
7. Không thay đổi ID segment.
8. Không thay đổi timestamp.
9. Mỗi segment chỉ trả về một bản dịch.
10. Không thêm markdown.
11. Không thêm lời giải thích.
12. Không đặt câu dịch trong dấu ngoặc kép.
13. Giữ sắc thái hội thoại.
14. Giữ tính hài hước nếu bản gốc hài hước.
15. Giữ sắc thái trang trọng nếu bản gốc trang trọng.
16. Xử lý tiếng lóng bằng cách diễn đạt tự nhiên trong tiếng Việt.
17. Không dịch tên nhân vật nếu đó là tên riêng.
18. Nếu câu bị chia thành nhiều segment, phải đảm bảo tính liên tục về ngữ nghĩa.
19. Ưu tiên tiếng Việt tự nhiên, dễ đọc trên màn hình."""

    /**
     * Spec §8: gui PREVIOUS_CONTEXT + CURRENT_CHUNK + NEXT_CONTEXT nhung chi yeu cau
     * dich CURRENT_CHUNK. Spec §10: yeu cau JSON { "segments": [{id, translation}] },
     * timestamp khong duoc de AI tu tao.
     */
    fun buildUserPrompt(chunk: TranslationChunk, sourceLanguage: String, targetLanguage: String): String {
        fun segList(segments: List<TranscriptSegment>) = buildJsonArray {
            segments.forEach { seg ->
                add(buildJsonObject {
                    put("id", JsonPrimitive(seg.id))
                    put("text", JsonPrimitive(seg.text))
                })
            }
        }

        val payload: JsonObject = buildJsonObject {
            put("source_language", JsonPrimitive(sourceLanguage))
            put("target_language", JsonPrimitive(targetLanguage))
            put("previous_context", segList(chunk.previousContext))
            put("current_chunk", segList(chunk.segments))
            put("next_context", segList(chunk.nextContext))
        }

        val payloadJson = Json.encodeToString(JsonObject.serializer(), payload)

        return """
Chỉ dịch CURRENT_CHUNK. previous_context và next_context chỉ để tham khảo ngữ cảnh,
KHÔNG được xuất hiện trong kết quả. Trả về đúng định dạng:
{"segments":[{"id":<int>,"translation":"..."}]}
Không thêm segment nào ngoài các id có trong current_chunk.

$payloadJson
        """.trimIndent()
    }
}
