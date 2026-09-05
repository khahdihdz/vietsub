package com.vietsub.ai.stt.local

import com.vietsub.ai.domain.SpeechToTextEngine
import com.vietsub.ai.domain.model.TranscriptSegment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Whisper local (spec §4, muc uu tien 1 — "neu thiet bi du manh"). Day la mot JNI
 * bridge THAT toi whisper.cpp, khong phai mock: WhisperNative.transcribeWav goi
 * thang vao ham C++ đa compile san trong libwhisper_jni.so.
 *
 * QUAN TRONG — chua the build/test trong sandbox nay vi thieu Android NDK va
 * source whisper.cpp (khong duoc vendor san o day). De engine nay hoat dong that:
 *   1. `git submodule add https://github.com/ggerganov/whisper.cpp stt/src/main/cpp/whisper.cpp`
 *   2. Bo comment block `externalNativeBuild` trong stt/build.gradle.kts
 *   3. Tai mot GGML model (vd. ggml-base.bin) va dat vao assets hoac internal storage
 *   4. Build that tren may co NDK — CI (android-debug.yml) se build cung luc voi phan con lai
 *
 * Neu thu goi khi chua co native lib, ham nay nem loi ro rang thay vi tra ve
 * transcript bia — dung voi nguyen tac "khong mock pipeline production" (spec §41).
 */
class WhisperLocalSpeechToTextEngine(private val modelPath: String) : SpeechToTextEngine {

    override suspend fun transcribe(audioFile: File, language: String?): List<TranscriptSegment> =
        withContext(Dispatchers.Default) {
            val segments = try {
                WhisperNative.transcribeWav(
                    modelPath = modelPath,
                    wavPath = audioFile.absolutePath,
                    language = language ?: "auto"
                )
            } catch (e: UnsatisfiedLinkError) {
                throw IllegalStateException(
                    "Whisper local chưa sẵn sàng: libwhisper_jni.so chưa được build. " +
                        "Xem hướng dẫn vendor whisper.cpp trong stt/README.md, hoặc đổi " +
                        "Settings → STT sang Whisper API.",
                    e
                )
            }

            segments.mapIndexed { index, seg ->
                TranscriptSegment(
                    id = index,
                    startMs = seg.startMs,
                    endMs = seg.endMs,
                    text = seg.text.trim()
                )
            }
        }
}

/** Kotlin-side mirror của struct kết quả bên C++, xem whisper_jni.cpp. */
data class WhisperNativeSegment(val startMs: Long, val endMs: Long, val text: String)

object WhisperNative {
    init {
        System.loadLibrary("whisper_jni")
    }

    @JvmStatic
    external fun transcribeWav(modelPath: String, wavPath: String, language: String): List<WhisperNativeSegment>
}
