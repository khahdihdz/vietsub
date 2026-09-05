package com.vietsub.ai.stt.api

import kotlinx.serialization.Serializable

/**
 * Format "verbose_json" của Whisper API (chuẩn OpenAI-compatible). Timestamp ở đây
 * là giây (Float) — engine sẽ đổi sang ms khi map sang TranscriptSegment, vì
 * TranscriptSegment.startMs/endMs là nguồn timestamp duy nhất được tin dùng
 * xuyên suốt pipeline (spec §10).
 */
@Serializable
data class WhisperApiResponse(
    val text: String? = null,
    val language: String? = null,
    val duration: Float? = null,
    val segments: List<WhisperApiSegment> = emptyList()
)

@Serializable
data class WhisperApiSegment(
    val id: Int,
    val start: Float,
    val end: Float,
    val text: String
)
