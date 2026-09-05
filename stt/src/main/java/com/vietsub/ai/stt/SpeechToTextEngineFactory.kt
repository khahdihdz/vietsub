package com.vietsub.ai.stt

import android.app.ActivityManager
import android.content.Context
import com.vietsub.ai.domain.SpeechToTextEngine
import com.vietsub.ai.domain.model.SttBackend
import com.vietsub.ai.domain.model.SttConfig
import com.vietsub.ai.stt.api.WhisperApiSpeechToTextEngine
import com.vietsub.ai.stt.local.WhisperLocalSpeechToTextEngine
import java.io.File

/**
 * Thu tu uu tien khi SttBackend.AUTO (spec §4):
 *   1. Whisper local — chi neu thiet bi du manh (heuristic: RAM tong >= 6GB)
 *   2. Whisper API — neu co apiBaseUrl cau hinh
 *   3. Backend STT tuy chon — TODO(Phase sau): implement khi co CUSTOM_BACKEND that
 *
 * Day la mot adapter factory dung theo dung tinh than spec: doi engine khong sua
 * pipeline goi no (HomeViewModel/UseCase chi biet interface SpeechToTextEngine).
 */
object SpeechToTextEngineFactory {

    private const val MIN_RAM_FOR_LOCAL_WHISPER_BYTES = 6L * 1024 * 1024 * 1024 // 6GB

    fun create(
        context: Context,
        config: SttConfig,
        apiKeyProvider: () -> String?,
        localModelPath: String? = null
    ): SpeechToTextEngine = when (config.backend) {
        SttBackend.WHISPER_LOCAL -> localEngine(localModelPath)
        SttBackend.WHISPER_API -> apiEngine(config, apiKeyProvider)
        SttBackend.CUSTOM_BACKEND -> throw UnsupportedOperationException(
            "Custom STT backend chưa được implement — chọn Whisper Local hoặc Whisper API trong Settings."
        )
        SttBackend.AUTO -> {
            if (localModelPath != null && deviceLikelyCapable(context)) {
                localEngine(localModelPath)
            } else {
                apiEngine(config, apiKeyProvider)
            }
        }
    }

    private fun localEngine(modelPath: String?): SpeechToTextEngine {
        requireNotNull(modelPath) {
            "Chưa cấu hình đường dẫn model Whisper local (Settings → STT)."
        }
        return WhisperLocalSpeechToTextEngine(modelPath)
    }

    private fun apiEngine(config: SttConfig, apiKeyProvider: () -> String?): SpeechToTextEngine {
        require(config.apiBaseUrl.isNotBlank()) { "Chưa cấu hình Base URL cho Whisper API." }
        return WhisperApiSpeechToTextEngine(
            baseUrl = config.apiBaseUrl,
            model = config.apiModel,
            apiKeyProvider = apiKeyProvider
        )
    }

    private fun deviceLikelyCapable(context: Context): Boolean {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return info.totalMem >= MIN_RAM_FOR_LOCAL_WHISPER_BYTES
    }
}
