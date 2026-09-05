package com.vietsub.ai.domain

import com.vietsub.ai.domain.model.TranscriptSegment
import java.io.File

/**
 * Converts an audio file into timestamped transcript segments.
 * Implementations: local Whisper, Whisper API, or a configurable backend.
 * The pipeline must not depend on which implementation is active (spec §4).
 */
interface SpeechToTextEngine {
    suspend fun transcribe(
        audioFile: File,
        language: String? = null // null = auto-detect
    ): List<TranscriptSegment>
}
