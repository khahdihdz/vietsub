package com.vietsub.ai.ui.screens.home

import android.content.ClipData
import android.content.Context
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vietsub.ai.domain.model.PipelineStage
import com.vietsub.ai.domain.model.StageProgress
import com.vietsub.ai.domain.model.StageState

@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onOpenEditor: () -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val clipboard = LocalClipboardManager.current
    val pickVideoLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> uri?.let(viewModel::onVideoSelected) }
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("video/mp4")) { uri: Uri? -> uri?.let(viewModel::exportVideo) }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("VietSub AI", style = MaterialTheme.typography.headlineMedium)
            TextButton(onClick = onOpenSettings) { Text("Settings") }
        }
        Button(onClick = { pickVideoLauncher.launch(arrayOf("video/*")) }) { Text("🎬 Chon video") }

        state.metadata?.let { meta ->
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Video: ${state.videoUri?.lastPathSegment ?: ""}")
                    Text("Duration: ${formatDuration(meta.durationMs)}")
                    Text("Resolution: ${meta.width}x${meta.height}" + (meta.fps?.let { " · ${it.toInt()}fps" } ?: ""))
                    Text("Source: Auto Detect")
                    Text("Target: Vietnamese")
                    Text("Model: deepseek-v4-pro")
                    if (!meta.hasAudioTrack) Text("⚠ Video khong co audio track", color = MaterialTheme.colorScheme.error)
                }
            }
            Button(onClick = { viewModel.startPipeline() }, enabled = meta.hasAudioTrack) { Text("BAT DAU") }
            Spacer(Modifier.height(8.dp))
            state.stages.forEach { StageRow(it) }

            if (state.terminalLog.isNotBlank()) {
                LiveTerminalLog(
                    log = state.terminalLog,
                    onCopy = { clipboard.setText(androidx.compose.ui.text.AnnotatedString(state.terminalLog)) }
                )
            }

            state.srtFile?.let { Text("SRT: ${it.absolutePath}") }
            state.assFile?.let { Text("ASS: ${it.absolutePath}") }
            if (state.subtitles.isNotEmpty()) {
                Button(onClick = onOpenEditor) { Text("Subtitle Editor / Preview") }
                Button(onClick = { exportLauncher.launch("video_vi_sub.mp4") }) { Text("Export video with subtitles") }
            }
            state.exportedVideoUri?.let { Text("Đã export: $it") }
        }
        state.errorMessage?.let { msg -> Text(msg, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun LiveTerminalLog(log: String, onCopy: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("LIVE TERMINAL", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = onCopy) { Text("COPY LOG") }
            }
            Box(modifier = Modifier.fillMaxWidth().heightIn(min = 180.dp, max = 360.dp).background(MaterialTheme.colorScheme.surfaceVariant).padding(10.dp)) {
                Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    Text(log, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun StageRow(stage: StageProgress) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(stageLabel(stage.stage))
        Text(when (stage.state) { StageState.WAITING -> "Waiting"; StageState.RUNNING -> "${stage.percent}%"; StageState.DONE -> "✓"; StageState.FAILED -> "Failed" })
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
