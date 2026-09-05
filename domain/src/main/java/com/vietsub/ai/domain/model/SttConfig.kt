package com.vietsub.ai.domain.model

/**
 * 3 lựa chọn theo spec §4, ưu tiên theo đúng thứ tự đó khi ở chế độ AUTO:
 * 1. Whisper local (nếu thiết bị đủ mạnh)
 * 2. Whisper API
 * 3. Backend STT tùy chọn
 */
enum class SttBackend { AUTO, WHISPER_LOCAL, WHISPER_API, CUSTOM_BACKEND }

data class SttConfig(
    val backend: SttBackend = SttBackend.AUTO,
    val apiBaseUrl: String = "",
    val apiModel: String = "whisper-1",
    val sourceLanguage: String? = null // null = Auto Detect (spec §4 default)
)
