package com.vietsub.ai.domain

import com.vietsub.ai.domain.model.ChunkStatus
import com.vietsub.ai.domain.model.SubtitleSegment
import com.vietsub.ai.domain.model.TranscriptSegment

/**
 * Spec §13: moi chunk phai luu trang thai PENDING/PROCESSING/COMPLETED/FAILED.
 * Sau moi chunk thanh cong phai luu ket qua ngay — neu app bi kill, resume phai
 * tiep tuc tu chunk cuoi chua hoan thanh, khong dich lai chunk da xong.
 *
 * Spec §23/§8 (giai doan): "Resume project" khong chi ap dung o cap chunk dich ma
 * o toan bo pipeline — neu audio da tach xong hoac STT da chay xong truoc khi app
 * bi kill, khong duoc lam lai tu dau. audioFilePath/transcript o duoi day phuc vu
 * dung muc dich do, cung mot project state voi chunk status.
 */
interface ChunkStateStore {
    suspend fun getStatus(projectId: String, chunkIndex: Int): ChunkStatus?
    suspend fun getCompletedResult(projectId: String, chunkIndex: Int): List<SubtitleSegment>?
    suspend fun saveChunkResult(projectId: String, chunkIndex: Int, result: List<SubtitleSegment>)
    suspend fun markStatus(projectId: String, chunkIndex: Int, status: ChunkStatus)
    suspend fun clearProject(projectId: String)

    suspend fun saveAudioFilePath(projectId: String, path: String)
    suspend fun getAudioFilePath(projectId: String): String?

    suspend fun saveTranscript(projectId: String, transcript: List<TranscriptSegment>)
    suspend fun getTranscript(projectId: String): List<TranscriptSegment>?
}
