@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: Tanuki Stories – Interactive Installer (Windows)
:: Supports: vLLM, llama.cpp (local), external OpenAI-compatible API, mock mode
:: Usage:  install.bat
:: ─────────────────────────────────────────────────────────────────────────────
setlocal EnableDelayedExpansion
title Tanuki Stories Installer

set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "CYAN=[96m"
set "BOLD=[1m"
set "RESET=[0m"

:: ── Banner ───────────────────────────────────────────────────────────────────
call :print_banner

:: ── Prereq checks ────────────────────────────────────────────────────────────
call :check_prereqs

:: ── npm install ──────────────────────────────────────────────────────────────
call :run_npm_install

:: ── AI backend selection ─────────────────────────────────────────────────────
echo.
echo %CYAN%──────────────────────────────────────────────────────%RESET%
echo.
echo %BOLD%How should Tanuki Stories connect to an AI model?%RESET%
echo.
echo   %CYAN%1%RESET%) Local -- vLLM         ^(NVIDIA GPU required^)
echo   %CYAN%2%RESET%) Local -- llama.cpp    ^(CPU or GPU, GGUF models^)
echo   %CYAN%3%RESET%) External API         ^(OpenAI, Ollama, LM Studio, etc.^)
echo   %CYAN%4%RESET%) Mock / no AI         ^(demo mode, no API needed^)
echo.
set /p BE_CHOICE="Enter number [1]: "
if "%BE_CHOICE%"=="" set BE_CHOICE=1

if "%BE_CHOICE%"=="1" (
    call :check_python
    call :install_vllm
) else if "%BE_CHOICE%"=="2" (
    call :check_python
    call :install_llamacpp
) else if "%BE_CHOICE%"=="3" (
    call :configure_external_api
) else if "%BE_CHOICE%"=="4" (
    echo.
    echo %CYAN%[Tanuki]%RESET% Mock mode selected -- no AI backend will be configured.
    echo.
    set BACKEND_URL=
    set BACKEND_MODEL=
    set BACKEND_API_KEY=
) else (
    echo %YELLOW%  Warning: Unknown choice, defaulting to mock mode.%RESET%
    set BACKEND_URL=
    set BACKEND_MODEL=
    set BACKEND_API_KEY=
)

:: ── Credentials ──────────────────────────────────────────────────────────────
echo.
echo %CYAN%──────────────────────────────────────────────────────%RESET%
call :configure_credentials

:: ── Write .env.local ─────────────────────────────────────────────────────────
call :write_env

:: ── Summary ──────────────────────────────────────────────────────────────────
call :print_summary
goto :eof

:: =============================================================================
:: SUBROUTINES
:: =============================================================================

:print_banner
echo.
echo %CYAN%%BOLD%
echo   ######   ##    ##   ##     ## ##   ## ##  ##
echo      ##   ####   ####  ##   ##  ##  ##  ## ##
echo      ##  ##  ##  ## ## ##  ##   ## ##   ####
echo      ##  ######  ##  ####  ##   ####    ##
echo      ##  ##  ##  ##   ### ##    ## ##   ###
echo      ##  ##  ##  ##    ##  ##   ##  ##  ## ##
echo %RESET%
echo   %BOLD%Tanuki Stories -- Interactive Installer (Windows)%RESET%
echo   %CYAN%──────────────────────────────────────────────────────%RESET%
echo.
goto :eof

:check_prereqs
echo %CYAN%[Tanuki]%RESET% Checking prerequisites...
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo %RED%  X  Node.js is required. Install from https://nodejs.org%RESET%
    pause
    exit /b 1
)
echo %GREEN%  OK%RESET% node found
where npm >nul 2>&1
if errorlevel 1 (
    echo %RED%  X  npm is required ^(bundled with Node.js^).%RESET%
    pause
    exit /b 1
)
echo %GREEN%  OK%RESET% npm found
echo.
goto :eof

