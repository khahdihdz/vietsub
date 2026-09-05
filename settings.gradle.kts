pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "VietSubAI"

include(":app")
include(":core")
include(":data")
include(":domain")
include(":ffmpeg")
include(":stt")
include(":translation")
include(":subtitle")
