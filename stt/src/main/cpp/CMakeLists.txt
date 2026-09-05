cmake_minimum_required(VERSION 3.22)
project(whisper_jni)

# Yeu cau: submodule whisper.cpp da duoc vendor tai stt/src/main/cpp/whisper.cpp
#   git submodule add https://github.com/ggerganov/whisper.cpp stt/src/main/cpp/whisper.cpp
# Neu thu muc nay rong, build se fail ro rang thay vi silent-skip.
if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp/CMakeLists.txt")
    message(FATAL_ERROR
        "whisper.cpp chua duoc vendor. Chay: git submodule add "
        "https://github.com/ggerganov/whisper.cpp stt/src/main/cpp/whisper.cpp")
endif()

add_subdirectory(whisper.cpp)

add_library(whisper_jni SHARED whisper_jni.cpp)

target_link_libraries(whisper_jni
    whisper
    android
    log
)

target_include_directories(whisper_jni PRIVATE whisper.cpp/include whisper.cpp/ggml/include)
