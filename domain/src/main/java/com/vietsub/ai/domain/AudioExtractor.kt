package com.vietsub.ai.domain

import com.vietsub.ai.domain.model.AudioExtractionResult
import kotlinx.coroutines.flow.Flow
import java.io.File

/**
 * Tách audio từ video thành WAV mono 16kHz PCM (spec §6).
 * sourceVideoPath: đường dẫn/URI đã được resolve sẵn ở tầng platform (vd. tham số
 * "saf:..." cho content:// Uri từ Storage Access Framework) — domain module không
 * biết gì về Android Uri, chỉ nhận String để giữ module thuần Kotlin/JVM.
 * Không tạo bản sao/ghi đè video gốc; file audio tạm nằm trong cache và có thể
 * dọn tự động sau khi pipeline hoàn tất (spec §6, §25 "Auto Cleanup").
 */
interface AudioExtractor {
    /** progress: 0..100. Trả về AudioExtractionResult khi hoàn tất. */
    fun extract(sourceVideoPath: String, sourceDurationMs: Long, outputDir: File): Flow<ExtractionProgress>
}

sealed class ExtractionProgress {
    data class Running(val percent: Int) : ExtractionProgress()
    data class Done(val result: AudioExtractionResult) : ExtractionProgress()
    data class Failed(val message: String) : ExtractionProgress()
}
