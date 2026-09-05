package com.vietsub.ai.core.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Stores the DeepSeek/Vilao API key using Android Keystore-backed encryption.
 * Spec §27: never hard-code the key, never log it, never commit it.
 * This class must never expose the key via toString()/logging — callers read
 * getApiKey() directly and pass it straight into the Authorization header.
 */
class SecureKeyStore(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "vietsub_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun getApiKey(): String? = prefs.getString(KEY_API_KEY, null)

    fun setApiKey(value: String) {
        prefs.edit().putString(KEY_API_KEY, value).apply()
    }

    fun clearApiKey() {
        prefs.edit().remove(KEY_API_KEY).apply()
    }

    private companion object {
        const val KEY_API_KEY = "deepseek_api_key"
    }
}
