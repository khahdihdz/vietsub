package com.vietsub.ai.subtitle

import com.vietsub.ai.domain.model.LineBreakConfig

/**
 * Spec §15: toi da 2 dong, khoang 32-42 ky tu/dong, khong chia giua tu, uu tien
 * chia theo dau cau, giu cum tu tu nhien.
 */
class SubtitleLineBreaker(private val config: LineBreakConfig = LineBreakConfig()) {

    fun breakLines(text: String): String {
        val trimmed = text.trim().replace(Regex("\\s+"), " ")
        if (trimmed.length <= config.maxCharsPerLine) return trimmed

        val breakIndex = findBestBreakIndex(trimmed)
        val line1 = trimmed.substring(0, breakIndex).trim()
        val line2 = trimmed.substring(breakIndex).trim()

        // Neu dong 2 van qua dai (cau rat dai), cat tiep theo tu — van gioi han
        // toi da config.maxLines dong, khong de tran vo han (spec §16 "text qua dai").
        val secondLineFinal = if (line2.length > config.maxCharsPerLine && config.maxLines >= 2) {
            truncateAtWordBoundary(line2, config.maxCharsPerLine)
        } else line2

        return "$line1\n$secondLineFinal"
    }

    /**
     * Uu tien: dau cau gan giua nhat (. , ! ? … :) trong khoang min..max ky tu.
     * Neu khong co dau cau phu hop, chia tai khoang trang gan giua nhat.
     * Khong bao gio cat giua mot tu.
     */
    private fun findBestBreakIndex(text: String): Int {
        val target = text.length / 2
        val searchStart = config.minCharsPerLine.coerceAtMost(text.length - 1)
        val searchEnd = config.maxCharsPerLine.coerceAtMost(text.length - 1)

        val punctuation = charArrayOf('.', ',', '!', '?', '…', ':', ';')
        var bestPunctIndex = -1
        var bestPunctDistance = Int.MAX_VALUE

        for (i in searchStart..searchEnd) {
            if (text[i] in punctuation) {
                val distance = kotlin.math.abs(i - target)
                if (distance < bestPunctDistance) {
                    bestPunctDistance = distance
                    bestPunctIndex = i + 1 // cat sau dau cau
                }
            }
        }
        if (bestPunctIndex != -1) return bestPunctIndex

        // Khong co dau cau -> chia tai khoang trang gan target nhat trong khoang cho phep
        var bestSpaceIndex = -1
        var bestSpaceDistance = Int.MAX_VALUE
        for (i in searchStart..searchEnd) {
            if (text[i] == ' ') {
                val distance = kotlin.math.abs(i - target)
                if (distance < bestSpaceDistance) {
                    bestSpaceDistance = distance
                    bestSpaceIndex = i + 1
                }
            }
        }
        if (bestSpaceIndex != -1) return bestSpaceIndex

        // Khong tim duoc khoang trang trong khoang cho phep (mot "tu" rat dai) ->
        // buoc phai chia tai target, nhung lui ve khoang trang gan nhat tren toan chuoi
        // de khong cat giua tu.
        val fallbackSpace = text.lastIndexOf(' ', target)
        return if (fallbackSpace > 0) fallbackSpace + 1 else target
    }

    private fun truncateAtWordBoundary(text: String, maxChars: Int): String {
        if (text.length <= maxChars) return text
        val cut = text.lastIndexOf(' ', maxChars)
        return if (cut > 0) text.substring(0, cut) else text.substring(0, maxChars)
    }
}
