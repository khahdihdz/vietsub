package com.vietsub.ai.stt.api

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface WhisperApiService {
    /**
     * Multipart upload tới /audio/transcriptions (chuẩn OpenAI-compatible, dùng chung
     * cho Whisper API tự host hoặc dịch vụ tương thích). baseUrl lấy từ SttConfig,
     * configurable trong Settings — không hard-code.
     */
    @Multipart
    @POST("audio/transcriptions")
    suspend fun transcribe(
        @Part file: MultipartBody.Part,
        @Part("model") model: RequestBody,
        @Part("language") language: RequestBody?,
        @Part("response_format") responseFormat: RequestBody
    ): WhisperApiResponse
}
