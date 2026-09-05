package com.vietsub.ai.pipeline

import android.app.Notification
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.vietsub.ai.VietSubApplication
import com.vietsub.ai.core.ApiProviderConfig
import com.vietsub.ai.core.security.SecureKeyStore
import com.vietsub.ai.data.translation.FileChunkStateStore
import com.vietsub.ai.domain.ExtractionProgress
import com.vietsub.ai.domain.model.AssStyle
import com.vietsub.ai.domain.model.PipelineStage
import com.vietsub.ai.domain.model.SttBackend
import com.vietsub.ai.domain.model.SttConfig
import com.vietsub.ai.domain.model.TranscriptSegment
import com.vietsub.ai.domain.usecase.ExtractAudioUseCase
import com.vietsub.ai.domain.usecase.TranscribeAudioUseCase
import com.vietsub.ai.ffmpeg.FFmpegAudioExtractor
import com.vietsub.ai.ffmpeg.SafPathResolver
import com.vietsub.ai.stt.SpeechToTextEngineFactory
import com.vietsub.ai.subtitle.SubtitleEngineImpl
import com.vietsub.ai.subtitle.SubtitleValidator
import com.vietsub.ai.subtitle.ValidationResult
import com.vietsub.ai.translation.DeepSeekTranslationEngine
import java.io.File

/**
 * Spec §23: pipeline khong duoc chay tren UI thread, phai co foreground notification
 * khi xu ly nang. Spec §13: resume tu buoc/chunk cuoi chua xong, khong lam lai tu dau.
 *
 * Moi buoc deu "resume-aware":
 *   - Audio: neu ChunkStateStore da co audioFilePath va file van con ton tai -> bo qua extract.
 *   - Transcript: neu da co transcript da luu -> bo qua STT.
 *   - Translation: DeepSeekTranslationEngine tu resume theo tung chunk (co san tu Phase 4).
 *   - Subtitle: luon regenerate (re-chay validator + ghi SRT/ASS) vi day la buoc re,
 *     khong dang ke chi phi API — khong can cache rieng.
 */
