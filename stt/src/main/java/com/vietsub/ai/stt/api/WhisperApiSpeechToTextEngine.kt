package com.vietsub.ai.stt.api

import com.vietsub.ai.core.util.RetryPolicy
import com.vietsub.ai.domain.SpeechToTextEngine
import com.vietsub.ai.domain.model.TranscriptSegment
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Whisper API (spec §4, muc 2 trong thu tu uu tien). Khong bao gio log API key
 * (HttpLoggingInterceptor chi bat o muc BASIC, khong log header/body).
 */
class WhisperApiSpeechToTextEngine(
    private val baseUrl: String,
    private val model: String,
    private val apiKeyProvider: () -> String?,
    private val timeoutSeconds: Long = 120,
    private val maxRetries: Int = 3
) : SpeechToTextEngine {

    private val service: WhisperApiService by lazy {
        val client = OkHttpClient.Builder()
            .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val key = apiKeyProvider()
                val request = if (key.isNullOrBlank()) chain.request() else {
                    chain.request().newBuilder().addHeader("Authorization", "Bearer $key").build()
                }
                chain.proceed(request)
            }
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            .build()

        val json = Json { ignoreUnknownKeys = true }
        Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaTypeOrNull()!!))
            .build()
            .create(WhisperApiService::class.java)
    }

    override suspend fun transcribe(audioFile: File, language: String?): List<TranscriptSegment> {
        val apiKey = apiKeyProvider()?.trim().orEmpty()\n        require(apiKey.isNotEmpty()) { "Chưa lưu API key — vào Settings và bấm Save API settings trước." }\n\n        val result = RetryPolicy.withRetry(maxRetries) {
            val filePart = MultipartBody.Part.createFormData(
                "file", audioFile.name, audioFile.asRequestBody("audio/mpeg".toMediaTypeOrNull())
            )
            val modelPart = model.toRequestBody("text/plain".toMediaTypeOrNull())
            val languagePart = language?.toRequestBody("text/plain".toMediaTypeOrNull())
            val formatPart = "verbose_json".toRequestBody("text/plain".toMediaTypeOrNull())

            service.transcribe(filePart, modelPart, languagePart, formatPart)
        }

        val response = result.getOrElse { throw it }

        // Timestamp giay -> ms; neu API khong tra segments (chi tra "text" phang),
        // coi ca file la 1 segment thay vi bia timestamp gia.
        return if (response.segments.isNotEmpty()) {
            response.segments.map {
                TranscriptSegment(
                    id = it.id,
                    startMs = (it.start * 1000).toLong(),
                    endMs = (it.end * 1000).toLong(),
                    text = it.text.trim()
                )
            }
        } else {
            val text = response.text?.trim().orEmpty()
            if (text.isEmpty()) emptyList()
            else listOf(
                TranscriptSegment(
                    id = 0,
                    startMs = 0,
                    endMs = ((response.duration ?: 1f) * 1000).toLong(),
                    text = text
                )
            )
        }
    }
}
