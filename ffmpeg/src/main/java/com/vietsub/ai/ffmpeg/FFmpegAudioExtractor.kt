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

        // Keep the output as a real MP3 because WhisperApiSpeechToTextEngine
        // uploads it with MIME type audio/mpeg. The previous code only changed
        // the extension to .mp3 while still encoding pcm_s16le, which makes
        // FFmpeg fail at the first pipeline stage ("Extract Audio 0%").
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
        // Escape paths containing spaces/Unicode and SAF parameters.
        val outputPath = output.absolutePath.replace("\"", "\\\"")
        val input = if (inputPathOrSaf.contains(" ") || inputPathOrSaf.startsWith("saf:")) {
            "\"${inputPathOrSaf.replace("\"", "\\\"")}\""
        } else {
            inputPathOrSaf
        }

        // 16 kHz mono is sufficient for speech recognition and dramatically
        // reduces upload size compared with raw PCM/WAV. libmp3lame produces a
        // valid MP3 container, matching the audio/mpeg MIME used by the STT API.
        return "-y -i $input -vn -ar 16000 -ac 1 -c:a libmp3lame -b:a 128k -f mp3 \"$outputPath\""
    }
}
