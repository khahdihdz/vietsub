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
 * The input should preferably be a real local filesystem path. SAF/content://
 * resolution is handled by the pipeline before this class is invoked because
 * some FFmpegKit builds/forks are unreliable with saf: parameters from Android
 * DocumentsProvider URIs.
 */
class FFmpegAudioExtractor(
    private val onLog: ((String) -> Unit)? = null
) : AudioExtractor {

    override fun extract(
        sourceVideoPath: String,
        sourceDurationMs: Long,
        outputDir: File
    ): Flow<ExtractionProgress> = callbackFlow {
        if (!outputDir.exists() && !outputDir.mkdirs() && !outputDir.exists()) {
            trySend(ExtractionProgress.Failed("Không tạo được thư mục tạm: ${outputDir.absolutePath}"))
            close()
            return@callbackFlow
        }

        val outputFile = File(outputDir, "audio_${UUID.randomUUID()}.mp3")
        onLog?.invoke("Input FFmpeg: ${sourceVideoPath.take(300)}")
        onLog?.invoke("Output audio: ${outputFile.absolutePath}")

        val session = FFmpegKit.executeAsync(
            buildCommand(sourceVideoPath, outputFile),
            { session ->
                if (ReturnCode.isSuccess(session.returnCode) && outputFile.isFile && outputFile.length() > 0L) {
                    onLog?.invoke("FFmpeg completed successfully (${outputFile.length()} bytes)")
                    trySend(
                        ExtractionProgress.Done(
                            AudioExtractionResult(audioFile = outputFile, sourceDurationMs = sourceDurationMs)
                        )
                    )
                } else {
                    val detail = session.failStackTrace
                        ?: session.output
                        ?: "FFmpeg export thất bại (returnCode=${session.returnCode})"
                    onLog?.invoke("FFmpeg FAILED returnCode=${session.returnCode}")
                    onLog?.invoke("FFmpeg error: ${detail.takeLast(6000)}")
                    trySend(ExtractionProgress.Failed(detail))
                }
                close()
            },
            { log ->
                // FFmpegKit log callback is the only reliable way to diagnose
                // codec/container/input failures. Do not log secrets here.
                val message = log.message?.trim().orEmpty()
                if (message.isNotEmpty()) onLog?.invoke(message.take(2000))
            },
            { stats: Statistics ->
                if (sourceDurationMs > 0) {
                    val percent = ((stats.time.toFloat() / sourceDurationMs) * 100).toInt().coerceIn(0, 99)
                    trySend(ExtractionProgress.Running(percent))
                }
            }
        )

        awaitClose { session.cancel() }
    }

    private fun buildCommand(inputPath: String, output: File): String {
        val escapedInput = inputPath.replace("\\", "\\\\").replace("\"", "\\\"")
        val outputPath = output.absolutePath.replace("\\", "\\\\").replace("\"", "\\\"")
        val input = "\"$escapedInput\""

        // FFmpegKit 8.1.x removed support for the -ac N CLI option.
        // aformat keeps the output mono without relying on -ac.
        return "-y -i $input -vn -ar 16000 -af \"aformat=channel_layouts=mono\" -c:a libmp3lame -b:a 128k -f mp3 \"$outputPath\""
    }
}