:check_python
echo %CYAN%[Tanuki]%RESET% Checking Python...
where python >nul 2>&1
if errorlevel 1 (
    where python3 >nul 2>&1
    if errorlevel 1 (
        echo %RED%  X  Python 3 is required for local AI backends. Install from https://python.org%RESET%
        pause
        exit /b 1
    )
    set PY_CMD=python3
) else (
    set PY_CMD=python
)
echo %GREEN%  OK%RESET% Python found
echo.
goto :eof

:run_npm_install
echo %CYAN%[Tanuki]%RESET% Installing Node.js dependencies...
npm install
if errorlevel 1 (
    echo %RED%  X  npm install failed.%RESET%
    pause
    exit /b 1
)
echo %GREEN%  OK%RESET% npm install complete
echo.
goto :eof

:: ── vLLM ─────────────────────────────────────────────────────────────────────
:install_vllm
echo.
echo %CYAN%[Tanuki]%RESET% Installing vLLM...
echo %YELLOW%  Warning: vLLM requires an NVIDIA GPU with CUDA.%RESET%
echo.
%PY_CMD% -m pip install --upgrade vllm
if errorlevel 1 (
    echo %RED%  X  vLLM installation failed.%RESET%
    pause
    exit /b 1
)
echo %GREEN%  OK%RESET% vLLM installed
echo.

echo %BOLD%Choose a model for vLLM:%RESET%
echo   %CYAN%1%RESET%) meta-llama/Llama-3.2-3B-Instruct   ^(small, fast -- ~6 GB VRAM^)
echo   %CYAN%2%RESET%) meta-llama/Meta-Llama-3.1-8B-Instruct  ^(balanced -- ~16 GB VRAM^)
echo   %CYAN%3%RESET%) mistralai/Mistral-7B-Instruct-v0.3  ^(versatile -- ~14 GB VRAM^)
echo   %CYAN%4%RESET%) Qwen/Qwen2.5-7B-Instruct            ^(multilingual -- ~14 GB VRAM^)
echo   %CYAN%5%RESET%) microsoft/Phi-3-mini-4k-instruct    ^(very small -- ~8 GB VRAM^)
echo   %CYAN%6%RESET%) Custom model ^(enter HuggingFace ID^)
echo.
set /p VLLM_MODEL_IDX="Enter number [1]: "
if "%VLLM_MODEL_IDX%"=="" set VLLM_MODEL_IDX=1

if "%VLLM_MODEL_IDX%"=="1" set BACKEND_MODEL=meta-llama/Llama-3.2-3B-Instruct
if "%VLLM_MODEL_IDX%"=="2" set BACKEND_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
if "%VLLM_MODEL_IDX%"=="3" set BACKEND_MODEL=mistralai/Mistral-7B-Instruct-v0.3
if "%VLLM_MODEL_IDX%"=="4" set BACKEND_MODEL=Qwen/Qwen2.5-7B-Instruct
if "%VLLM_MODEL_IDX%"=="5" set BACKEND_MODEL=microsoft/Phi-3-mini-4k-instruct
if "%VLLM_MODEL_IDX%"=="6" (
    set /p BACKEND_MODEL="Enter HuggingFace model ID: "
)

set /p VLLM_PORT="vLLM server port [8000]: "
if "%VLLM_PORT%"=="" set VLLM_PORT=8000

echo %YELLOW%  Note: Some models require a HuggingFace token.%RESET%
set /p HF_TOKEN="HuggingFace token (leave blank to skip): "

set BACKEND_URL=http://localhost:!VLLM_PORT!/v1
set BACKEND_API_KEY=EMPTY

:: Generate start-vllm.bat
(
    echo @echo off
    echo :: Auto-generated by Tanuki installer -- start the vLLM server
    echo set MODEL=!BACKEND_MODEL!
    echo set PORT=!VLLM_PORT!
    if not "!HF_TOKEN!"=="" echo set HUGGING_FACE_HUB_TOKEN=!HF_TOKEN!
    echo echo Starting vLLM server for %%MODEL%% on port %%PORT%%...
    echo %PY_CMD% -m vllm.entrypoints.openai.api_server --model "%%MODEL%%" --port %%PORT%% --trust-remote-code
) > start-vllm.bat
echo %GREEN%  OK%RESET% Generated start-vllm.bat
echo.
goto :eof

