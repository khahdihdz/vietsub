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
 * Extract audio to a compact MP3 suitable for the Whisper multipart upload.
 *
 * The input is resolved by SafPathResolver, so content:// URIs can be passed to
 * FFmpegKit without copying the whole source video into RAM or storage first.
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

        val outputFile = File(outputDir, "audio_${UUID.randomUUID()}.mp3")

        val session = FFmpegKit.executeAsync(
            buildCommand(sourceVideoPath, outputFile),
            { session ->
                if (ReturnCode.isSuccess(session.returnCode) && outputFile.isFile && outputFile.length() > 0L) {
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
            { /* Logs are intentionally not persisted here; PipelineLogStore handles user-facing logs. */ },
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
        val outputPath = output.absolutePath.replace("\"", "\\\"")
        val escapedInput = inputPathOrSaf.replace("\"", "\\\"")
        val input = "\"$escapedInput\""

        // FFmpegKit 8.1.x removed support for the -ac N CLI option.
        // Use the audio filter to force mono instead. Keeping 16 kHz mono
        // produces a small speech-optimized MP3 for the Whisper API.
        // Do not use: -ac 1
        return "-y -i $input -vn -ar 16000 -af \"aformat=channel_layouts=mono\" -c:a libmp3lame -b:a 128k -f mp3 \"$outputPath\""
    }
}
