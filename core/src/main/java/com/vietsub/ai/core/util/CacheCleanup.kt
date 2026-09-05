package com.vietsub.ai.core.util

import java.io.File

/**
 * Dọn file tạm (audio đã tách, chunk trung gian...) trong app cache sau khi pipeline
 * hoàn tất — chỉ chạy khi Settings → Processing → Auto Cleanup đang bật (spec §6, §25).
 * Không bao giờ đụng tới thư mục chứa video gốc hay project đã lưu (SRT/ASS/export).
 */
object CacheCleanup {
    fun clearDir(dir: File) {
        if (!dir.exists()) return
        dir.listFiles()?.forEach { it.deleteRecursively() }
    }

    fun clearFile(file: File) {
        if (file.exists()) file.delete()
    }
}
