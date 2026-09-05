package com.vietsub.ai.domain.usecase

import com.vietsub.ai.domain.SpeechToTextEngine
import com.vietsub.ai.domain.model.TranscriptSegment
import java.io.File

class TranscribeAudioUseCase(private val engine: SpeechToTextEngine) {
    suspend operator fun invoke(audioFile: File, language: String?): List<TranscriptSegment> =
        engine.transcribe(audioFile, language)
}
