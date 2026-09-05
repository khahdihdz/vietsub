package com.vietsub.ai.translation

import com.vietsub.ai.core.util.RetryPolicy
import com.vietsub.ai.domain.ChunkStateStore
import com.vietsub.ai.domain.TranslationEngine
import com.vietsub.ai.domain.model.ChunkStatus
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.domain.model.TranscriptSegment
import com.vietsub.ai.domain.model.TranslationChunk
import com.vietsub.ai.domain.usecase.ChunkManager
import com.vietsub.ai.translation.api.ChatCompletionRequest
import com.vietsub.ai.translation.api.ChatMessage
import com.vietsub.ai.translation.api.DeepSeekApiService
import com.vietsub.ai.translation.api.ResponseFormat
import com.vietsub.ai.translation.api.TranslationJsonOutput
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Spec §7-§13: chia chunk 30-90s, gui context truoc/sau nhung chi dich chunk hien
 * tai, retry 1s/2s/4s, luu ket qua tung chunk ngay khi xong de resume duoc sau khi
 * app bi kill — khong dich lai chunk COMPLETED.
 */
class DeepSeekTranslationEngine(
    private val projectId: String,
    baseUrl: String,
    private val model: String,
    private val temperature: Double,
    private val apiKeyProvider: () -> String?,
    private val chunkStateStore: ChunkStateStore,
    private val maxRetries: Int = 3,
    timeoutSeconds: Long = 60,
    private val chunkManager: ChunkManager = ChunkManager(),
    private val onChunkProgress: suspend (completed: Int, total: Int) -> Unit = { _, _ -> }
) : TranslationEngine {

    private val json = Json { ignoreUnknownKeys = true }

    internal val service: DeepSeekApiService by lazy {
        val client = OkHttpClient.Builder()
            .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val key = apiKeyProvider()
                val req = if (key.isNullOrBlank()) chain.request()
                else chain.request().newBuilder().addHeader("Authorization", "Bearer $key").build()
                chain.proceed(req)
            }
            // BASIC: khong log body/header -> khong bao gio ghi API key ra Logcat (spec §3, §27)
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            .build()

        Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaTypeOrNull()!!))
            .build()
            .create(DeepSeekApiService::class.java)
    }

    override suspend fun translate(
        segments: List<TranscriptSegment>,
        sourceLanguage: String,
        targetLanguage: String
    ): List<SubtitleSegment> {
        val chunks = chunkManager.buildChunks(segments)
        val results = mutableListOf<SubtitleSegment>()

        chunks.forEachIndexed { idx, chunk ->
            val existing = chunkStateStore.getStatus(projectId, chunk.chunkIndex)
            if (existing == ChunkStatus.COMPLETED) {
                chunkStateStore.getCompletedResult(projectId, chunk.chunkIndex)?.let {
                    results += it
                    onChunkProgress(idx + 1, chunks.size)
                    return@forEachIndexed
                }
            }

            chunkStateStore.markStatus(projectId, chunk.chunkIndex, ChunkStatus.PROCESSING)

            val outcome = RetryPolicy.withRetry(maxRetries) {
                translateChunk(chunk, sourceLanguage, targetLanguage)
            }

            outcome.fold(
                onSuccess = { translated ->
                    chunkStateStore.saveChunkResult(projectId, chunk.chunkIndex, translated)
                    chunkStateStore.markStatus(projectId, chunk.chunkIndex, ChunkStatus.COMPLETED)
                    results += translated
                },
                onFailure = {
                    chunkStateStore.markStatus(projectId, chunk.chunkIndex, ChunkStatus.FAILED)
                    // Khong throw ngay — cho phep cac chunk khac tiep tuc chay, nguoi dung
                    // dung nut "Retry Failed Chunks" (spec §12) de xu ly rieng chunk loi.
                }
            )
            onChunkProgress(idx + 1, chunks.size)
        }

        return results.sortedBy { it.id }
    }

    private suspend fun translateChunk(
        chunk: TranslationChunk,
        sourceLanguage: String,
        targetLanguage: String
    ): List<SubtitleSegment> {
        val request = ChatCompletionRequest(
            model = model,
            messages = listOf(
                ChatMessage(role = "system", content = DeepSeekPrompts.SYSTEM_PROMPT),
                ChatMessage(role = "user", content = DeepSeekPrompts.buildUserPrompt(chunk, sourceLanguage, targetLanguage))
            ),
            temperature = temperature,
            responseFormat = ResponseFormat()
        )

        val response = service.chatCompletions(request)
        val content = response.choices.firstOrNull()?.message?.content
            ?: error("DeepSeek trả về response rỗng")

        val parsed = try {
            json.decodeFromString(TranslationJsonOutput.serializer(), content)
        } catch (e: Exception) {
            error("JSON response không hợp lệ từ DeepSeek: ${e.message}")
        }

        val translatedById = parsed.segments.associateBy { it.id }

        // Spec §16 (kiem tra co ban ngay tai day, validator day du la Phase 5):
        // so luong segment dau ra phai khop dau vao, timestamp luon lay tu transcript goc.
        return chunk.segments.map { seg ->
            val translation = translatedById[seg.id]?.translation?.trim()
                ?: error("Thiếu bản dịch cho segment id=${seg.id}")
            SubtitleSegment(
                id = seg.id,
                startMs = seg.startMs,
                endMs = seg.endMs,
                originalText = seg.text,
                translatedText = translation,
                status = ChunkStatus.COMPLETED
            )
        }
    }
}
