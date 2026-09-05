package com.vietsub.ai.subtitle

import com.vietsub.ai.domain.model.SubtitleSegment

data class ValidationIssue(val segmentId: Int?, val type: String, val message: String, val autoFixed: Boolean)

sealed class ValidationResult {
    data class Success(val segments: List<SubtitleSegment>, val issues: List<ValidationIssue>) : ValidationResult()
    data class Failed(val issues: List<ValidationIssue>) : ValidationResult()
}

/**
 * Spec §16. Quy tac: endMs > startMs; so luong segment dau vao/ra phai khop.
 * Neu loi co the tu sua (vd. overlap nhe giua 2 cau lien tiep) thi tu sua; neu
 * khong the sua an toan (duplicate ID, thieu segment, timestamp hong, text rong
 * toan bo) thi FAILED thay vi bia du lieu.
 */
class SubtitleValidator {

    fun validate(expectedIds: Set<Int>, segments: List<SubtitleSegment>): ValidationResult {
        val issues = mutableListOf<ValidationIssue>()

        val actualIds = segments.map { it.id }.toSet()
        val missing = expectedIds - actualIds
        if (missing.isNotEmpty()) {
            issues += ValidationIssue(null, "MISSING_SEGMENT", "Thiếu segment: ${missing.sorted()}", autoFixed = false)
        }

        val duplicateIds = segments.groupingBy { it.id }.eachCount().filter { it.value > 1 }.keys
        if (duplicateIds.isNotEmpty()) {
            issues += ValidationIssue(null, "DUPLICATE_ID", "Trùng ID: ${duplicateIds.sorted()}", autoFixed = false)
        }

        segments.forEach { seg ->
            if (seg.endMs <= seg.startMs) {
                issues += ValidationIssue(seg.id, "INVALID_TIMESTAMP", "endMs (${seg.endMs}) <= startMs (${seg.startMs})", autoFixed = false)
            }
            if (seg.translatedText.isBlank()) {
                issues += ValidationIssue(seg.id, "EMPTY_SUBTITLE", "Bản dịch rỗng", autoFixed = false)
            }
            if (seg.translatedText.contains('\uFFFD')) {
                issues += ValidationIssue(seg.id, "UNICODE_ERROR", "Ký tự lỗi encoding (U+FFFD)", autoFixed = false)
            }
        }

        // Overlap giữa các segment liên tiếp — auto-fix bằng cách kéo endMs của câu
        // trước lùi về ngay trước startMs của câu sau (giữ nguyên nội dung 2 câu).
        val sorted = segments.sortedBy { it.startMs }.toMutableList()
        for (i in 0 until sorted.size - 1) {
            val current = sorted[i]
            val next = sorted[i + 1]
            if (current.endMs > next.startMs) {
                sorted[i] = current.copy(endMs = (next.startMs - 1).coerceAtLeast(current.startMs + 1))
                issues += ValidationIssue(
                    current.id, "OVERLAP",
                    "Segment ${current.id} chồng lấn segment ${next.id}, đã cắt endMs",
                    autoFixed = true
                )
            }
        }

        val hardFailures = issues.filter { !it.autoFixed }
        // Text rong toan bo (tat ca segment EMPTY_SUBTITLE) la loi khong the sua ->
        // FAILED toan bo. Mot vai segment rieng le bi rong van tra ve Success kem
        // canh bao, de nguoi dung tu sua trong Subtitle Editor (Phase 6) thay vi
        // chan toan bo pipeline vi 1-2 cau.
        val allEmpty = segments.isNotEmpty() && segments.all { it.translatedText.isBlank() }
        val criticalFailures = hardFailures.filter { it.type != "EMPTY_SUBTITLE" } +
            (if (allEmpty) hardFailures.filter { it.type == "EMPTY_SUBTITLE" } else emptyList())

        return if (criticalFailures.isNotEmpty() || missing.isNotEmpty() || duplicateIds.isNotEmpty()) {
            ValidationResult.Failed(issues)
        } else {
            ValidationResult.Success(sorted.sortedBy { it.id }, issues)
        }
    }
}
