package com.vietsub.ai.domain.usecase

import com.vietsub.ai.domain.AudioExtractor
import com.vietsub.ai.domain.ExtractionProgress
import kotlinx.coroutines.flow.Flow
import java.io.File

class ExtractAudioUseCase(private val audioExtractor: AudioExtractor) {
    operator fun invoke(sourceVideoPath: String, sourceDurationMs: Long, outputDir: File): Flow<ExtractionProgress> =
        audioExtractor.extract(sourceVideoPath, sourceDurationMs, outputDir)
}
