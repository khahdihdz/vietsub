# VietSub AI

Native Android app: pick a video → extract audio → speech-to-text → context-aware
translation to Vietnamese via DeepSeek V4 Pro → SRT/ASS subtitles → edit/preview →
burn subtitles in with FFmpeg → finished video.

**Status: Phase 8 of 10** (see Development Phases below). The heavy pipeline
(extract → STT → translate → subtitle) now runs entirely inside `PipelineWorker`
via WorkManager instead of `viewModelScope` (spec §23) — it survives the Activity
being destroyed, shows a real foreground notification with live percent, and is
resume-aware at every stage, not just per-chunk: if the app/process is killed
mid-run, re-opening the same video skips audio extraction and STT if their results
are already cached on disk, and translation continues from the last incomplete
chunk exactly as it did before (spec §13). `HomeViewModel` now only enqueues work
and observes `WorkInfo` — it no longer runs any pipeline step itself. Automated
retry-failed-chunks UI is still missing — that's Phase 9/10 territory.

## FFmpeg dependency

This project uses `com.arthenica:ffmpeg-kit-full:6.0-2`. **Heads up:** ffmpeg-kit was
archived/retired by its maintainer in 2023. The last published artifacts still resolve
from Maven Central today and work fine, but receive no further security or codec
updates. Two paths forward before shipping to real users:

1. Pin this version, audit it yourself, accept the risk — fine for prototyping.
2. Swap to a community-maintained fork or a self-built `.aar`. Only
   `ffmpeg/src/main/java/com/vietsub/ai/ffmpeg/FFmpegAudioExtractor.kt` and
   `SafPathResolver.kt` need to change — the rest of the app talks to the
   `AudioExtractor` interface in `domain`, not to FFmpegKit directly.

## Architecture

```
UI → ViewModel → UseCase → Repository → Service/Engine
```

Modules: `core`, `data`, `domain`, `ffmpeg`, `stt`, `translation`, `subtitle`, `app` (`ui`).

## Requirements

- Android Studio (Koala+) / JDK 17
- Android SDK 34, min SDK 26
- FFmpeg (bundled via native library, Phase 2)
- A DeepSeek V4 Pro–compatible API key (Vilao: `https://api.vilao.ai/v1`)

## API configuration

Set in-app under Settings → API: Base URL, API Key, Model, Temperature, Timeout.
The API key is stored via Android Keystore-backed `EncryptedSharedPreferences`
(`core/security/SecureKeyStore.kt`) — never hard-coded, never logged, never committed.

## Local build

```
./gradlew assembleDebug
```

## GitHub Actions build

- `.github/workflows/android-debug.yml` — runs on every push/PR to `main`/`develop`;
  uploads `VietSubAI-debug.apk` as a build artifact.
- `.github/workflows/android-release.yml` — runs on `v*` tags or manual dispatch;
  creates a GitHub Release with the built APK attached, **only if** tests, lint, and
  build all pass and the APK is non-empty (quality gate, spec §33).

## Signing

Release signing reads four GitHub Secrets:

- `KEYSTORE_BASE64` — your `.jks`/`.keystore` file, base64-encoded
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

Without these configured, `assembleRelease` still succeeds but produces an
**unsigned** artifact — fine for CI verification, not for distribution. To generate
a keystore and encode it:

```
keytool -genkey -v -keystore release.keystore -alias vietsub -keyalg RSA -keysize 2048 -validity 10000
base64 -i release.keystore | pbcopy   # paste into the KEYSTORE_BASE64 secret
```

## Troubleshooting

- **APK missing from CI artifacts** — check the "Upload diagnostics on failure" step;
  Gradle/test/lint reports are uploaded whenever a build fails (spec §34).
- **Release didn't get created** — the quality gate blocks release creation on any
  test, lint, build, or empty-APK failure; check the workflow run logs.

## Development Phases

1. Project + Compose + Settings + video picker
2. FFmpeg + audio extraction
3. Whisper/STT adapter
4. DeepSeek API + chunk translation + retry
5. SRT + ASS + validator + line breaker
6. Subtitle editor + video preview
7. FFmpeg burn subtitle + export
8. WorkManager + background processing + resume
9. Tests + performance + error handling ← current
10. GitHub Actions + APK + Release CI/CD (workflows already scaffolded above)
