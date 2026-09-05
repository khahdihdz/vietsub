package com.vietsub.ai.ui.screens.editor

import androidx.lifecycle.ViewModel
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.subtitle.SubtitleEditOps
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class EditorUiState(
    val segments: List<SubtitleSegment> = emptyList(),
    val canUndo: Boolean = false,
    val canRedo: Boolean = false,
    val saveMessage: String? = null
)

/**
 * Spec §20. Undo/Redo la 2 stack snapshot danh sach segment — don gian, du tin cay
 * cho quy mo mot project phu de (vai tram segment), khong can command pattern phuc tap.
 */
class SubtitleEditorViewModel : ViewModel() {

    private val undoStack = ArrayDeque<List<SubtitleSegment>>()
    private val redoStack = ArrayDeque<List<SubtitleSegment>>()
    private val maxHistory = 50

    private val _uiState = MutableStateFlow(EditorUiState())
    val uiState: StateFlow<EditorUiState> = _uiState.asStateFlow()

    fun load(segments: List<SubtitleSegment>) {
        undoStack.clear()
        redoStack.clear()
        _uiState.value = EditorUiState(segments = segments.sortedBy { it.startMs })
    }

    private fun apply(newSegments: List<SubtitleSegment>) {
        undoStack.addLast(_uiState.value.segments)
        if (undoStack.size > maxHistory) undoStack.removeFirst()
        redoStack.clear()
        _uiState.value = _uiState.value.copy(
            segments = newSegments,
            canUndo = true,
            canRedo = false
        )
    }

    fun editText(id: Int, newText: String) = apply(SubtitleEditOps.editText(_uiState.value.segments, id, newText))

    fun editTimestamp(id: Int, startMs: Long, endMs: Long) =
        apply(SubtitleEditOps.editTimestamp(_uiState.value.segments, id, startMs, endMs))

    fun split(id: Int, splitAtCharIndex: Int, splitAtMs: Long) =
        apply(SubtitleEditOps.splitSegment(_uiState.value.segments, id, splitAtCharIndex, splitAtMs))

    fun merge(firstId: Int, secondId: Int) =
        apply(SubtitleEditOps.mergeSegments(_uiState.value.segments, firstId, secondId))

    fun addSegment(afterId: Int?) {
        val segs = _uiState.value.segments
        val ref = segs.find { it.id == afterId } ?: segs.lastOrNull()
        val start = ref?.endMs ?: 0L
        apply(SubtitleEditOps.addSegment(segs, start, start + 2000, "..."))
    }

    fun delete(id: Int) = apply(SubtitleEditOps.deleteSegment(_uiState.value.segments, id))

    fun undo() {
        if (undoStack.isEmpty()) return
        redoStack.addLast(_uiState.value.segments)
        val previous = undoStack.removeLast()
        _uiState.value = _uiState.value.copy(
            segments = previous,
            canUndo = undoStack.isNotEmpty(),
            canRedo = true
        )
    }

    fun redo() {
        if (redoStack.isEmpty()) return
        undoStack.addLast(_uiState.value.segments)
        val next = redoStack.removeLast()
        _uiState.value = _uiState.value.copy(
            segments = next,
            canUndo = true,
            canRedo = redoStack.isNotEmpty()
        )
    }

    fun clearSaveMessage() {
        _uiState.value = _uiState.value.copy(saveMessage = null)
    }

    fun markSaved(message: String) {
        _uiState.value = _uiState.value.copy(saveMessage = message)
    }
}
