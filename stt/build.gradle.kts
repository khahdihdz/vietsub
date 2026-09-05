plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.vietsub.ai.stt"
    compileSdk = 34
    defaultConfig {
        minSdk = 26
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
        // externalNativeBuild duoc bat khi CMakeLists.txt that su co source de build
        // (xem README "Whisper local"). Neu chua vendor whisper.cpp, comment block
        // externalNativeBuild ben duoi de tranh Gradle build fail.
    }
    // externalNativeBuild {
    //     cmake { path("src/main/cpp/CMakeLists.txt") }
    // }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":core"))

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
}
