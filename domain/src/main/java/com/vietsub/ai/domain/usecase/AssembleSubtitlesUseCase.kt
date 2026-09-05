package com.vietsub.ai.domain.usecase

import com.vietsub.ai.domain.ChunkStateStore
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.domain.model.TranscriptSegment

/**
 * WorkManager Data chi mang duoc du lieu nho (String/Int...), khong tien loi de
 * truyen ca danh sach SubtitleSegment tu Worker sang ViewModel. Thay vao do, sau
 * khi pipeline SUCCEEDED (hoac khi mo lai mot project da resume), ViewModel goi
 * use case nay de doc lai ket qua tung chunk da luu trong ChunkStateStore va ghep
 * thanh danh sach hoan chinh — dung chinh co che resume da co san (spec §13).
 */
class AssembleSubtitlesUseCase(
    private val chunkStateStore: ChunkStateStore,
    private val chunkManager: ChunkManager = ChunkManager()
) {
    suspend operator fun invoke(projectId: String, transcript: List<TranscriptSegment>): List<SubtitleSegment> {
        val chunks = chunkManager.buildChunks(transcript)
        val results = mutableListOf<SubtitleSegment>()
        chunks.forEach { chunk ->
            chunkStateStore.getCompletedResult(projectId, chunk.chunkIndex)?.let { results += it }
        }
        return results.sortedBy { it.id }
    }
}
