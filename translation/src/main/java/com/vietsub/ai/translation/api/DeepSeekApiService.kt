package com.vietsub.ai.translation.api

import retrofit2.http.Body
import retrofit2.http.POST

interface DeepSeekApiService {
    @POST("chat/completions")
    suspend fun chatCompletions(@Body request: ChatCompletionRequest): ChatCompletionResponse
}
