package com.vietsub.ai.ui.screens.home

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.vietsub.ai.data.translation.FileChunkStateStore
import com.vietsub.ai.data.video.VideoMetadataReader
import com.vietsub.ai.domain.ExportProgress
import com.vietsub.ai.domain.model.PipelineStage
import com.vietsub.ai.domain.model.StageProgress
import com.vietsub.ai.domain.model.StageState
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.domain.model.VideoMetadata
import com.vietsub.ai.domain.usecase.AssembleSubtitlesUseCase
import com.vietsub.ai.domain.usecase.ExportVideoUseCase
import com.vietsub.ai.ffmpeg.FFmpegVideoExporter
import com.vietsub.ai.ffmpeg.SafPathResolver
import com.vietsub.ai.pipeline.PipelineWorker
import com.vietsub.ai.subtitle.SubtitleEngineImpl
import com.vietsub.ai.subtitle.SubtitleValidator
import com.vietsub.ai.subtitle.ValidationResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.security.MessageDigest

data class HomeUiState(
    val videoUri: Uri? = null,
    val metadata: VideoMetadata? = null,
    val stages: List<StageProgress> = PipelineStage.entries.map { StageProgress(it) },
    val subtitles: List<SubtitleSegment> = emptyList(),
    val srtFile: File? = null,
    val assFile: File? = null,
    val exportedVideoUri: Uri? = null,
    val errorMessage: String? = null
)

/**
 * Phase 8: pipeline nang (extract -> STT -> translate -> subtitle) khong con chay
 * trong viewModelScope — no chay trong PipelineWorker qua WorkManager, song song
 * voi UI thread va song sot duoc process death (spec §23). ViewModel chi con
 * nhiem vu enqueue work + quan sat WorkInfo de cap nhat UI.
 *
 * TODO(Phase sau): thay manual wiring bang Hilt.
 */
