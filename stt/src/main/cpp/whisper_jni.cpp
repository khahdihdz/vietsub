#include <jni.h>
#include <string>
#include <vector>
#include <fstream>
#include <cstring>
#include <android/log.h>
#include "whisper.h"

#define LOG_TAG "whisper_jni"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// Doc WAV PCM16 mono 16kHz (dung dinh dang FFmpegAudioExtractor xuat ra o Phase 2)
// thanh mang float [-1, 1] ma whisper_full yeu cau. Khong resample/khong doi kenh —
// neu file dau vao khong dung 16kHz mono, tra ve false thay vi doan mo.
static bool read_wav_mono16k_pcm16(const std::string &path, std::vector<float> &out) {
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) {
        LOGE("Khong mo duoc file WAV: %s", path.c_str());
        return false;
    }

    char riff[4];
    file.read(riff, 4);
    if (std::strncmp(riff, "RIFF", 4) != 0) {
        LOGE("File khong phai RIFF/WAV hop le");
        return false;
    }
    file.seekg(22);
    int16_t numChannels = 0;
    file.read(reinterpret_cast<char *>(&numChannels), 2);
    int32_t sampleRate = 0;
    file.read(reinterpret_cast<char *>(&sampleRate), 4);
    file.seekg(34);
    int16_t bitsPerSample = 0;
    file.read(reinterpret_cast<char *>(&bitsPerSample), 2);

    if (numChannels != 1 || sampleRate != 16000 || bitsPerSample != 16) {
        LOGE("WAV khong dung mono/16kHz/16-bit (channels=%d rate=%d bits=%d)",
             numChannels, sampleRate, bitsPerSample);
        return false;
    }

    // Tim chunk "data"
    char chunkId[4];
    uint32_t chunkSize = 0;
    file.seekg(36);
    while (file.read(chunkId, 4)) {
        file.read(reinterpret_cast<char *>(&chunkSize), 4);
        if (std::strncmp(chunkId, "data", 4) == 0) break;
        file.seekg(chunkSize, std::ios::cur);
    }
    if (std::strncmp(chunkId, "data", 4) != 0) {
        LOGE("Khong tim thay chunk 'data' trong WAV");
        return false;
    }

    std::vector<int16_t> pcm(chunkSize / 2);
    file.read(reinterpret_cast<char *>(pcm.data()), chunkSize);

    out.resize(pcm.size());
    for (size_t i = 0; i < pcm.size(); ++i) {
        out[i] = static_cast<float>(pcm[i]) / 32768.0f;
    }
    return true;
}

extern "C"
JNIEXPORT jobject JNICALL
Java_com_vietsub_ai_stt_local_WhisperNative_transcribeWav(
        JNIEnv *env, jclass /* clazz */,
        jstring jModelPath, jstring jWavPath, jstring jLanguage) {

    const char *modelPath = env->GetStringUTFChars(jModelPath, nullptr);
    const char *wavPath = env->GetStringUTFChars(jWavPath, nullptr);
    const char *language = env->GetStringUTFChars(jLanguage, nullptr);

    jclass arrayListClass = env->FindClass("java/util/ArrayList");
    jmethodID arrayListInit = env->GetMethodID(arrayListClass, "<init>", "()V");
    jmethodID arrayListAdd = env->GetMethodID(arrayListClass, "add", "(Ljava/lang/Object;)Z");
    jobject resultList = env->NewObject(arrayListClass, arrayListInit);

    std::vector<float> pcmf32;
    if (!read_wav_mono16k_pcm16(wavPath, pcmf32)) {
        env->ReleaseStringUTFChars(jModelPath, modelPath);
        env->ReleaseStringUTFChars(jWavPath, wavPath);
        env->ReleaseStringUTFChars(jLanguage, language);
        return resultList; // rong -> caller (Kotlin) coi la khong nhan dien duoc, khong bia data
    }

    struct whisper_context_params cparams = whisper_context_default_params();
    struct whisper_context *ctx = whisper_init_from_file_with_params(modelPath, cparams);
    if (ctx == nullptr) {
        LOGE("Khong load duoc model tai %s", modelPath);
        env->ReleaseStringUTFChars(jModelPath, modelPath);
        env->ReleaseStringUTFChars(jWavPath, wavPath);
        env->ReleaseStringUTFChars(jLanguage, language);
        return resultList;
    }

    whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    wparams.print_progress = false;
    wparams.print_special = false;
    wparams.print_realtime = false;
    wparams.print_timestamps = false;
    wparams.translate = false; // spec: STT chi nhan dien, khong tu dich — dich la buoc rieng (DeepSeek)
    wparams.language = (std::strcmp(language, "auto") == 0) ? nullptr : language;
    wparams.n_threads = 4;

    int rc = whisper_full(ctx, wparams, pcmf32.data(), static_cast<int>(pcmf32.size()));
    if (rc != 0) {
        LOGE("whisper_full that bai, rc=%d", rc);
        whisper_free(ctx);
        env->ReleaseStringUTFChars(jModelPath, modelPath);
        env->ReleaseStringUTFChars(jWavPath, wavPath);
        env->ReleaseStringUTFChars(jLanguage, language);
        return resultList;
    }

    jclass segClass = env->FindClass("com/vietsub/ai/stt/local/WhisperNativeSegment");
    jmethodID segInit = env->GetMethodID(segClass, "<init>", "(JJLjava/lang/String;)V");

    int nSegments = whisper_full_n_segments(ctx);
    for (int i = 0; i < nSegments; ++i) {
        int64_t t0 = whisper_full_get_segment_t0(ctx, i); // don vi 10ms
        int64_t t1 = whisper_full_get_segment_t1(ctx, i);
        const char *text = whisper_full_get_segment_text(ctx, i);

        jstring jText = env->NewStringUTF(text);
        jobject seg = env->NewObject(segClass, segInit,
                                      static_cast<jlong>(t0 * 10),
                                      static_cast<jlong>(t1 * 10),
                                      jText);
        env->CallBooleanMethod(resultList, arrayListAdd, seg);
        env->DeleteLocalRef(jText);
        env->DeleteLocalRef(seg);
    }

    whisper_free(ctx);
    env->ReleaseStringUTFChars(jModelPath, modelPath);
    env->ReleaseStringUTFChars(jWavPath, wavPath);
    env->ReleaseStringUTFChars(jLanguage, language);

    return resultList;
}
