package com.vietsub.ai.core

/**
 * Configurable connection details for the translation API (spec §3, §25).
 * Never hard-code an apiKey here — it is loaded at runtime from
 * [com.vietsub.ai.core.security.SecureKeyStore], never logged, never committed.
 */
data class ApiProviderConfig(
    val baseUrl: String = DEFAULT_BASE_URL,
    val model: String = DEFAULT_MODEL,
    val temperature: Double = 0.2,
    val timeoutSeconds: Long = 60,
    val maxRetries: Int = 3
) {
    companion object {
        const val DEFAULT_BASE_URL = "https://api.vilao.ai/v1"
        const val DEFAULT_MODEL = "deepseek-v4-pro"
    }
}
