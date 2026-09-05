package com.vietsub.ai

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class VietSubApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                PIPELINE_CHANNEL_ID,
                "VietSub AI Processing",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    companion object {
        const val PIPELINE_CHANNEL_ID = "vietsub_pipeline_channel"
    }
}
