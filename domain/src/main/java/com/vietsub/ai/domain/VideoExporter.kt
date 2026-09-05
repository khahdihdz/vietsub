package com.vietsub.ai.domain

import kotlinx.coroutines.flow.Flow

/**
 * Spec §22: burn subtitle vao video bang FFmpeg. sourcePath/subtitlePath/outputPath
 * la cac tham so da duoc resolve san o tang platform (String thay vi File/Uri de
 * domain module giu thuan Kotlin/JVM — giong pattern AudioExtractor).
 * Khong bao gio ghi de video goc — outputPath luon la mot dich khac.
 */
interface VideoExporter {
    fun exportWithBurnedSubtitle(
        sourceVideoPath: String,
        subtitleAssPath: String,
        outputPath: String,
        sourceDurationMs: Long
    ): Flow<ExportProgress>
}

sealed class ExportProgress {
    data class Running(val percent: Int) : ExportProgress()
    data class Done(val outputPath: String) : ExportProgress()
    data class Failed(val message: String) : ExportProgress()
}
