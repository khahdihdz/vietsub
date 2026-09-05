package com.vietsub.ai.subtitle

import com.vietsub.ai.domain.model.ChunkStatus
import com.vietsub.ai.domain.model.SubtitleSegment

/**
 * Spec §20: Edit text, Edit timestamp, Split segment, Merge segment, Add segment,
 * Delete segment. Moi ham thuan (khong mutate input), tra ve danh sach moi da sap
 * xep theo startMs — de SubtitleEditorViewModel de dang push vao undo/redo stack.
 */
object SubtitleEditOps {

    private fun nextId(segments: List<SubtitleSegment>): Int = (segments.maxOfOrNull { it.id } ?: -1) + 1

    fun editText(segments: List<SubtitleSegment>, id: Int, newText: String): List<SubtitleSegment> =
        segments.map { if (it.id == id) it.copy(translatedText = newText) else it }

    fun editTimestamp(segments: List<SubtitleSegment>, id: Int, newStartMs: Long, newEndMs: Long): List<SubtitleSegment> {
        require(newEndMs > newStartMs) { "endMs phải lớn hơn startMs" }
        return segments.map { if (it.id == id) it.copy(startMs = newStartMs, endMs = newEndMs) else it }
            .sortedBy { it.startMs }
    }

    /** Chia segment tại splitAtCharIndex (trong translatedText) và splitAtMs (mốc thời gian). */
    fun splitSegment(segments: List<SubtitleSegment>, id: Int, splitAtCharIndex: Int, splitAtMs: Long): List<SubtitleSegment> {
        val target = segments.find { it.id == id } ?: return segments
        require(splitAtMs in (target.startMs + 1) until target.endMs) { "splitAtMs phải nằm trong khoảng segment" }
        val text = target.translatedText
        val cut = splitAtCharIndex.coerceIn(0, text.length)
        val firstText = text.substring(0, cut).trim()
        val secondText = text.substring(cut).trim()

        val first = target.copy(endMs = splitAtMs, translatedText = firstText.ifEmpty { text })
        val second = target.copy(
            id = nextId(segments),
            startMs = splitAtMs,
            translatedText = secondText.ifEmpty { "..." },
            status = ChunkStatus.COMPLETED
        )
        return (segments.filterNot { it.id == id } + first + second).sortedBy { it.startMs }
    }

    /** Gộp 2 segment liền kề: giữ id nhỏ hơn, nối text, mốc thời gian bao trùm cả 2. */
    fun mergeSegments(segments: List<SubtitleSegment>, firstId: Int, secondId: Int): List<SubtitleSegment> {
        val a = segments.find { it.id == firstId } ?: return segments
        val b = segments.find { it.id == secondId } ?: return segments
        val (early, late) = if (a.startMs <= b.startMs) a to b else b to a

        val merged = early.copy(
            endMs = maxOf(a.endMs, b.endMs),
            originalText = "${early.originalText} ${late.originalText}".trim(),
            translatedText = "${early.translatedText} ${late.translatedText}".trim()
        )
        return (segments.filterNot { it.id == firstId || it.id == secondId } + merged).sortedBy { it.startMs }
    }

    fun addSegment(segments: List<SubtitleSegment>, startMs: Long, endMs: Long, text: String): List<SubtitleSegment> {
        require(endMs > startMs) { "endMs phải lớn hơn startMs" }
        val newSeg = SubtitleSegment(
            id = nextId(segments),
            startMs = startMs,
            endMs = endMs,
            originalText = "",
            translatedText = text,
            status = ChunkStatus.COMPLETED
        )
        return (segments + newSeg).sortedBy { it.startMs }
    }

    fun deleteSegment(segments: List<SubtitleSegment>, id: Int): List<SubtitleSegment> =
        segments.filterNot { it.id == id }
}
