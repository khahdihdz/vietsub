package com.vietsub.ai.domain.model

import java.io.File

/**
 * Kết quả tách audio (spec §6): WAV mono 16kHz PCM, lưu trong app cache,
 * không đụng tới video gốc.
 */
data class AudioExtractionResult(
    val audioFile: File,
    val sourceDurationMs: Long
)

/** Các bước hiển thị trên UI (spec §18). */
enum class PipelineStage {
    EXTRACT_AUDIO, SPEECH_RECOGNITION, TRANSLATION, SUBTITLE, EXPORT
}

enum class StageState { WAITING, RUNNING, DONE, FAILED }

data class StageProgress(
    val stage: PipelineStage,
    val state: StageState = StageState.WAITING,
    val percent: Int = 0
)
