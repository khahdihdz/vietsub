package com.vietsub.ai.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.vietsub.ai.core.ApiProviderConfig

/**
 * Spec §25. Backed by SettingsRepository (DataStore) for non-secret fields and
 * SecureKeyStore (Android Keystore) for the API key — the key field here must
 * never be included in savedInstanceState or any log statement.
 */
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    var baseUrl by remember { mutableStateOf(ApiProviderConfig.DEFAULT_BASE_URL) }
    var model by remember { mutableStateOf(ApiProviderConfig.DEFAULT_MODEL) }
    var apiKey by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Settings", style = MaterialTheme.typography.headlineMedium)
            TextButton(onClick = onBack) { Text("Back") }
        }

        Text("API", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(value = baseUrl, onValueChange = { baseUrl = it }, label = { Text("Base URL") })
        OutlinedTextField(value = model, onValueChange = { model = it }, label = { Text("Model") })
        OutlinedTextField(
            value = apiKey,
            onValueChange = { apiKey = it },
            label = { Text("API Key") },
            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation()
        )

        // TODO(Phase 2+): Subtitle (font/size/max chars/lines/format),
        // Processing (chunk duration/retry/max retry/auto cleanup),
        // Export (SRT/ASS/burn) sections. Save writes non-secret fields to
        // SettingsRepository and apiKey to SecureKeyStore.setApiKey(), never together.
    }
}