:: ── llama.cpp ─────────────────────────────────────────────────────────────────
:install_llamacpp
echo.
echo %CYAN%[Tanuki]%RESET% Installing llama.cpp Python server...
echo.
echo %BOLD%Installation method:%RESET%
echo   %CYAN%1%RESET%) pip install llama-cpp-python[server]  ^(recommended^)
echo   %CYAN%2%RESET%) I already have llama-cpp-python installed
echo.
set /p LLAMA_INST="Enter number [1]: "
if "%LLAMA_INST%"=="" set LLAMA_INST=1

if "%LLAMA_INST%"=="1" (
    echo %YELLOW%  For GPU acceleration, set CMAKE_ARGS before installing:%RESET%
    echo %YELLOW%    NVIDIA:  set CMAKE_ARGS=-DGGML_CUDA=on%RESET%
    echo %YELLOW%    AMD:     set CMAKE_ARGS=-DGGML_HIPBLAS=on%RESET%
    echo.
    %PY_CMD% -m pip install "llama-cpp-python[server]"
    if errorlevel 1 (
        echo %RED%  X  llama-cpp-python installation failed.%RESET%
        pause
        exit /b 1
    )
    echo %GREEN%  OK%RESET% llama-cpp-python installed
)
echo.

echo %BOLD%Choose a model:%RESET%
echo   %CYAN%1%RESET%) Llama-3.2-3B-Instruct Q4_K_M  ^(~2 GB download^)
echo   %CYAN%2%RESET%) Mistral-7B-Instruct-v0.2 Q4_K_M ^(~4 GB download^)
echo   %CYAN%3%RESET%) Phi-3-mini-4k-instruct Q4_K_M  ^(~2.2 GB download^)
echo   %CYAN%4%RESET%) Custom GGUF ^(enter URL or local path^)
echo.
set /p LLAMA_MODEL_IDX="Enter number [1]: "
if "%LLAMA_MODEL_IDX%"=="" set LLAMA_MODEL_IDX=1

if "%LLAMA_MODEL_IDX%"=="1" (
    set GGUF_URL=https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf
    set GGUF_FILE=Llama-3.2-3B-Instruct-Q4_K_M.gguf
    set BACKEND_MODEL=llama-3.2-3b
)
if "%LLAMA_MODEL_IDX%"=="2" (
    set GGUF_URL=https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf
    set GGUF_FILE=mistral-7b-instruct-v0.2.Q4_K_M.gguf
    set BACKEND_MODEL=mistral-7b
)
if "%LLAMA_MODEL_IDX%"=="3" (
    set GGUF_URL=https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf
    set GGUF_FILE=Phi-3-mini-4k-instruct-q4.gguf
    set BACKEND_MODEL=phi-3-mini
)
if "%LLAMA_MODEL_IDX%"=="4" (
    set /p GGUF_URL="Enter GGUF download URL or full local path: "
    set GGUF_FILE=custom.gguf
    set BACKEND_MODEL=custom
)

:: Download model if URL
if not exist models mkdir models
echo !GGUF_URL! | findstr /C:"http" >nul 2>&1
if not errorlevel 1 (
    if not exist "models\!GGUF_FILE!" (
        echo %CYAN%[Tanuki]%RESET% Downloading !GGUF_FILE!...
        where curl >nul 2>&1
        if not errorlevel 1 (
            curl -L --progress-bar -o "models\!GGUF_FILE!" "!GGUF_URL!"
        ) else (
            echo %YELLOW%  curl not found -- please manually download:%RESET%
            echo %YELLOW%    !GGUF_URL!%RESET%
            echo %YELLOW%    -^> models\!GGUF_FILE!%RESET%
        )
    ) else (
        echo %GREEN%  OK%RESET% Model already downloaded: models\!GGUF_FILE!
    )
    set GGUF_FILE=models\!GGUF_FILE!
)

