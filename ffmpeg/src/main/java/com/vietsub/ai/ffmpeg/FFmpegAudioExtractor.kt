package com.vietsub.ai.ffmpeg

import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.ReturnCode
import com.arthenica.ffmpegkit.Statistics
import com.vietsub.ai.domain.AudioExtractor
import com.vietsub.ai.domain.ExtractionProgress
import com.vietsub.ai.domain.model.AudioExtractionResult
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.io.File
import java.util.UUID

/**
 * Tuong duong lenh CLI trong spec S6:
 *   ffmpeg -i input.mp4 -ar 16000 -ac 1 -c:a pcm_s16le audio.wav
 *
 * sourceVideoPath da duoc resolve san o tang data/app (vi du tham so "saf:..."
 * cho content:// Uri qua FFmpegKitConfig.getSafParameterForRead, xem
 * data/video/SafPathResolver.kt) — module nay khong dong voi Storage Access
 * Framework truc tiep, chi nhan mot path/tham so FFmpeg co the -i thang vao.
 *
 * Khong bao gio overwrite video goc, khong load file vao RAM — FFmpegKit thao
 * tac truc tiep tren duong dan. File WAV nam trong outputDir (app cache),
 * caller chiu trach nhiem cleanup theo cau hinh "Auto Cleanup" o Settings (spec S25).
 */
class FFmpegAudioExtractor : AudioExtractor {

    override fun extract(
        sourceVideoPath: String,
        sourceDurationMs: Long,
        outputDir: File
    ): Flow<ExtractionProgress> = callbackFlow {
        if (!outputDir.exists() && !outputDir.mkdirs() && !outputDir.exists()) {
            trySend(ExtractionProgress.Failed("Khong tao duoc thu muc tam: ${outputDir.absolutePath}"))
            close()
            return@callbackFlow
        }

        // pcm_s16le is raw PCM and must be muxed into a WAV container.
        // The previous implementation used .mp3 while requesting pcm_s16le,
        // which makes FFmpeg fail immediately with an unsupported codec/container
        // combination. That is why the UI stopped at "Extract Audio 0%".
        val outputFile = File(outputDir, "audio_${UUID.randomUUID()}.wav")

        val session = FFmpegKit.executeAsync(
            buildCommand(sourceVideoPath, outputFile),
            { session ->
                if (ReturnCode.isSuccess(session.returnCode) && outputFile.isFile && outputFile.length() > 44L) {
                    trySend(
                        ExtractionProgress.Done(
                            AudioExtractionResult(audioFile = outputFile, sourceDurationMs = sourceDurationMs)
                        )
                    )
                } else {
                    val detail = session.failStackTrace
                        ?: session.output
                        ?: "FFmpeg export that bai (returnCode=${session.returnCode})"
                    trySend(ExtractionProgress.Failed(detail))
                }
                close()
            },
            { /* logs — khong log API key hay du lieu nhay cam, chi FFmpeg stderr */ },
            { stats: Statistics ->
                if (sourceDurationMs > 0) {
                    val percent = ((stats.time.toFloat() / sourceDurationMs) * 100).toInt().coerceIn(0, 99)
                    trySend(ExtractionProgress.Running(percent))
                }
            }
        )

        awaitClose { session.cancel() }
    }

    private fun buildCommand(inputPathOrSaf: String, output: File): String {
        // Escape duong dan co khoang trang/Unicode (spec S22 ap dung tu buoc nay).
        val outputPath = output.absolutePath.replace("\"", "\\\"")
        val input = if (inputPathOrSaf.contains(" ") || inputPathOrSaf.startsWith("saf:")) {
            "\"${inputPathOrSaf.replace("\"", "\\\"")}\""
        } else {
            inputPathOrSaf
        }
        // -f wav + pcm_s16le makes the container/codec pairing explicit.
        // -y only overwrites the temporary WAV, never the source video.
        return "-y -i $input -vn -ar 16000 -ac 1 -c:a pcm_s16le -f wav \"$outputPath\""
    }
}
