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

    // FFmpeg Android binding. ffmpeg-kit (arthenica) da ngung phat trien/archive
    // tu 2023 — cac artifact da publish van resolve duoc tu Maven Central nhung
    // khong con duoc cap nhat. Hai huong xu ly:
    //   1. Giu coordinate nay (chay duoc ngay hom nay, tu pin version + tu audit CVE), hoac
    //   2. Doi sang fork do cong dong duy tri hoac tu build .aar rieng — chi can sua
    //      FFmpegAudioExtractor.kt, phan con lai cua app khong can biet.
    // Xem README, muc "FFmpeg dependency".
    implementation("com.arthenica:ffmpeg-kit-full:6.0-2")
}
