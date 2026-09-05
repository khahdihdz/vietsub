package com.vietsub.ai.domain.model

enum class SubtitleFormat { SRT, ASS }

/** Spec §14: các tuỳ chọn style cho ASS, cấu hình được ở Settings → Subtitle. */
data class AssStyle(
    val fontName: String = "Arial",
    val fontSize: Int = 20,
    /** Màu chữ dạng &HAABBGGRR (thứ tự ASS: Alpha-Blue-Green-Red), mặc định trắng đục. */
    val primaryColor: String = "&H00FFFFFF",
    val outlineColor: String = "&H00000000",
    val outlineWidth: Float = 2f,
    val shadowDepth: Float = 0f,
    /** Số numpad ASS: 2 = bottom-center (mặc định phụ đề thông thường). */
    val alignment: Int = 2,
    val marginLeft: Int = 20,
    val marginRight: Int = 20,
    val marginVertical: Int = 20
)

/** Spec §15: quy tắc auto line break. */
data class LineBreakConfig(
    val maxLines: Int = 2,
    val minCharsPerLine: Int = 32,
    val maxCharsPerLine: Int = 42
)
