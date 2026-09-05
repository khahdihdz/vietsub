package com.vietsub.ai.ui.screens.home

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vietsub.ai.domain.model.PipelineStage
import com.vietsub.ai.domain.model.StageProgress
import com.vietsub.ai.domain.model.StageState

/**
 * Spec S18: chon video, hien duration/source/target/model, nut BAT DAU,
 * progress theo tung stage (Extract Audio / STT / Translation / Subtitle / Export).
 * Video duoc chon qua Storage Access Framework (spec S5): chi giu content:// Uri +
 * quyen doc lau dai, khong bao gio copy ca file vao bo nho.
 */
@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onOpenEditor: () -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    val pickVideoLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let(viewModel::onVideoSelected)
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("video/mp4")
    ) { uri: Uri? ->
        uri?.let(viewModel::exportVideo)
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("VietSub AI", style = MaterialTheme.typography.headlineMedium)
            TextButton(onClick = onOpenSettings) { Text("Settings") }
        }

        Button(onClick = { pickVideoLauncher.launch(arrayOf("video/*")) }) {
            Text("\uD83C\uDFAC Chon video")
        }

        state.metadata?.let { meta ->
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Video: ${state.videoUri?.lastPathSegment ?: ""}")
                    Text("Duration: ${formatDuration(meta.durationMs)}")
                    Text("Resolution: ${meta.width}x${meta.height}" + (meta.fps?.let { " · ${it.toInt()}fps" } ?: ""))
                    Text("Source: Auto Detect")
                    Text("Target: Vietnamese")
                    Text("Model: deepseek-v4-pro")
                    if (!meta.hasAudioTrack) {
                        Text("⚠ Video khong co audio track", color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            Button(
                onClick = { viewModel.startPipeline() },
                enabled = meta.hasAudioTrack
            ) {
                Text("BAT DAU")
            }

            Spacer(Modifier.height(8.dp))
            state.stages.forEach { StageRow(it) }

            state.srtFile?.let { Text("SRT: ${it.absolutePath}") }
            state.assFile?.let { Text("ASS: ${it.absolutePath}") }

            if (state.subtitles.isNotEmpty()) {
                Button(onClick = onOpenEditor) { Text("Subtitle Editor / Preview") }
                Button(onClick = { exportLauncher.launch("video_vi_sub.mp4") }) {
                    Text("Export video with subtitles")
                }
            }

            state.exportedVideoUri?.let { Text("Đã export: $it") }
        }

        state.errorMessage?.let { msg ->
            Text(msg, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun StageRow(stage: StageProgress) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(stageLabel(stage.stage))
        Text(
            when (stage.state) {
                StageState.WAITING -> "Waiting"
                StageState.RUNNING -> "${stage.percent}%"
                StageState.DONE -> "\u2713"
                StageState.FAILED -> "Failed"
            }
        )
    }
    if (stage.state == StageState.RUNNING) {
        LinearProgressIndicator(
            progress = { stage.percent / 100f },
            modifier = Modifier.fillMaxWidth()
        )
    }
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
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "%d:%02d".format(m, s)
}
