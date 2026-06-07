# Sidecar Binaries

Place pre-compiled llama.cpp server binaries here for each platform:

## Required files:

- `llama-server-x86_64-pc-windows-msvc.exe` — Windows x64
- `llama-server-x86_64-unknown-linux-gnu` — Linux x64
- `llama-server-aarch64-unknown-linux-gnu` — Linux ARM64
- `llama-server-x86_64-apple-darwin` — macOS Intel
- `llama-server-aarch64-apple-darwin` — macOS Apple Silicon
- `llama-server-universal-apple-darwin` — macOS Universal

## Building llama.cpp server

```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build server
cmake -B build -DLLAMA_CURL=ON
cmake --build build --target llama-server --config Release

# Copy the built binary to this directory with the appropriate platform suffix
```

## Notes

- Tauri requires sidecar binaries to be named with the target triple suffix
- The binary will be resolved automatically based on the current platform
- For GPU acceleration, build with appropriate flags (CUDA, Metal, ROCm)
