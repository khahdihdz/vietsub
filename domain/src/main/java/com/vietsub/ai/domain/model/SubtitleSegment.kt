package com.vietsub.ai.domain.model

enum class ChunkStatus { PENDING, PROCESSING, COMPLETED, FAILED }

/**
 * A translated subtitle line. startMs/endMs always come from the source
 * [TranscriptSegment] — the translation engine is never allowed to invent timing.
 */
data class SubtitleSegment(
    val id: Int,
    val startMs: Long,
    val endMs: Long,
    val originalText: String,
    val translatedText: String,
    val status: ChunkStatus = ChunkStatus.PENDING
) {
    init {
        require(endMs > startMs) { "Segment $id: endMs ($endMs) must be greater than startMs ($startMs)" }
    }
}

/** A group of consecutive TranscriptSegments sent to the translation engine together (spec §7). */
data class TranslationChunk(
    val chunkIndex: Int,
    val segments: List<TranscriptSegment>,
    val previousContext: List<TranscriptSegment> = emptyList(),
    val nextContext: List<TranscriptSegment> = emptyList(),
    val status: ChunkStatus = ChunkStatus.PENDING
)
