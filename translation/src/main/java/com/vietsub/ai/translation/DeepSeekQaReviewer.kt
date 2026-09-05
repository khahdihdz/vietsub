package com.vietsub.ai.translation

import com.vietsub.ai.core.util.RetryPolicy
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.translation.api.ChatCompletionRequest
import com.vietsub.ai.translation.api.ChatMessage
import com.vietsub.ai.translation.api.DeepSeekApiService
import com.vietsub.ai.translation.api.ResponseFormat
import com.vietsub.ai.translation.api.TranslationJsonOutput
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject

private const val QA_SYSTEM_PROMPT = """Bạn là biên tập viên QA phụ đề tiếng Việt.
Kiểm tra các lỗi: sai nghĩa, thiếu ý, thừa ý, tên riêng, chính tả, câu quá dài, câu không tự nhiên.
Chỉ trả về segment CẦN SỬA, đúng định dạng: {"segments":[{"id":<int>,"translation":"bản sửa"}]}.
Nếu một segment không có lỗi, KHÔNG đưa vào kết quả. Không thêm giải thích, không thêm markdown."""

/**
 * Spec §17: QA tuy chon, toi da 2 lan correction/segment, khong tao vong lap vo han.
 * Goi rieng voi tung batch segment (khong dung lai ChunkManager vi day la buoc QA
 * doc lap voi buoc dich, khong can previous/next context).
 */
class DeepSeekQaReviewer(
    private val service: DeepSeekApiService,
    private val model: String,
    private val temperature: Double,
    private val batchSize: Int = 20,
    private val maxCorrectionsPerSegment: Int = 2,
    private val maxRetries: Int = 3
) {
    private val json = Json { ignoreUnknownKeys = true }

    /** correctionCounts nen duoc caller giu xuyen suot cac lan goi (vd. luu trong project state). */
    suspend fun review(
        segments: List<SubtitleSegment>,
        correctionCounts: MutableMap<Int, Int>
    ): List<SubtitleSegment> {
        val result = segments.toMutableList()

        segments.chunked(batchSize).forEach { batch ->
            val eligible = batch.filter { (correctionCounts[it.id] ?: 0) < maxCorrectionsPerSegment }
            if (eligible.isEmpty()) return@forEach

            val outcome = RetryPolicy.withRetry(maxRetries) { callQa(eligible) }
            outcome.onSuccess { corrections ->
                corrections.forEach { corrected ->
                    val idx = result.indexOfFirst { it.id == corrected.id }
                    if (idx != -1) {
                        result[idx] = result[idx].copy(translatedText = corrected.translation.trim())
                        correctionCounts[corrected.id] = (correctionCounts[corrected.id] ?: 0) + 1
                    }
                }
            }
            // outcome.onFailure: bo qua batch nay, giu nguyen ban dich hien tai — QA la
            // buoc tang cuong, khong duoc phep lam hong ket qua da co san.
        }

        return result
    }

    private suspend fun callQa(batch: List<SubtitleSegment>) =
        run {
            val payload = buildJsonArray {
                batch.forEach { seg ->
                    add(buildJsonObject {
                        put("id", JsonPrimitive(seg.id))
                        put("original", JsonPrimitive(seg.originalText))
                        put("translation", JsonPrimitive(seg.translatedText))
                    })
                }
            }
            val request = ChatCompletionRequest(
                model = model,
                messages = listOf(
                    ChatMessage("system", QA_SYSTEM_PROMPT),
                    ChatMessage("user", payload.toString())
                ),
                temperature = temperature,
                responseFormat = ResponseFormat()
            )
            val response = service.chatCompletions(request)
            val content = response.choices.firstOrNull()?.message?.content ?: "{}"
            json.decodeFromString(TranslationJsonOutput.serializer(), content).segments
        }
}
