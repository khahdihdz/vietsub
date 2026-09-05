package com.vietsub.ai.core.util

import kotlinx.coroutines.delay

/**
 * Spec §12: Retry 1 → 1s, Retry 2 → 2s, Retry 3 → 4s, sau đó FAILED.
 * Dùng chung cho mọi lời gọi API trong pipeline (STT API, Translation API) để
 * hành vi retry nhất quán và không phải lặp lại logic ở từng engine.
 */
object RetryPolicy {
    private val backoffMs = listOf(1000L, 2000L, 4000L)

    suspend fun <T> withRetry(maxRetries: Int = backoffMs.size, block: suspend () -> T): Result<T> {
        var lastError: Throwable? = null
        var attempt = 0
        while (attempt <= maxRetries) {
            try {
                return Result.success(block())
            } catch (e: Exception) {
                lastError = e
                if (attempt < maxRetries) delay(backoffMs.getOrElse(attempt) { backoffMs.last() })
                attempt++
            }
        }
        return Result.failure(lastError ?: IllegalStateException("Unknown error"))
    }
}