set /p LLAMA_PORT="llama.cpp server port [8080]: "
if "%LLAMA_PORT%"=="" set LLAMA_PORT=8080

set /p LLAMA_CTX="Context window size [4096]: "
if "%LLAMA_CTX%"=="" set LLAMA_CTX=4096

set BACKEND_URL=http://localhost:!LLAMA_PORT!/v1
set BACKEND_API_KEY=EMPTY

:: Generate start-llamacpp.bat
(
    echo @echo off
    echo :: Auto-generated by Tanuki installer -- start the llama.cpp server
    echo set MODEL_PATH=!GGUF_FILE!
    echo set PORT=!LLAMA_PORT!
    echo set CTX=!LLAMA_CTX!
    echo echo Starting llama.cpp server on port %%PORT%%...
    echo %PY_CMD% -m llama_cpp.server --model "%%MODEL_PATH%%" --port %%PORT%% --n_ctx %%CTX%%
) > start-llamacpp.bat
echo %GREEN%  OK%RESET% Generated start-llamacpp.bat
echo.
goto :eof

:: ── External API ──────────────────────────────────────────────────────────────
:configure_external_api
echo.
echo %BOLD%Choose API provider:%RESET%
echo   %CYAN%1%RESET%) OpenAI          ^(https://api.openai.com/v1^)
echo   %CYAN%2%RESET%) Ollama          ^(http://localhost:11434/v1^)
echo   %CYAN%3%RESET%) LM Studio       ^(http://localhost:1234/v1^)
echo   %CYAN%4%RESET%) Together AI     ^(https://api.together.xyz/v1^)
echo   %CYAN%5%RESET%) Groq            ^(https://api.groq.com/openai/v1^)
echo   %CYAN%6%RESET%) Custom URL
echo.
set /p API_PROVIDER="Enter number [1]: "
if "%API_PROVIDER%"=="" set API_PROVIDER=1

if "%API_PROVIDER%"=="1" set BACKEND_URL=
if "%API_PROVIDER%"=="2" set BACKEND_URL=http://localhost:11434/v1
if "%API_PROVIDER%"=="3" set BACKEND_URL=http://localhost:1234/v1
if "%API_PROVIDER%"=="4" set BACKEND_URL=https://api.together.xyz/v1
if "%API_PROVIDER%"=="5" set BACKEND_URL=https://api.groq.com/openai/v1
if "%API_PROVIDER%"=="6" (
    set /p BACKEND_URL="Enter base URL: "
)

set /p BACKEND_API_KEY="API Key (leave blank if not needed): "

echo.
echo %BOLD%Choose a model:%RESET%
echo   %CYAN%1%RESET%) gpt-4o-mini
echo   %CYAN%2%RESET%) gpt-4o
echo   %CYAN%3%RESET%) gpt-4-turbo
echo   %CYAN%4%RESET%) llama3
echo   %CYAN%5%RESET%) mistral
echo   %CYAN%6%RESET%) Custom model name
echo.
set /p MODEL_IDX="Enter number [1]: "
if "%MODEL_IDX%"=="" set MODEL_IDX=1

if "%MODEL_IDX%"=="1" set BACKEND_MODEL=gpt-4o-mini
if "%MODEL_IDX%"=="2" set BACKEND_MODEL=gpt-4o
if "%MODEL_IDX%"=="3" set BACKEND_MODEL=gpt-4-turbo
if "%MODEL_IDX%"=="4" set BACKEND_MODEL=llama3
if "%MODEL_IDX%"=="5" set BACKEND_MODEL=mistral
if "%MODEL_IDX%"=="6" (
    set /p BACKEND_MODEL="Enter model name: "
)
echo.
goto :eof

