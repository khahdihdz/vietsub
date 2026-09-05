package com.vietsub.ai.subtitle

import com.vietsub.ai.domain.model.AssStyle
import com.vietsub.ai.domain.model.SubtitleSegment
import java.util.Locale

class SubtitleEngineImpl(
    private val lineBreaker: SubtitleLineBreaker = SubtitleLineBreaker()
) : SubtitleEngine {

    override fun generateSrt(segments: List<SubtitleSegment>): String {
        val sb = StringBuilder()
        segments.sortedBy { it.id }.forEachIndexed { index, seg ->
            val text = lineBreaker.breakLines(seg.translatedText)
            sb.append(index + 1).append('\n')
            sb.append(srtTime(seg.startMs)).append(" --> ").append(srtTime(seg.endMs)).append('\n')
            sb.append(text).append('\n').append('\n')
        }
        return sb.toString().trimEnd() + "\n"
    }

    override fun generateAss(segments: List<SubtitleSegment>, style: AssStyle): String {
        val header = """
            [Script Info]
            ScriptType: v4.00+
            WrapStyle: 0
            ScaledBorderAndShadow: yes
            YCbCr Matrix: TV.601

            [V4+ Styles]
            Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
            Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},&H00000000,0,0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowDepth},${style.alignment},${style.marginLeft},${style.marginRight},${style.marginVertical},1

            [Events]
            Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
        """.trimIndent()

        val events = segments.sortedBy { it.id }.joinToString("\n") { seg ->
            val text = lineBreaker.breakLines(seg.translatedText).replace("\n", "\\N")
            "Dialogue: 0,${assTime(seg.startMs)},${assTime(seg.endMs)},Default,,0,0,0,,$text"
        }

        return "$header\n$events\n"
    }

    private fun srtTime(ms: Long): String {
        val h = ms / 3_600_000
        val m = (ms % 3_600_000) / 60_000
        val s = (ms % 60_000) / 1000
        val millis = ms % 1000
        return String.format(Locale.US, "%02d:%02d:%02d,%03d", h, m, s, millis)
    }

    /** ASS dùng centisecond (2 chữ số) thay vì millisecond, và giờ chỉ 1 chữ số. */
    private fun assTime(ms: Long): String {
        val h = ms / 3_600_000
        val m = (ms % 3_600_000) / 60_000
        val s = (ms % 60_000) / 1000
        val centis = (ms % 1000) / 10
        return String.format(Locale.US, "%d:%02d:%02d.%02d", h, m, s, centis)
    }
}
