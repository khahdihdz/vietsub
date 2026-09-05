plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.vietsub.ai.ffmpeg"
    compileSdk = 34
    defaultConfig {
        minSdk = 26
        // Spec §38: uu tien arm64-v8a cho release; giu armeabi-v7a cho thiet bi cu,
        // x86_64 cho emulator. Loai bo ABI khong can neu muon giam size APK.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging {
        // Tranh Gradle build fail vi trung native lib giua cac ABI package (spec §38).
        jniLibs.pickFirsts.add("**/libc++_shared.so")
    }
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":core"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Maintained FFmpegKit fork. The original com.arthenica binaries were
    // removed from Maven Central after FFmpegKit was retired. The maintained
    // fork preserves the com.arthenica.ffmpegkit Java/Kotlin API, so existing
    // FFmpegAudioExtractor code does not need import changes.
    implementation("dev.ffmpegkit-maintained:ffmpeg-kit-full:8.1.7")
}
