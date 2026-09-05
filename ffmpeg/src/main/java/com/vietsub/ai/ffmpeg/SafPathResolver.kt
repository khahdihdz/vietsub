package com.vietsub.ai.ffmpeg

import android.content.Context
import android.net.Uri
import com.arthenica.ffmpegkit.FFmpegKitConfig

/**
 * FFmpegKit không đọc/ghi thẳng content:// Uri — cần FFmpegKitConfig.getSafParameterForRead
 * / ...ForWrite để lấy tham số "saf:<id>" trỏ vào file descriptor, tránh phải copy cả video
 * (30 phút, có thể rất lớn) ra bộ nhớ tạm trước khi xử lý (spec §5, §37).
 */
class SafPathResolver(private val context: Context) {
    fun resolveForFfmpegRead(uri: Uri): String = FFmpegKitConfig.getSafParameterForRead(context, uri)

    /** Dùng khi export video ra một Uri do người dùng chọn qua SAF CreateDocument (spec §22). */
    fun resolveForFfmpegWrite(uri: Uri): String = FFmpegKitConfig.getSafParameterForWrite(context, uri)
}
