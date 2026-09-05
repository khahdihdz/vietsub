package com.vietsub.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.vietsub.ai.ui.screens.editor.SubtitleEditorScreen
import com.vietsub.ai.ui.screens.home.HomeScreen
import com.vietsub.ai.ui.screens.home.HomeViewModel
import com.vietsub.ai.ui.screens.preview.VideoPreviewScreen
import com.vietsub.ai.ui.screens.settings.SettingsScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    // HomeViewModel scoped o day (activity) va duoc chia se cho Editor/Preview
                    // qua tham so — chua dung Hilt nen chua the inject theo backstack entry.
                    val homeViewModel: HomeViewModel = viewModel()

                    NavHost(navController = navController, startDestination = "home") {
                        composable("home") {
                            HomeScreen(
                                viewModel = homeViewModel,
                                onOpenSettings = { navController.navigate("settings") },
                                onOpenEditor = { navController.navigate("editor") }
                            )
                        }
                        composable("settings") {
                            SettingsScreen(onBack = { navController.popBackStack() })
                        }
                        composable("editor") {
                            val state by homeViewModel.uiState.collectAsState()
                            SubtitleEditorScreen(
                                initialSegments = state.subtitles,
                                onBack = { navController.popBackStack() },
                                onPreview = { navController.navigate("preview") },
                                onSave = { edited -> homeViewModel.saveEditedSubtitles(edited) }
                            )
                        }
                        composable("preview") {
                            val state by homeViewModel.uiState.collectAsState()
                            val uri = state.videoUri
                            if (uri != null) {
                                VideoPreviewScreen(
                                    videoUri = uri,
                                    segments = state.subtitles,
                                    onBack = { navController.popBackStack() }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
