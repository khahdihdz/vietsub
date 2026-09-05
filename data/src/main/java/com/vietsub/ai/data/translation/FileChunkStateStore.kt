package com.vietsub.ai.data.translation

import android.content.Context
import com.vietsub.ai.domain.ChunkStateStore
import com.vietsub.ai.domain.model.ChunkStatus
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.domain.model.TranscriptSegment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Spec S13: luu trang thai + ket qua tung chunk ngay sau khi hoan thanh, de neu
 * app/Android kill process, "Resume project" tiep tuc tu chunk cuoi chua xong thay
 * vi dich lai tu dau. Moi project mot file JSON duoi filesDir/vietsub_projects/.
 *
 * Phase 8 mo rong: cung file nay luu them audioFilePath va transcript (STT) — de
 * PipelineWorker resume dung ca o cap "buoc" (extract/STT), khong chi cap chunk
 * dich, dung theo tinh than spec S23 "khong duoc lam mat progress khi app bi dong".
 *
 * Dung file JSON don gian thay vi Room de giam boilerplate cho scaffold nay — spec
 * S2 liet ke "Room hoac DataStore" nhu lua chon, day la mot bien the tuong duong
 * ve mat hanh vi (ghi dia ngay, doc lai duoc sau khi kill process).
 */
class FileChunkStateStore(context: Context) : ChunkStateStore {

    private val baseDir = File(context.filesDir, "vietsub_projects").apply { mkdirs() }
    private val json = Json { prettyPrint = false; ignoreUnknownKeys = true }
    private val mutex = Mutex() // tranh doc-ghi dong thoi lam hong file JSON

    @Serializable
    private data class ChunkRecord(
        val status: String, // ChunkStatus.name — domain module khong co serialization plugin
        val result: List<SerializableSubtitleSegment>? = null
    )

    @Serializable
    private data class SerializableSubtitleSegment(
        val id: Int,
        val startMs: Long,
        val endMs: Long,
        val originalText: String,
        val translatedText: String
    )

    @Serializable
    private data class SerializableTranscriptSegment(
        val id: Int,
        val startMs: Long,
        val endMs: Long,
        val text: String
    )

    @Serializable
    private data class ProjectState(
        val chunks: MutableMap<String, ChunkRecord> = mutableMapOf(),
        val audioFilePath: String? = null,
        val transcript: List<SerializableTranscriptSegment>? = null
    )

    private fun fileFor(projectId: String) = File(baseDir, "$projectId.json")

    private suspend fun readState(projectId: String): ProjectState = withContext(Dispatchers.IO) {
        val file = fileFor(projectId)
        if (!file.exists()) return@withContext ProjectState()
        try {
            json.decodeFromString(ProjectState.serializer(), file.readText())
        } catch (e: Exception) {
            ProjectState() // file hong/tuong thich cu -> bat dau lai thay vi crash resume
        }
    }

    private suspend fun writeState(projectId: String, state: ProjectState) = withContext(Dispatchers.IO) {
        fileFor(projectId).writeText(json.encodeToString(ProjectState.serializer(), state))
    }

    override suspend fun getStatus(projectId: String, chunkIndex: Int): ChunkStatus? =
        readState(projectId).chunks[chunkIndex.toString()]?.status?.let {
            try { ChunkStatus.valueOf(it) } catch (e: IllegalArgumentException) { null }
        }

    override suspend fun getCompletedResult(projectId: String, chunkIndex: Int): List<SubtitleSegment>? =
        readState(projectId).chunks[chunkIndex.toString()]?.result?.map {
            SubtitleSegment(it.id, it.startMs, it.endMs, it.originalText, it.translatedText, ChunkStatus.COMPLETED)
        }

    override suspend fun saveChunkResult(projectId: String, chunkIndex: Int, result: List<SubtitleSegment>) {
        mutex.withLock {
            val state = readState(projectId)
            state.chunks[chunkIndex.toString()] = ChunkRecord(
                status = ChunkStatus.COMPLETED.name,
                result = result.map { SerializableSubtitleSegment(it.id, it.startMs, it.endMs, it.originalText, it.translatedText) }
            )
            writeState(projectId, state)
        }
    }

    override suspend fun markStatus(projectId: String, chunkIndex: Int, status: ChunkStatus) {
        mutex.withLock {
            val state = readState(projectId)
            val existing = state.chunks[chunkIndex.toString()]
            state.chunks[chunkIndex.toString()] = existing?.copy(status = status.name) ?: ChunkRecord(status = status.name)
            writeState(projectId, state)
        }
    }

    override suspend fun clearProject(projectId: String) {
        withContext(Dispatchers.IO) { fileFor(projectId).delete() }
    }

    override suspend fun saveAudioFilePath(projectId: String, path: String) {
        mutex.withLock { writeState(projectId, readState(projectId).copy(audioFilePath = path)) }
    }

    override suspend fun getAudioFilePath(projectId: String): String? =
        readState(projectId).audioFilePath

    override suspend fun saveTranscript(projectId: String, transcript: List<TranscriptSegment>) {
        mutex.withLock {
            val serializable = transcript.map { SerializableTranscriptSegment(it.id, it.startMs, it.endMs, it.text) }
            writeState(projectId, readState(projectId).copy(transcript = serializable))
        }
    }

    override suspend fun getTranscript(projectId: String): List<TranscriptSegment>? =
        readState(projectId).transcript?.map { TranscriptSegment(it.id, it.startMs, it.endMs, it.text) }
}
