package com.vietsub.ai.domain.model

/**
 * One segment of recognized speech, as produced by a [com.vietsub.ai.domain.SpeechToTextEngine].
 * Timestamps are authoritative and are never rewritten by the translation step (spec §10).
 */
data class TranscriptSegment(
    val id: Int,
    val startMs: Long,
    val endMs: Long,
    val text: String
) {
    init {
        require(endMs > startMs) { "Segment $id: endMs ($endMs) must be greater than startMs ($startMs)" }
    }
}
