package com.vietsub.ai.domain.model

/** Đọc được từ video gốc trước khi xử lý, không load toàn bộ file vào RAM (spec §5). */
data class VideoMetadata(
    val durationMs: Long,
    val width: Int,
    val height: Int,
    val fps: Float?,
    val videoCodec: String?,
    val audioCodec: String?,
    val hasAudioTrack: Boolean
)

/** Giới hạn thời lượng cho phép cấu hình (spec §5: "Cho phép cấu hình giới hạn duration"). */
data class VideoDurationLimit(val maxMinutes: Int = 30)