class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val metadataReader = VideoMetadataReader(application)
    private val safPathResolver = SafPathResolver(application)
    private val exportVideoUseCase = ExportVideoUseCase(FFmpegVideoExporter())
    private val chunkStateStore = FileChunkStateStore(application)
    private val subtitleValidator = SubtitleValidator()
    private val subtitleEngine = SubtitleEngineImpl()
    private val assembleSubtitlesUseCase = AssembleSubtitlesUseCase(chunkStateStore)
    private val workManager = WorkManager.getInstance(application)

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    fun onVideoSelected(uri: Uri) {
        getApplication<Application>().contentResolver.takePersistableUriPermission(
            uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
        )
        val metadata = try {
            metadataReader.read(uri)
        } catch (e: Exception) {
            _uiState.update { it.copy(errorMessage = "Không đọc được metadata video") }
            return
        }
        _uiState.update { HomeUiState(videoUri = uri, metadata = metadata) }

        // Neu project nay da co ket qua tu truoc (vd. mo lai video sau khi app bi
        // kill giua chung) thi nap lai ngay, khong bat nguoi dung bam BAT DAU lai
        // tu dau — dung tinh than resume cua spec §13/§23.
        resumeIfProjectExists(uri)
    }

    private fun resumeIfProjectExists(uri: Uri) {
        val projectId = projectIdFor(uri)
        viewModelScope.launch {
            val transcript = chunkStateStore.getTranscript(projectId) ?: return@launch
            val subtitles = assembleSubtitlesUseCase(projectId, transcript)
            if (subtitles.isEmpty()) return@launch

            val outDir = File(getApplication<Application>().filesDir, "vietsub_projects/$projectId")
            val srt = File(outDir, "output.srt").takeIf { it.exists() }
            val ass = File(outDir, "output.ass").takeIf { it.exists() }

            _uiState.update {
                it.copy(
                    subtitles = subtitles,
                    srtFile = srt,
                    assFile = ass,
                    stages = it.stages.map { s ->
                        if (s.stage != PipelineStage.EXPORT) s.copy(state = StageState.DONE, percent = 100) else s
                    }
                )
            }
        }
    }

    /** Enqueue PipelineWorker — WorkManager tu quan ly retry/khong trung lap qua unique work name theo projectId. */
    fun startPipeline() {
        val state = _uiState.value
        val uri = state.videoUri ?: return
        val durationMs = state.metadata?.durationMs ?: 0L
        val projectId = projectIdFor(uri)

        val request = OneTimeWorkRequestBuilder<PipelineWorker>()
            .setInputData(
                workDataOf(
                    PipelineWorker.KEY_VIDEO_URI to uri.toString(),
                    PipelineWorker.KEY_PROJECT_ID to projectId,
                    PipelineWorker.KEY_DURATION_MS to durationMs
                )
            )
            .build()

        // KEEP: neu worker cu cua project nay dang chay (vd. nguoi dung bam lai
        // sau khi app bi kill va tu dong duoc OS relaunch), khong enqueue chong len.
        workManager.enqueueUniqueWork(PipelineWorker.uniqueWorkName(projectId), ExistingWorkPolicy.KEEP, request)
        observePipeline(projectId)
    }

    private fun observePipeline(projectId: String) {
        viewModelScope.launch {
            workManager.getWorkInfosForUniqueWorkFlow(PipelineWorker.uniqueWorkName(projectId)).collect { infos ->
                val info = infos.firstOrNull() ?: return@collect

                info.progress.getString(PipelineWorker.PROGRESS_STAGE)?.let { stageName ->
                    val stage = runCatching { PipelineStage.valueOf(stageName) }.getOrNull() ?: return@let
                    val percent = info.progress.getInt(PipelineWorker.PROGRESS_PERCENT, 0)
                    markStagesUpTo(stage, percent)
                }

                when (info.state) {
                    WorkInfo.State.SUCCEEDED -> {
                        val srtPath = info.outputData.getString(PipelineWorker.KEY_SRT_PATH)
                        val assPath = info.outputData.getString(PipelineWorker.KEY_ASS_PATH)
                        val failedCount = info.outputData.getInt(PipelineWorker.KEY_FAILED_SEGMENT_COUNT, 0)

                        val transcript = chunkStateStore.getTranscript(projectId)
                        val subtitles = transcript?.let { assembleSubtitlesUseCase(projectId, it) } ?: emptyList()

                        _uiState.update {
                            it.copy(
                                subtitles = subtitles,
                                srtFile = srtPath?.let(::File),
                                assFile = assPath?.let(::File),
                                errorMessage = if (failedCount > 0) {
                                    "$failedCount segment dịch thất bại sau khi retry — có thể thử lại các chunk lỗi."
                                } else null
                            )
                        }
                        markStagesUpTo(PipelineStage.SUBTITLE, 100)
                    }

                    WorkInfo.State.FAILED -> {
                        val error = info.outputData.getString(PipelineWorker.KEY_ERROR) ?: "Pipeline thất bại"
                        _uiState.update { it.copy(errorMessage = error) }
                    }

                    else -> Unit
                }
            }
        }
    }

    /** Danh dau moi stage truoc `stage` la DONE, chinh stage hien tai theo percent. */
    private fun markStagesUpTo(stage: PipelineStage, percent: Int) {
        _uiState.update { s ->
            s.copy(stages = s.stages.map { sp ->
                when {
                    sp.stage.ordinal < stage.ordinal -> sp.copy(state = StageState.DONE, percent = 100)
                    sp.stage == stage -> sp.copy(state = StageState.RUNNING, percent = percent)
                    else -> sp
                }
            })
        }
    }

    /**
     * Dung chung cho SubtitleEditorScreen.Save (spec §20): editor da dam bao
     * invariants (id duy nhat, endMs > startMs) qua SubtitleEditOps, nen
     * expectedIds o day chinh la id hien co — validator chi con bat overlap/empty/unicode.
     */
    fun saveEditedSubtitles(segments: List<SubtitleSegment>) {
        when (val result = subtitleValidator.validate(segments.map { it.id }.toSet(), segments)) {
            is ValidationResult.Failed -> {
                _uiState.update {
                    it.copy(errorMessage = "Subtitle validation thất bại: " + result.issues.joinToString("; ") { i -> i.message })
                }
            }
            is ValidationResult.Success -> {
                val projectId = projectIdFor(_uiState.value.videoUri)
                val outDir = File(getApplication<Application>().filesDir, "vietsub_projects/$projectId").apply { mkdirs() }
                val srtFile = File(outDir, "output.srt").apply { writeText(subtitleEngine.generateSrt(result.segments)) }
                val assFile = File(outDir, "output.ass").apply {
                    writeText(subtitleEngine.generateAss(result.segments, com.vietsub.ai.domain.model.AssStyle()))
                }
                _uiState.update { it.copy(subtitles = result.segments, srtFile = srtFile, assFile = assFile) }
            }
        }
    }

    /** Id project on dinh theo tung video, dung de resume dung chunk/audio/transcript cache (spec §13). */
    private fun projectIdFor(uri: Uri?): String {
        val source = uri?.toString() ?: "unknown"
        val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }.take(16)
    }

    /** Spec §22: burn assFile vao video, xuat ra outputUri nguoi dung chon qua SAF. */
    fun exportVideo(outputUri: Uri) {
        val state = _uiState.value
        val sourceUri = state.videoUri ?: return
        val assFile = state.assFile ?: run {
            _uiState.update { it.copy(errorMessage = "Chưa có file ASS — hãy hoàn tất bước Subtitle trước.") }
            return
        }
        val durationMs = state.metadata?.durationMs ?: 0L

        updateStage(PipelineStage.EXPORT, StageState.RUNNING, 0)

        viewModelScope.launch {
            val inputPath = safPathResolver.resolveForFfmpegRead(sourceUri)
            val outputPath = safPathResolver.resolveForFfmpegWrite(outputUri)

            exportVideoUseCase(inputPath, assFile.absolutePath, outputPath, durationMs).collect { progress ->
                when (progress) {
                    is ExportProgress.Running ->
                        updateStage(PipelineStage.EXPORT, StageState.RUNNING, progress.percent)

                    is ExportProgress.Done -> {
                        updateStage(PipelineStage.EXPORT, StageState.DONE, 100)
                        _uiState.update { it.copy(exportedVideoUri = outputUri) }
                    }

                    is ExportProgress.Failed -> {
                        updateStage(PipelineStage.EXPORT, StageState.FAILED, 0)
                        _uiState.update { it.copy(errorMessage = "Export video thất bại: ${progress.message}") }
                    }
                }
            }
        }
    }

    private fun updateStage(stage: PipelineStage, state: StageState, percent: Int) {
        _uiState.update { s ->
            s.copy(stages = s.stages.map { if (it.stage == stage) it.copy(state = state, percent = percent) else it })
        }
    }
}
