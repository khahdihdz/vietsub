package com.vietsub.ai.pipeline

import android.app.Notification
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
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
import com.vietsub.ai.stt.SpeechToTextEngineFactory
import com.vietsub.ai.subtitle.SubtitleEngineImpl
import com.vietsub.ai.subtitle.SubtitleValidator
import com.vietsub.ai.subtitle.ValidationResult
import com.vietsub.ai.translation.DeepSeekTranslationEngine
import java.io.File
import java.io.IOException

class PipelineWorker(
    appContext: android.content.Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    private val logStore = PipelineLogStore(appContext)

    override suspend fun doWork(): Result {
        val videoUriStr = inputData.getString(KEY_VIDEO_URI) ?: return Result.failure(errorData("Thiếu video_uri"))
        val projectId = inputData.getString(KEY_PROJECT_ID) ?: return Result.failure(errorData("Thiếu project_id"))
        val durationMs = inputData.getLong(KEY_DURATION_MS, 0)
        val uri = Uri.parse(videoUriStr)

        logStore.reset(projectId)
        log(projectId, "VietSub AI pipeline started")
        log(projectId, "Project: $projectId")
        log(projectId, "Video: $videoUriStr")
        setForegroundSafe(0, "Đang xử lý...")

        val chunkStateStore = FileChunkStateStore(applicationContext)
        val secureKeyStore = SecureKeyStore(applicationContext)

        return try {
            log(projectId, "[1/4] Kiểm tra audio cache...")
            val audioFile = ensureAudioExtracted(uri, durationMs, projectId, chunkStateStore)
            log(projectId, "Audio ready: ${audioFile.absolutePath}")

            log(projectId, "[2/4] Speech-to-text...")
            val transcript = ensureTranscribed(audioFile, projectId, chunkStateStore, secureKeyStore)
            log(projectId, "Transcript ready: ${transcript.size} segments")

            log(projectId, "[3/4] Translation DeepSeek V4 Pro...")
            val subtitles = translateWithResume(transcript, projectId, chunkStateStore, secureKeyStore)
            log(projectId, "Translation complete: ${subtitles.size} subtitles")

            log(projectId, "[4/4] Validate + write SRT/ASS...")
            writeSubtitleFiles(transcript, subtitles, projectId)
        } catch (e: Exception) {
            log(projectId, "ERROR: ${e.stackTraceToString()}")
            log(projectId, "PIPELINE FAILED")
            Result.failure(errorData(e.message ?: "Pipeline thất bại"))
        }
    }

    private suspend fun ensureAudioExtracted(
        uri: Uri,
        durationMs: Long,
        projectId: String,
        chunkStateStore: FileChunkStateStore
    ): File {
        val cached = chunkStateStore.getAudioFilePath(projectId)?.let(::File)?.takeIf { it.exists() && it.length() > 0L }
        if (cached != null) {
            log(projectId, "Audio cache hit — skip extraction")
            reportProgress(PipelineStage.EXTRACT_AUDIO, 100, projectId)
            return cached
        }

        log(projectId, "Extracting audio...")
        reportProgress(PipelineStage.EXTRACT_AUDIO, 0, projectId)

        // Do not pass Android content:// or saf: directly to FFmpeg. Different
        // FFmpegKit forks handle SAF parameters differently, while a local file
        // path is supported consistently by all builds. Copy through a stream
        // so a large video is never loaded into RAM.
        val localInput = materializeVideoForFfmpeg(uri, projectId)
        log(projectId, "FFmpeg local input: ${localInput.absolutePath}")
        log(projectId, "FFmpeg input size: ${localInput.length()} bytes")

        val cacheDir = File(applicationContext.cacheDir, "vietsub_audio")
        var extractedFile: File? = null
        ExtractAudioUseCase(
            FFmpegAudioExtractor { message -> log(projectId, "FFmpeg: $message") }
        )(localInput.absolutePath, durationMs, cacheDir).collect { progress ->
            when (progress) {
                is ExtractionProgress.Running -> reportProgress(PipelineStage.EXTRACT_AUDIO, progress.percent, projectId)
                is ExtractionProgress.Done -> extractedFile = progress.result.audioFile
                is ExtractionProgress.Failed -> {
                    log(projectId, "Audio extraction FAILED: ${progress.message.takeLast(6000)}")
                    throw IllegalStateException("Tách audio thất bại: ${progress.message.takeLast(1500)}")
                }
            }
        }

        val file = extractedFile ?: throw IllegalStateException("Extract audio không trả về kết quả")
        chunkStateStore.saveAudioFilePath(projectId, file.absolutePath)
        reportProgress(PipelineStage.EXTRACT_AUDIO, 100, projectId)
        return file
    }

    /**
     * Converts a picker URI into a stable local cache file for FFmpeg.
     * The copy is streamed and therefore does not scale RAM usage with video size.
     */
    private fun materializeVideoForFfmpeg(uri: Uri, projectId: String): File {
        if (uri.scheme.equals("file", ignoreCase = true)) {
            val path = uri.path ?: throw IOException("File URI không có đường dẫn")
            val file = File(path)
            if (!file.isFile || file.length() <= 0L) throw IOException("Không đọc được file video: $path")
            return file
        }

        val dir = File(applicationContext.cacheDir, "vietsub_input/$projectId").apply {
            if (!exists() && !mkdirs() && !exists()) throw IOException("Không tạo được thư mục cache input")
        }
        val name = queryDisplayName(uri)
            ?.replace(Regex("[^A-Za-z0-9._-]"), "_")
            ?.take(120)
            ?.takeIf { it.isNotBlank() }
            ?: "input_video.mp4"
        val output = File(dir, name)

        if (output.isFile && output.length() > 0L) {
            log(projectId, "Input cache hit — skip URI copy")
            return output
        }

        log(projectId, "Resolving content URI through ContentResolver...")
        val resolver = applicationContext.contentResolver
        resolver.openInputStream(uri)?.use { input ->
            output.outputStream().use { out ->
                val buffer = ByteArray(DEFAULT_COPY_BUFFER_SIZE)
                var total = 0L
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (read == 0) continue
                    out.write(buffer, 0, read)
                    total += read
                    if (total % (16L * 1024L * 1024L) < read) {
                        log(projectId, "Copied input: $total bytes")
                    }
                }
                out.flush()
            }
        } ?: throw IOException("ContentResolver không mở được video URI")

        if (!output.isFile || output.length() <= 0L) {
            throw IOException("Copy video thất bại hoặc file rỗng")
        }
        log(projectId, "URI copy completed: ${output.length()} bytes")
        return output
    }

    private fun queryDisplayName(uri: Uri): String? {
        if (uri.scheme.equals("content", ignoreCase = true)) {
            applicationContext.contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst()) return cursor.getString(index)
            }
        }
        return null
    }

    private suspend fun ensureTranscribed(audioFile: File, projectId: String, chunkStateStore: FileChunkStateStore, secureKeyStore: SecureKeyStore): List<TranscriptSegment> {
        chunkStateStore.getTranscript(projectId)?.let {
            log(projectId, "Transcript cache hit — skip STT")
            reportProgress(PipelineStage.SPEECH_RECOGNITION, 100, projectId)
            return it
        }
        reportProgress(PipelineStage.SPEECH_RECOGNITION, 0, projectId)
        log(projectId, "Starting STT backend AUTO / whisper-1")
        val sttConfig = SttConfig(backend = SttBackend.AUTO, apiBaseUrl = ApiProviderConfig.DEFAULT_BASE_URL, apiModel = "whisper-1")
        val engine = SpeechToTextEngineFactory.create(
            context = applicationContext,
            config = sttConfig,
            apiKeyProvider = { secureKeyStore.getApiKey() }
        )
        val transcript = TranscribeAudioUseCase(engine)(audioFile, sttConfig.sourceLanguage)
        if (transcript.isEmpty()) throw IllegalStateException("Không nhận diện được audio")
        chunkStateStore.saveTranscript(projectId, transcript)
        log(projectId, "STT returned ${transcript.size} segments")
        reportProgress(PipelineStage.SPEECH_RECOGNITION, 100, projectId)
        return transcript
    }

    private suspend fun translateWithResume(transcript: List<TranscriptSegment>, projectId: String, chunkStateStore: FileChunkStateStore, secureKeyStore: SecureKeyStore): List<com.vietsub.ai.domain.model.SubtitleSegment> {
        reportProgress(PipelineStage.TRANSLATION, 0, projectId)
        val apiConfig = ApiProviderConfig()
        val engine = DeepSeekTranslationEngine(
            projectId = projectId, baseUrl = apiConfig.baseUrl, model = apiConfig.model,
            temperature = apiConfig.temperature, apiKeyProvider = { secureKeyStore.getApiKey() },
            chunkStateStore = chunkStateStore, maxRetries = apiConfig.maxRetries,
            onChunkProgress = { done, total ->
                val percent = if (total == 0) 0 else done * 100 / total
                reportProgress(PipelineStage.TRANSLATION, percent, projectId)
            }
        )
        val subtitles = engine.translate(transcript, sourceLanguage = "auto", targetLanguage = "vi")
        reportProgress(PipelineStage.TRANSLATION, 100, projectId)
        return subtitles
    }

    private suspend fun writeSubtitleFiles(transcript: List<TranscriptSegment>, subtitles: List<com.vietsub.ai.domain.model.SubtitleSegment>, projectId: String): Result {
        reportProgress(PipelineStage.SUBTITLE, 0, projectId)
        val validator = SubtitleValidator()
        return when (val result = validator.validate(transcript.map { it.id }.toSet(), subtitles)) {
            is ValidationResult.Failed -> {
                log(projectId, "Subtitle validation FAILED: ${result.issues.joinToString("; ") { it.message }}")
                log(projectId, "PIPELINE FAILED")
                Result.failure(errorData("Subtitle validation thất bại: " + result.issues.joinToString("; ") { it.message }))
            }
            is ValidationResult.Success -> {
                val outDir = File(applicationContext.filesDir, "vietsub_projects/$projectId").apply { mkdirs() }
                val engine = SubtitleEngineImpl()
                val srt = File(outDir, "output.srt").apply { writeText(engine.generateSrt(result.segments)) }
                val ass = File(outDir, "output.ass").apply { writeText(engine.generateAss(result.segments, AssStyle())) }
                log(projectId, "SRT: ${srt.absolutePath}")
                log(projectId, "ASS: ${ass.absolutePath}")
                reportProgress(PipelineStage.SUBTITLE, 100, projectId)
                log(projectId, "PIPELINE SUCCESS")
                Result.success(workDataOf(KEY_SRT_PATH to srt.absolutePath, KEY_ASS_PATH to ass.absolutePath, KEY_FAILED_SEGMENT_COUNT to (transcript.size - subtitles.size)))
            }
        }
    }

    private suspend fun reportProgress(stage: PipelineStage, percent: Int, projectId: String) {
        setProgress(workDataOf(PROGRESS_STAGE to stage.name, PROGRESS_PERCENT to percent))
        log(projectId, "${stageLabel(stage)}... $percent%")
        setForegroundSafe(percent, "${stageLabel(stage)}... $percent%")
    }

    private fun log(projectId: String, message: String) = logStore.append(projectId, message)

    private suspend fun setForegroundSafe(percent: Int, text: String) {
        try { setForeground(createForegroundInfo(percent, text)) } catch (_: Exception) { }
    }

    private fun createForegroundInfo(percent: Int, text: String): ForegroundInfo {
        val notification: Notification = NotificationCompat.Builder(applicationContext, VietSubApplication.PIPELINE_CHANNEL_ID)
            .setContentTitle("VietSub AI").setContentText(text).setSmallIcon(android.R.drawable.stat_sys_download)
            .setProgress(100, percent, false).setOngoing(true).build()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else ForegroundInfo(NOTIFICATION_ID, notification)
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
        private const val DEFAULT_COPY_BUFFER_SIZE = 1024 * 1024
        const val KEY_VIDEO_URI = "video_uri"
        const val KEY_PROJECT_ID = "project_id"
        const val KEY_DURATION_MS = "duration_ms"
        const val PROGRESS_STAGE = "stage"
        const val PROGRESS_PERCENT = "percent"
        const val KEY_SRT_PATH = "srt_path"
        const val KEY_ASS_PATH = "ass_path"
        const val KEY_FAILED_SEGMENT_COUNT = "failed_segment_count"
        const val KEY_ERROR = "error"
        const val NOTIFICATION_ID = 1001
        fun uniqueWorkName(projectId: String) = "vietsub_pipeline_$projectId"
    }
}
