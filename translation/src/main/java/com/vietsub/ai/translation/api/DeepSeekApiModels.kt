package com.vietsub.ai.translation.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
data class ChatMessage(val role: String, val content: String)

@Serializable
data class ResponseFormat(val type: String = "json_object")

@Serializable
data class ChatCompletionRequest(
    val model: String,
    val messages: List<ChatMessage>,
    val temperature: Double = 0.2,
    val stream: Boolean = false,
    @SerialName("response_format") val responseFormat: ResponseFormat? = null
)

@Serializable
data class ChatCompletionResponse(
    val choices: List<ChatChoice> = emptyList()
)

@Serializable
data class ChatChoice(val message: ChatMessage)

/** Spec §10: JSON output ma DeepSeek phai tra ve, chi chua id + translation. */
@Serializable
data class TranslationJsonOutput(val segments: List<TranslatedSegmentDto> = emptyList())

@Serializable
data class TranslatedSegmentDto(val id: Int, val translation: String)
