package com.vietsub.ai.pipeline

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Persistent, append-only terminal-style log for a pipeline run. */
class PipelineLogStore(private val context: Context) {
    private val logDir = File(context.filesDir, "vietsub_logs")

    fun file(projectId: String): File = File(logDir, "$projectId.log")

    @Synchronized
    fun reset(projectId: String) {
        logDir.mkdirs()
        file(projectId).writeText("")
    }

    @Synchronized
    fun append(projectId: String, message: String) {
        logDir.mkdirs()
        val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        file(projectId).appendText("[$timestamp] $message\n")
    }

    fun read(projectId: String): String = file(projectId).takeIf { it.exists() }?.readText() ?: ""
}
