package com.vietsub.ai.domain

import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.domain.model.TranscriptSegment

interface TranslationEngine {
    suspend fun translate(
        segments: List<TranscriptSegment>,
        sourceLanguage: String,
        targetLanguage: String
    ): List<SubtitleSegment>
}
