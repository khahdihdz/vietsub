package com.vietsub.ai.domain.usecase

import com.vietsub.ai.domain.ExportProgress
import com.vietsub.ai.domain.VideoExporter
import kotlinx.coroutines.flow.Flow

class ExportVideoUseCase(private val exporter: VideoExporter) {
    operator fun invoke(
        sourceVideoPath: String,
        subtitleAssPath: String,
        outputPath: String,
        sourceDurationMs: Long
    ): Flow<ExportProgress> = exporter.exportWithBurnedSubtitle(sourceVideoPath, subtitleAssPath, outputPath, sourceDurationMs)
}
