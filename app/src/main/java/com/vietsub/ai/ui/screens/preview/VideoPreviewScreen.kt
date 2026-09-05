package com.vietsub.ai.ui.screens.preview

import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.vietsub.ai.domain.model.SubtitleSegment
import kotlinx.coroutines.delay

/**
 * Spec §21: dung Media3/ExoPlayer, hien subtitle dong bo voi playback position.
 * Day la preview trong-app (khac voi Phase 7 "burn subtitle vao video bang FFmpeg"
 * de xuat file cuoi cung) — overlay Text ve tren PlayerView, khong sua video goc.
 */
@Composable
fun VideoPreviewScreen(videoUri: Uri, segments: List<SubtitleSegment>, onBack: () -> Unit) {
    val context = LocalContext.current
    var positionMs by remember { mutableLongStateOf(0L) }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(videoUri))
            prepare()
            playWhenReady = true
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    LaunchedEffect(exoPlayer) {
        while (true) {
            positionMs = exoPlayer.currentPosition
            delay(200)
        }
    }

    val activeSubtitle = segments.find { positionMs in it.startMs until it.endMs }

    Column(modifier = Modifier.fillMaxSize()) {
        TextButton(onClick = onBack) { Text("Back") }

        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { PlayerView(it).apply { player = exoPlayer; useController = true } }
            )

            activeSubtitle?.let { seg ->
                Surface(
                    color = MaterialTheme.colorScheme.scrim.copy(alpha = 0.6f),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 48.dp, start = 16.dp, end = 16.dp)
                ) {
                    Text(
                        text = seg.translatedText,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }
    }
}
