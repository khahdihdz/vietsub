package com.vietsub.ai.domain.usecase

import com.vietsub.ai.domain.model.ChunkStatus
import com.vietsub.ai.domain.model.TranscriptSegment
import com.vietsub.ai.domain.model.TranslationChunk

/**
 * Spec §7: chia transcript thanh chunk 30-90s (mac dinh 60s), khong cat giua cau
 * neu co the. Spec §8: moi chunk mang theo PREVIOUS/NEXT context de giu ngu canh,
 * nhung engine dich chi duoc dich CURRENT chunk.
 */
class ChunkManager(
    private val targetChunkDurationMs: Long = 60_000,
    private val maxChunkDurationMs: Long = 90_000,
    private val contextSegmentCount: Int = 2
) {
    fun buildChunks(segments: List<TranscriptSegment>): List<TranslationChunk> {
        if (segments.isEmpty()) return emptyList()

        val groups = mutableListOf<List<TranscriptSegment>>()
        var current = mutableListOf<TranscriptSegment>()
        var currentStart = segments.first().startMs

        for (seg in segments) {
            if (current.isNotEmpty()) {
                val durationIfAdded = seg.endMs - currentStart
                val currentDuration = current.last().endMs - currentStart
                val endsWithSentencePunctuation = current.last().text.trim().lastOrNull() in listOf('.', '!', '?', '…')

                // Da du muc tieu (60s) VA ket thuc dung cau -> chot chunk o day.
                // Neu chua ket thuc cau, cho tiep toi khi cham max (90s) moi bat buoc cat.
                val shouldCloseAtTarget = currentDuration >= targetChunkDurationMs && endsWithSentencePunctuation
                val mustCloseAtMax = durationIfAdded > maxChunkDurationMs

                if (shouldCloseAtTarget || mustCloseAtMax) {
                    groups.add(current)
                    current = mutableListOf()
                    currentStart = seg.startMs
                }
            }
            current.add(seg)
        }
        if (current.isNotEmpty()) groups.add(current)

        return groups.mapIndexed { index, group ->
            TranslationChunk(
                chunkIndex = index,
                segments = group,
                previousContext = groups.getOrNull(index - 1)?.takeLast(contextSegmentCount) ?: emptyList(),
                nextContext = groups.getOrNull(index + 1)?.take(contextSegmentCount) ?: emptyList(),
                status = ChunkStatus.PENDING
            )
        }
    }
}