class PipelineWorker(
    appContext: android.content.Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val videoUriStr = inputData.getString(KEY_VIDEO_URI) ?: return Result.failure(errorData("Thiếu video_uri"))
        val projectId = inputData.getString(KEY_PROJECT_ID) ?: return Result.failure(errorData("Thiếu project_id"))
        val durationMs = inputData.getLong(KEY_DURATION_MS, 0)
        val uri = Uri.parse(videoUriStr)

        setForegroundSafe(0, "Đang xử lý...")

        val chunkStateStore = FileChunkStateStore(applicationContext)
        val safPathResolver = SafPathResolver(applicationContext)
        val secureKeyStore = SecureKeyStore(applicationContext)

        return try {
            val audioFile = ensureAudioExtracted(uri, durationMs, projectId, chunkStateStore, safPathResolver)
            val transcript = ensureTranscribed(audioFile, projectId, chunkStateStore, secureKeyStore)
            val subtitles = translateWithResume(transcript, projectId, chunkStateStore, secureKeyStore)
            writeSubtitleFiles(transcript, subtitles, projectId)
        } catch (e: Exception) {
            Result.failure(errorData(e.message ?: "Pipeline thất bại"))
        }
    }

    private suspend fun ensureAudioExtracted(
        uri: Uri,
        durationMs: Long,
        projectId: String,
        chunkStateStore: FileChunkStateStore,
        safPathResolver: SafPathResolver
    ): File {
        val cached = chunkStateStore.getAudioFilePath(projectId)?.let(::File)?.takeIf { it.exists() }
        if (cached != null) {
            reportProgress(PipelineStage.EXTRACT_AUDIO, 100)
            return cached
        }

        reportProgress(PipelineStage.EXTRACT_AUDIO, 0)
        val cacheDir = File(applicationContext.cacheDir, "vietsub_audio")
        val safPath = safPathResolver.resolveForFfmpegRead(uri)

        var extractedFile: File? = null
        ExtractAudioUseCase(FFmpegAudioExtractor())(safPath, durationMs, cacheDir).collect { progress ->
            when (progress) {
                is ExtractionProgress.Running -> reportProgress(PipelineStage.EXTRACT_AUDIO, progress.percent)
                is ExtractionProgress.Done -> extractedFile = progress.result.audioFile
                is ExtractionProgress.Failed -> throw IllegalStateException(progress.message)
            }
        }
        val file = extractedFile ?: throw IllegalStateException("Extract audio không trả về kết quả")
        chunkStateStore.saveAudioFilePath(projectId, file.absolutePath)
        reportProgress(PipelineStage.EXTRACT_AUDIO, 100)
        return file
    }

    private suspend fun ensureTranscribed(
        audioFile: File,
        projectId: String,
        chunkStateStore: FileChunkStateStore,
        secureKeyStore: SecureKeyStore
    ): List<TranscriptSegment> {
        chunkStateStore.getTranscript(projectId)?.let {
            reportProgress(PipelineStage.SPEECH_RECOGNITION, 100)
            return it
        }

        reportProgress(PipelineStage.SPEECH_RECOGNITION, 0)
        // TODO(Settings screen): doc SttConfig that tu SettingsRepository.
        val sttConfig = SttConfig(backend = SttBackend.AUTO, apiBaseUrl = ApiProviderConfig.DEFAULT_BASE_URL, apiModel = "whisper-1")
        val engine = SpeechToTextEngineFactory.create(
            context = applicationContext,
            config = sttConfig,
            apiKeyProvider = { secureKeyStore.getApiKey() }
        )
        val transcript = TranscribeAudioUseCase(engine)(audioFile, sttConfig.sourceLanguage)
        if (transcript.isEmpty()) throw IllegalStateException("Không nhận diện được audio")

        chunkStateStore.saveTranscript(projectId, transcript)
        reportProgress(PipelineStage.SPEECH_RECOGNITION, 100)
        return transcript
    }

    private suspend fun translateWithResume(
        transcript: List<TranscriptSegment>,
        projectId: String,
        chunkStateStore: FileChunkStateStore,
        secureKeyStore: SecureKeyStore
    ): List<com.vietsub.ai.domain.model.SubtitleSegment> {
        reportProgress(PipelineStage.TRANSLATION, 0)
        val apiConfig = ApiProviderConfig()
        val engine = DeepSeekTranslationEngine(
            projectId = projectId,
            baseUrl = apiConfig.baseUrl,
            model = apiConfig.model,
            temperature = apiConfig.temperature,
            apiKeyProvider = { secureKeyStore.getApiKey() },
            chunkStateStore = chunkStateStore,
            maxRetries = apiConfig.maxRetries,
            onChunkProgress = { done, total ->
                reportProgress(PipelineStage.TRANSLATION, if (total == 0) 0 else done * 100 / total)
            }
        )
        val subtitles = engine.translate(transcript, sourceLanguage = "auto", targetLanguage = "vi")
        reportProgress(PipelineStage.TRANSLATION, 100)
        return subtitles
    }

    private suspend fun writeSubtitleFiles(
        transcript: List<TranscriptSegment>,
        subtitles: List<com.vietsub.ai.domain.model.SubtitleSegment>,
        projectId: String
    ): Result {
        reportProgress(PipelineStage.SUBTITLE, 0)
        val validator = SubtitleValidator()
        return when (val result = validator.validate(transcript.map { it.id }.toSet(), subtitles)) {
            is ValidationResult.Failed -> Result.failure(
                errorData("Subtitle validation thất bại: " + result.issues.joinToString("; ") { it.message })
            )
            is ValidationResult.Success -> {
                val outDir = File(applicationContext.filesDir, "vietsub_projects/$projectId").apply { mkdirs() }
                val engine = SubtitleEngineImpl()
                val srt = File(outDir, "output.srt").apply { writeText(engine.generateSrt(result.segments)) }
                val ass = File(outDir, "output.ass").apply { writeText(engine.generateAss(result.segments, AssStyle())) }
                reportProgress(PipelineStage.SUBTITLE, 100)
                Result.success(
                    workDataOf(
                        KEY_SRT_PATH to srt.absolutePath,
                        KEY_ASS_PATH to ass.absolutePath,
                        KEY_FAILED_SEGMENT_COUNT to (transcript.size - subtitles.size)
                    )
                )
            }
        }
    }

    private suspend fun reportProgress(stage: PipelineStage, percent: Int) {
        setProgress(workDataOf(PROGRESS_STAGE to stage.name, PROGRESS_PERCENT to percent))
        setForegroundSafe(percent, "${stageLabel(stage)}... $percent%")
    }

    /** setForeground co the that bai neu OS tu choi promote (hiem, quota) — khong de crash ca pipeline vi 1 notification. */
    private suspend fun setForegroundSafe(percent: Int, text: String) {
        try {
            setForeground(createForegroundInfo(percent, text))
        } catch (e: Exception) {
            // Bo qua — notification chi la UX phu, khong phai dieu kien de tiep tuc xu ly.
        }
    }

    private fun createForegroundInfo(percent: Int, text: String): ForegroundInfo {
        val notification: Notification = NotificationCompat.Builder(applicationContext, VietSubApplication.PIPELINE_CHANNEL_ID)
            .setContentTitle("VietSub AI")
            .setContentText(text) // spec §23: "Đang dịch phụ đề... 65%"
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setProgress(100, percent, false)
            .setOngoing(true)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    private fun stageLabel(stage: PipelineStage) = when (stage) {
        PipelineStage.EXTRACT_AUDIO -> "Tách audio"
        PipelineStage.SPEECH_RECOGNITION -> "Nhận diện giọng nói"
        PipelineStage.TRANSLATION -> "Đang dịch phụ đề"
        PipelineStage.SUBTITLE -> "Tạo phụ đề"
        PipelineStage.EXPORT -> "Xuất video"
    }

    private fun errorData(message: String) = workDataOf(KEY_ERROR to message)

    companion object {
        const val KEY_VIDEO_URI = "video_uri"
        const val KEY_PROJECT_ID = "project_id"
        const val KEY_DURATION_MS = "duration_ms"

        const val PROGRESS_STAGE = "stage"
        const val PROGRESS_PERCENT = "percent"

        const val KEY_SRT_PATH = "srt_path"
        const val KEY_ASS_PATH = "ass_path"
        const val KEY_FAILED_SEGMENT_COUNT = "failed_segment_count"
        const val KEY_ERROR = "error"

        private const val NOTIFICATION_ID = 1001

        fun uniqueWorkName(projectId: String) = "vietsub_pipeline_$projectId"
    }
}
