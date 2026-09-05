package com.vietsub.ai.ui.screens.editor

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vietsub.ai.domain.model.SubtitleSegment
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubtitleEditorScreen(
    initialSegments: List<SubtitleSegment>,
    onBack: () -> Unit,
    onPreview: () -> Unit,
    onSave: (List<SubtitleSegment>) -> Unit,
    viewModel: SubtitleEditorViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { viewModel.load(initialSegments) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subtitle Editor") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } },
                actions = {
                    IconButton(onClick = viewModel::undo, enabled = state.canUndo) {
                        Icon(Icons.Default.Undo, contentDescription = "Undo")
                    }
                    IconButton(onClick = viewModel::redo, enabled = state.canRedo) {
                        Icon(Icons.Default.Redo, contentDescription = "Redo")
                    }
                    TextButton(onClick = onPreview) { Text("Preview") }
                    TextButton(onClick = {
                        onSave(state.segments)
                        viewModel.markSaved("Đã lưu")
                    }) { Text("Save") }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.addSegment(state.segments.lastOrNull()?.id) }) {
                Icon(Icons.Default.Add, contentDescription = "Add segment")
            }
        }
    ) { padding ->
        state.saveMessage?.let {
            LaunchedEffect(it) {
                kotlinx.coroutines.delay(1500)
                viewModel.clearSaveMessage()
            }
        }

        LazyColumn(modifier = Modifier.padding(padding).fillMaxSize().padding(horizontal = 12.dp)) {
            items(state.segments, key = { it.id }) { seg ->
                SegmentEditorRow(
                    segment = seg,
                    nextSegmentId = state.segments.getOrNull(state.segments.indexOf(seg) + 1)?.id,
                    onTextChange = { viewModel.editText(seg.id, it) },
                    onTimestampChange = { start, end -> viewModel.editTimestamp(seg.id, start, end) },
                    onSplit = { charIndex ->
                        val mid = (seg.startMs + seg.endMs) / 2
                        viewModel.split(seg.id, charIndex, mid)
                    },
                    onMergeWithNext = { nextId -> viewModel.merge(seg.id, nextId) },
                    onDelete = { viewModel.delete(seg.id) }
                )
                Divider(modifier = Modifier.padding(vertical = 4.dp))
            }
        }
    }
}

@Composable
private fun SegmentEditorRow(
    segment: SubtitleSegment,
    nextSegmentId: Int?,
    onTextChange: (String) -> Unit,
    onTimestampChange: (Long, Long) -> Unit,
    onSplit: (Int) -> Unit,
    onMergeWithNext: (Int) -> Unit,
    onDelete: () -> Unit
) {
    var text by remember(segment.id, segment.translatedText) { mutableStateOf(segment.translatedText) }
    var startText by remember(segment.id, segment.startMs) { mutableStateOf(formatMs(segment.startMs)) }
    var endText by remember(segment.id, segment.endMs) { mutableStateOf(formatMs(segment.endMs)) }

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text("#${segment.id}", style = MaterialTheme.typography.labelMedium)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = startText,
                onValueChange = { startText = it },
                label = { Text("Start") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            OutlinedTextField(
                value = endText,
                onValueChange = { endText = it },
                label = { Text("End") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            IconButton(onClick = {
                val s = parseMs(startText) ?: segment.startMs
                val e = parseMs(endText) ?: segment.endMs
                if (e > s) onTimestampChange(s, e)
            }) { Icon(Icons.Default.Check, contentDescription = "Apply timestamp") }
        }

        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Translation") },
            trailingIcon = {
                IconButton(onClick = { onTextChange(text) }) {
                    Icon(Icons.Default.Check, contentDescription = "Apply text")
                }
            }
        )

        Row {
            TextButton(onClick = { onSplit(text.length / 2) }) { Text("Split") }
            if (nextSegmentId != null) {
                TextButton(onClick = { onMergeWithNext(nextSegmentId) }) { Text("Merge next") }
            }
            TextButton(onClick = onDelete) { Text("Delete", color = MaterialTheme.colorScheme.error) }
        }
    }
}

private fun formatMs(ms: Long): String {
    val m = ms / 60000
    val s = (ms % 60000) / 1000
    val millis = ms % 1000
    return String.format(Locale.US, "%02d:%02d.%03d", m, s, millis)
}

/** Parse "mm:ss.mmm" -> ms. Tra ve null neu sai dinh dang thay vi bien thanh 0 gay mat du lieu. */
private fun parseMs(input: String): Long? {
    val regex = Regex("""^(\d+):(\d{1,2})\.(\d{1,3})$""")
    val match = regex.find(input.trim()) ?: return null
    val (m, s, millis) = match.destructured
    return m.toLong() * 60000 + s.toLong() * 1000 + millis.padEnd(3, '0').toLong()
}
