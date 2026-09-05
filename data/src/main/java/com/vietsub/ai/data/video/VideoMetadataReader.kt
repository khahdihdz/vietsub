package com.vietsub.ai.data.video

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import com.vietsub.ai.domain.model.VideoMetadata

/**
 * Đọc metadata trước khi xử lý (spec §5): duration, resolution, FPS, codec.
 * Chỉ mở file descriptor qua ContentResolver — không copy/đọc toàn bộ nội dung video.
 */
class VideoMetadataReader(private val context: Context) {

    fun read(uri: Uri): VideoMetadata {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, uri)
            val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                ?.toIntOrNull() ?: 0
            val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                ?.toIntOrNull() ?: 0

            val (fps, videoCodec, audioCodec, hasAudio) = readTrackDetails(uri)

            VideoMetadata(
                durationMs = durationMs,
                width = width,
                height = height,
                fps = fps,
                videoCodec = videoCodec,
                audioCodec = audioCodec,
                hasAudioTrack = hasAudio
            )
        } finally {
            retriever.release()
        }
    }

    private data class TrackDetails(
        val fps: Float?,
        val videoCodec: String?,
        val audioCodec: String?,
        val hasAudio: Boolean
    )

    private fun readTrackDetails(uri: Uri): TrackDetails {
        val extractor = MediaExtractor()
        return try {
            context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                extractor.setDataSource(pfd.fileDescriptor)
            }
            var fps: Float? = null
            var videoCodec: String? = null
            var audioCodec: String? = null
            var hasAudio = false

            for (i in 0 until extractor.trackCount) {
                val format: MediaFormat = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
                when {
                    mime.startsWith("video/") -> {
                        videoCodec = mime
                        if (format.containsKey(MediaFormat.KEY_FRAME_RATE)) {
                            fps = try { format.getInteger(MediaFormat.KEY_FRAME_RATE).toFloat() } catch (e: Exception) { null }
                        }
                    }
                    mime.startsWith("audio/") -> {
                        audioCodec = mime
                        hasAudio = true
                    }
                }
            }
            TrackDetails(fps, videoCodec, audioCodec, hasAudio)
        } catch (e: Exception) {
            TrackDetails(null, null, null, false)
        } finally {
            extractor.release()
        }
    }
}
