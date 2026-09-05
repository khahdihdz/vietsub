package com.vietsub.ai.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.vietsub.ai.core.ApiProviderConfig
import com.vietsub.ai.core.security.SecureKeyStore

/**
 * API settings.
 *
 * The API key is persisted separately through SecureKeyStore, backed by the
 * Android Keystore. The key is never logged or included in saved UI state.
 */
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val secureKeyStore = remember(context) { SecureKeyStore(context.applicationContext) }

    var baseUrl by remember { mutableStateOf(ApiProviderConfig.DEFAULT_BASE_URL) }
    var model by remember { mutableStateOf(ApiProviderConfig.DEFAULT_MODEL) }
    var apiKey by remember { mutableStateOf("") }
    var hasSavedKey by remember { mutableStateOf(secureKeyStore.getApiKey()?.isNotBlank() == true) }
    var saved by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
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

        OutlinedTextField(
            value = baseUrl,
            onValueChange = {
                baseUrl = it
                saved = false
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Base URL") },
            singleLine = true
        )

        OutlinedTextField(
            value = model,
            onValueChange = {
                model = it
                saved = false
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Model") },
            singleLine = true
        )

        OutlinedTextField(
            value = apiKey,
            onValueChange = {
                apiKey = it
                saved = false
            },
            modifier = Modifier.fillMaxWidth(),
            label = {
                Text(if (hasSavedKey) "API Key (saved, enter new key to replace)" else "API Key")
            },
            placeholder = { Text("Paste API key") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true
        )

        Button(
            onClick = {
                val value = apiKey.trim()
                if (value.isNotEmpty()) {
                    secureKeyStore.setApiKey(value)
                    apiKey = ""
                    hasSavedKey = true
                }
                saved = true
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = apiKey.isNotBlank() || hasSavedKey
        ) {
            Text("Save API settings")
        }

        if (saved) {
            Text(
                text = "API key saved securely.",
                color = MaterialTheme.colorScheme.primary
            )
        }

        if (hasSavedKey) {
            OutlinedButton(
                onClick = {
                    secureKeyStore.clearApiKey()
                    apiKey = ""
                    hasSavedKey = false
                    saved = true
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Clear saved API key")
            }
        }
    }
}
