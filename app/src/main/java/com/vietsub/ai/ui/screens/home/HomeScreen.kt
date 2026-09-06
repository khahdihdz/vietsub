package com.vietsub.ai.ui.screens.home

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vietsub.ai.domain.model.PipelineStage
import com.vietsub.ai.domain.model.StageProgress
import com.vietsub.ai.domain.model.StageState
import com.vietsub.ai.domain.model.VideoMetadata

@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onOpenEditor: () -> Unit,
    viewModel: HomeViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val clipboard = LocalClipboardManager.current
    val configuration = LocalConfiguration.current
    val wide = configuration.screenWidthDp >= 600
    val pickVideoLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> uri?.let(viewModel::onVideoSelected) }
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("video/mp4")) { uri: Uri? -> uri?.let(viewModel::exportVideo) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = if (wide) 32.dp else 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column { Text("VietSub AI", style = MaterialTheme.typography.headlineMedium); Text("AI Subtitle Studio", style = MaterialTheme.typography.bodyMedium) }
            TextButton(onClick = onOpenSettings) { Text("Settings") }
        }

        Button(onClick = { pickVideoLauncher.launch(arrayOf("video/*")) }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("🎬 Chọn video", fontSize = 16.sp) }

        state.metadata?.let { meta ->
            if (wide) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    VideoInfoCard(state, meta, Modifier.weight(1f))
                    PipelineCard(state, viewModel::startPipeline, Modifier.weight(1f))
                }
            } else {
                VideoInfoCard(state, meta, Modifier.fillMaxWidth())
                PipelineCard(state, viewModel::startPipeline, Modifier.fillMaxWidth())
            }

            if (state.terminalLog.isNotBlank()) {
                LiveTerminalLog(state.terminalLog) { clipboard.setText(androidx.compose.ui.text.AnnotatedString(state.terminalLog)) }
            }
            state.srtFile?.let { Text("SRT: ${it.absolutePath}", style = MaterialTheme.typography.bodySmall) }
            state.assFile?.let { Text("ASS: ${it.absolutePath}", style = MaterialTheme.typography.bodySmall) }
            if (state.subtitles.isNotEmpty()) {
                if (wide) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(onClick = onOpenEditor, modifier = Modifier.weight(1f)) { Text("Subtitle Editor / Preview") }
                    Button(onClick = { exportLauncher.launch("video_vi_sub.mp4") }, modifier = Modifier.weight(1f)) { Text("Export video") }
                } else {
                    Button(onClick = onOpenEditor, modifier = Modifier.fillMaxWidth()) { Text("Subtitle Editor / Preview") }
                    Button(onClick = { exportLauncher.launch("video_vi_sub.mp4") }, modifier = Modifier.fillMaxWidth()) { Text("Export video with subtitles") }
                }
            }
            state.exportedVideoUri?.let { Text("Đã export: $it", style = MaterialTheme.typography.bodySmall) }
        }
        state.errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun VideoInfoCard(state: HomeUiState, meta: VideoMetadata, modifier: Modifier = Modifier) {
    Card(modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Thông tin video", style = MaterialTheme.typography.titleMedium)
            Text("Video: ${state.videoUri?.lastPathSegment ?: ""}")
            Text("Duration: ${formatDuration(meta.durationMs)}")
            Text("Resolution: ${meta.width}x${meta.height}" + (meta.fps?.let { " · ${it.toInt()}fps" } ?: ""))
            Text("Source: Auto Detect")
            Text("Target: Vietnamese")
            Text("Model: deepseek-v4-pro")
            if (!meta.hasAudioTrack) Text("⚠ Video không có audio track", color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun PipelineCard(state: HomeUiState, onStart: () -> Unit, modifier: Modifier = Modifier) {
    Card(modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Pipeline", style = MaterialTheme.typography.titleMedium)
            Button(onClick = onStart, enabled = state.metadata?.hasAudioTrack == true, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("BẮT ĐẦU") }
            state.stages.forEach { StageRow(it) }
        }
    }
}

@Composable
private fun LiveTerminalLog(log: String, onCopy: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("LIVE TERMINAL", style = MaterialTheme.typography.titleMedium); TextButton(onClick = onCopy) { Text("COPY LOG") } }
            Box(Modifier.fillMaxWidth().heightIn(min = 180.dp, max = 360.dp).background(MaterialTheme.colorScheme.surfaceVariant).padding(10.dp)) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { Text(log, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}

@Composable
private fun StageRow(stage: StageProgress) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(stageLabel(stage.stage)); Text(when (stage.state) { StageState.WAITING -> "Waiting"; StageState.RUNNING -> "${stage.percent}%"; StageState.DONE -> "✓"; StageState.FAILED -> "Failed" })
    }
    if (stage.state == StageState.RUNNING) LinearProgressIndicator(progress = { stage.percent / 100f }, modifier = Modifier.fillMaxWidth())
}

private fun stageLabel(stage: PipelineStage): String = when (stage) {
    PipelineStage.EXTRACT_AUDIO -> "Extract Audio"
    PipelineStage.SPEECH_RECOGNITION -> "Speech Recognition"
    PipelineStage.TRANSLATION -> "Translation"
    PipelineStage.SUBTITLE -> "Subtitle"
    PipelineStage.EXPORT -> "Export"
}

private fun formatDuration(ms: Long): String {
    val totalSeconds = ms / 1000
    return "%d:%02d".format(totalSeconds / 60, totalSeconds % 60)
}
