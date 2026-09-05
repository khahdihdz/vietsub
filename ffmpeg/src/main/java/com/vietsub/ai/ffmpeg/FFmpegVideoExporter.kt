package com.vietsub.ai.ffmpeg

import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.ReturnCode
import com.arthenica.ffmpegkit.Statistics
import com.vietsub.ai.domain.ExportProgress
import com.vietsub.ai.domain.VideoExporter
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Tuong duong lenh CLI trong spec S22:
 *   ffmpeg -i input.mp4 -vf "subtitles=subtitle.ass" -c:a copy output.mp4
 *
 * Dung filter "ass=" thay vi "subtitles=" khi input la .ass — libavfilter route ca
 * hai qua libass, nhung "ass=" giu nguyen style/override tags ASS chinh xac hon
 * (subtitles= filter co the doc lai qua duong dich .srt-style truoc). ffmpeg-kit-full
 * da bundle libass san, khong can them dependency.
 *
 * Khong overwrite video goc: outputPath luon la mot Uri/path khac do caller chon
 * (SAF CreateDocument, spec §22 goi y ten mac dinh "video_vi_sub.mp4").
 */
class FFmpegVideoExporter : VideoExporter {

    override fun exportWithBurnedSubtitle(
        sourceVideoPath: String,
        subtitleAssPath: String,
        outputPath: String,
        sourceDurationMs: Long
    ): Flow<ExportProgress> = callbackFlow {
        val session = FFmpegKit.executeAsync(
            buildCommand(sourceVideoPath, subtitleAssPath, outputPath),
            { session ->
                if (ReturnCode.isSuccess(session.returnCode)) {
                    trySend(ExportProgress.Done(outputPath))
                } else {
                    trySend(ExportProgress.Failed(session.failStackTrace ?: "FFmpeg export thất bại"))
                }
                close()
            },
            { /* logs — khong log API key/du lieu nhay cam */ },
            { stats: Statistics ->
                if (sourceDurationMs > 0) {
                    val percent = ((stats.time.toFloat() / sourceDurationMs) * 100).toInt().coerceIn(0, 99)
                    trySend(ExportProgress.Running(percent))
                }
            }
        )
        awaitClose { session.cancel() }
    }

    private fun buildCommand(inputPath: String, subtitlePath: String, outputPath: String): String {
        val input = quoteIfNeeded(inputPath)
        val output = quoteIfNeeded(outputPath)
        // Escape duong dan subtitle theo cu phap filtergraph cua FFmpeg (spec §22:
        // "phai xu ly chinh xac duong dan Unicode va khoang trang"): ':' va '\' phai
        // duoc escape, sau do toan bo path duoc boc trong dau nhay don cho filter arg.
        val escapedSubtitlePath = subtitlePath
            .replace("\\", "\\\\")
            .replace(":", "\\:")
            .replace("'", "\\'")
        return "-y -i $input -vf \"ass='$escapedSubtitlePath'\" -c:a copy $output"
        // -y o day chi overwrite outputPath (dich do nguoi dung chon), khong dung toi input.
    }

    private fun quoteIfNeeded(path: String): String =
        if (path.contains(" ") || path.startsWith("saf:")) "\"${path.replace("\"", "\\\"")}\"" else path
}
