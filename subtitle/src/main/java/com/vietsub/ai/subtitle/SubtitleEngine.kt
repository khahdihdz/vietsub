package com.vietsub.ai.subtitle

import com.vietsub.ai.domain.model.AssStyle
import com.vietsub.ai.domain.model.SubtitleSegment

/** Spec §14: xuất SRT hoặc ASS từ danh sách segment đã qua validator + line breaker. */
interface SubtitleEngine {
    fun generateSrt(segments: List<SubtitleSegment>): String
    fun generateAss(segments: List<SubtitleSegment>, style: AssStyle): String
}