:: ── Credentials ───────────────────────────────────────────────────────────────
:configure_credentials
echo %CYAN%[Tanuki]%RESET% Configuring application credentials...
echo.
set /p ADMIN_USER="Admin username [admin]: "
if "%ADMIN_USER%"=="" set ADMIN_USER=admin
echo %YELLOW%  Note: password characters will be hidden.%RESET%
for /f "delims=" %%p in ('powershell -Command "$p = Read-Host -AsSecureString 'Admin password'; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"') do set ADMIN_PASS=%%p
echo.
set /p STUDENT_USER="Student username [student]: "
if "%STUDENT_USER%"=="" set STUDENT_USER=student
for /f "delims=" %%p in ('powershell -Command "$p = Read-Host -AsSecureString 'Student password'; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"') do set STUDENT_PASS=%%p
echo.
goto :eof

:: ── Write .env.local ──────────────────────────────────────────────────────────
:write_env
echo %CYAN%[Tanuki]%RESET% Writing .env.local...

:: Generate a random hex secret using PowerShell
for /f %%i in ('powershell -Command "[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"') do set SESSION_SECRET=%%i

(
    echo # Generated by Tanuki installer
    echo SESSION_SECRET=!SESSION_SECRET!
    echo.
    echo # Credentials
    echo ADMIN_USERNAME=!ADMIN_USER!
    echo ADMIN_PASSWORD=!ADMIN_PASS!
    echo STUDENT_USERNAME=!STUDENT_USER!
    echo STUDENT_PASSWORD=!STUDENT_PASS!
) > .env.local

if not "!BACKEND_API_KEY!"=="" if not "!BACKEND_API_KEY!"=="EMPTY" (
    echo. >> .env.local
    echo # AI API >> .env.local
    echo OPENAI_API_KEY=!BACKEND_API_KEY! >> .env.local
)
if not "!BACKEND_URL!"=="" (
    echo OPENAI_BASE_URL=!BACKEND_URL! >> .env.local
)

echo %GREEN%  OK%RESET% .env.local written
echo.
goto :eof

:: ── Summary ───────────────────────────────────────────────────────────────────
:print_summary
echo.
echo %CYAN%──────────────────────────────────────────────────────%RESET%
echo.
echo %GREEN%%BOLD%  Installation complete!%RESET%
echo.
echo %BOLD%  Next steps:%RESET%
echo.

if exist start-vllm.bat (
    echo   1. Start the vLLM server ^(keep running, open a new terminal^):
    echo        start-vllm.bat
    echo.
    echo   2. In the Admin UI set:
    echo        API Base URL  -^>  !BACKEND_URL!
    echo        Model         -^>  !BACKEND_MODEL!
    echo.
    echo   3. Start Tanuki Stories:
    echo        npm run dev         ^(development^)
    echo        npm run build ^& npm start   ^(production^)
) else if exist start-llamacpp.bat (
    echo   1. Start the llama.cpp server ^(keep running, open a new terminal^):
    echo        start-llamacpp.bat
    echo.
    echo   2. In the Admin UI set:
    echo        API Base URL  -^>  !BACKEND_URL!
    echo        Model         -^>  !BACKEND_MODEL!
    echo.
    echo   3. Start Tanuki Stories:
    echo        npm run dev
) else (
    echo   1. Start Tanuki Stories:
    echo        npm run dev         ^(development^)
    echo        npm run build ^& npm start   ^(production^)
    if not "!BACKEND_MODEL!"=="" (
        echo.
        echo   2. In the Admin UI confirm:
        echo        Model         -^>  !BACKEND_MODEL!
        if not "!BACKEND_URL!"=="" (
            echo        API Base URL  -^>  !BACKEND_URL!
        )
    )
)

echo.
echo   Open:     http://localhost:3000
echo   Admin:    !ADMIN_USER! / ^(your password^)
echo   Student:  !STUDENT_USER! / ^(your password^)
echo.
echo %CYAN%──────────────────────────────────────────────────────%RESET%
echo.
pause
goto :eof
