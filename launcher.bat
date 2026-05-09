@echo off
:: -----------------------------------------------------------------------------
:: Tanuki Stories - Launcher (Windows)
:: Installs (if needed), configures, and launches the AI backend + npm server.
:: Also registers itself as a Windows startup application.
:: Fully standalone -- no other .bat files required.
:: Usage:  launcher.bat
:: -----------------------------------------------------------------------------
setlocal EnableDelayedExpansion
title Tanuki Stories Launcher

:: Resolve the absolute path of this script so the startup entry is correct
:: even when launched from a shortcut or different working directory.
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_PATH=%~f0"
cd /d "!SCRIPT_DIR!"

:: -- Configurable timeouts (seconds) ------------------------------------------
set BACKEND_WAIT=5
set WEB_SERVER_WAIT=10

:: -- Banner -------------------------------------------------------------------
call :print_banner

:: -- Step 1: Install if not already configured --------------------------------
if not exist ".env.local" (
    echo [Tanuki] No .env.local found -- running setup first...
    echo.
    call :check_prereqs
    if errorlevel 1 (
        echo   X  Prerequisites not met. Please fix any errors and re-run launcher.bat.
        pause
        exit /b 1
    )
    call :run_npm_install
    if errorlevel 1 (
        echo   X  npm install failed. Please fix any errors and re-run launcher.bat.
        pause
        exit /b 1
    )
    call :select_backend
    call :configure_credentials
    call :configure_reading_level
    call :import_students_csv
    call :write_env
    if not exist ".env.local" (
        echo   X  Setup did not produce .env.local -- aborting.
        pause
        exit /b 1
    )
    echo.
    echo   OK  Setup complete. Continuing to launch...
    echo.
)

:: -- Step 2: Register as a startup application --------------------------------
call :register_startup

:: -- Step 3: Launch AI backend (if configured) --------------------------------
call :launch_backend

:: -- Step 4: Launch npm server ------------------------------------------------
call :launch_npm

:: -- Step 5: Open browser -----------------------------------------------------
call :open_browser

echo.
echo --------------------------------------------------------
echo   Tanuki Stories is running!
echo.
echo   App:    http://localhost:3000
echo   Admin:  http://localhost:3000/admin
echo.
echo   Close this window to keep servers running in the background,
echo   or press any key to exit (servers will keep running).
echo --------------------------------------------------------
echo.
pause
goto :eof

:: =============================================================================
:: SUBROUTINES
:: =============================================================================

:print_banner
echo.
echo   ######   ##    ##   ##     ## ##   ## ##  ##
echo      ##   ####   ####  ##   ##  ##  ##  ## ##
echo      ##  ##  ##  ## ## ##  ##   ## ##   ####
echo      ##  ######  ##  ####  ##   ####    ##
echo      ##  ##  ##  ##   ### ##    ## ##   ###
echo      ##  ##  ##  ##    ##  ##   ##  ##  ## ##
echo.
echo   Tanuki Stories -- Launcher (Windows)
echo   --------------------------------------------------------
echo.
goto :eof

:: -----------------------------------------------------------------------------
:check_prereqs
echo [Tanuki] Checking prerequisites...
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo   X  Node.js is required. Install from https://nodejs.org
    exit /b 1
)
echo   OK  node found
where npm >nul 2>&1
if errorlevel 1 (
    echo   X  npm is required ^(bundled with Node.js^).
    exit /b 1
)
echo   OK  npm found
echo.
goto :eof

:: -----------------------------------------------------------------------------
:check_python
echo [Tanuki] Checking Python...
where python >nul 2>&1
if errorlevel 1 (
    where python3 >nul 2>&1
    if errorlevel 1 (
        echo   X  Python 3 is required for local AI backends. Install from https://python.org
        exit /b 1
    )
    set PY_CMD=python3
) else (
    set PY_CMD=python
)
echo   OK  Python found
echo.
goto :eof

:: -----------------------------------------------------------------------------
:run_npm_install
echo [Tanuki] Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo   X  npm install failed.
    exit /b 1
)
echo   OK  npm install complete
echo.
goto :eof

:: -----------------------------------------------------------------------------
:select_backend
echo.
echo --------------------------------------------------------
echo.
echo How should Tanuki Stories connect to an AI model?
echo.
echo   1) Local -- vLLM         ^(NVIDIA GPU required^)
echo   2) Local -- llama.cpp    ^(CPU or GPU, GGUF models^)
echo   3) External API         ^(OpenAI, Ollama, LM Studio, etc.^)
echo   4) Mock / no AI         ^(demo mode, no API needed^)
echo.
set /p BE_CHOICE="Enter number [1]: "
if "%BE_CHOICE%"=="" set BE_CHOICE=1

if "%BE_CHOICE%"=="1" (
    call :check_python
    if errorlevel 1 ( pause & exit /b 1 )
    call :install_vllm
) else if "%BE_CHOICE%"=="2" (
    call :check_python
    if errorlevel 1 ( pause & exit /b 1 )
    call :install_llamacpp
) else if "%BE_CHOICE%"=="3" (
    call :configure_external_api
) else if "%BE_CHOICE%"=="4" (
    echo.
    echo [Tanuki] Mock mode selected -- no AI backend will be configured.
    echo.
    set BACKEND_URL=
    set BACKEND_MODEL=
    set BACKEND_API_KEY=
) else (
    echo   Warning: Unknown choice, defaulting to mock mode.
    set BACKEND_URL=
    set BACKEND_MODEL=
    set BACKEND_API_KEY=
)
goto :eof

:: -----------------------------------------------------------------------------
:install_vllm
echo.
echo [Tanuki] Installing vLLM...
echo   Warning: vLLM requires an NVIDIA GPU with CUDA.
echo.
%PY_CMD% -m pip install --upgrade vllm
if errorlevel 1 (
    echo   X  vLLM installation failed.
    pause
    exit /b 1
)
echo   OK  vLLM installed
echo.

echo Choose a model for vLLM:
echo   1) meta-llama/Llama-3.2-3B-Instruct   ^(small, fast -- ~6 GB VRAM^)
echo   2) meta-llama/Meta-Llama-3.1-8B-Instruct  ^(balanced -- ~16 GB VRAM^)
echo   3) mistralai/Mistral-7B-Instruct-v0.3  ^(versatile -- ~14 GB VRAM^)
echo   4) Qwen/Qwen2.5-7B-Instruct            ^(multilingual -- ~14 GB VRAM^)
echo   5) microsoft/Phi-3-mini-4k-instruct    ^(very small -- ~8 GB VRAM^)
echo   6) Custom model ^(enter HuggingFace ID^)
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

echo   Note: Some models require a HuggingFace token.
set /p HF_TOKEN="HuggingFace token (leave blank to skip): "

set BACKEND_URL=http://localhost:!VLLM_PORT!/v1
set BACKEND_API_KEY=EMPTY

:: Generate start-vllm.bat
(
    echo @echo off
    echo :: Auto-generated by Tanuki launcher -- start the vLLM server
    echo set MODEL=!BACKEND_MODEL!
    echo set PORT=!VLLM_PORT!
    if not "!HF_TOKEN!"=="" echo set HUGGING_FACE_HUB_TOKEN=!HF_TOKEN!
    echo echo Starting vLLM server for %%MODEL%% on port %%PORT%%...
    echo !PY_CMD! -m vllm.entrypoints.openai.api_server --model "%%MODEL%%" --port %%PORT%% --trust-remote-code
) > start-vllm.bat
echo   OK  Generated start-vllm.bat
echo.
goto :eof

:: -----------------------------------------------------------------------------
:install_llamacpp
echo.
echo [Tanuki] Installing llama.cpp Python server...
echo.
echo Installation method:
echo   1) pip install llama-cpp-python[server]  ^(recommended^)
echo   2) I already have llama-cpp-python installed
echo.
set /p LLAMA_INST="Enter number [1]: "
if "%LLAMA_INST%"=="" set LLAMA_INST=1

if "%LLAMA_INST%"=="1" (
    echo.
    echo Hardware target:
    echo   1) CPU only       ^(pre-built wheel, no compiler needed^)
    echo   2) NVIDIA GPU     ^(requires MSVC Build Tools + CUDA Toolkit^)
    echo   3) AMD GPU        ^(requires MSVC Build Tools + ROCm^)
    echo.
    set /p LLAMA_HW="Enter number [1]: "
    if "!LLAMA_HW!"=="" set LLAMA_HW=1

    if "!LLAMA_HW!"=="1" (
        echo   Installing CPU-only pre-built wheel...
        %PY_CMD% -m pip install --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu "llama-cpp-python[server]"
    )
    if "!LLAMA_HW!"=="2" (
        echo   Note: MSVC Build Tools and CUDA Toolkit must be installed before proceeding.
        echo   Set CMAKE_ARGS and install:
        set CMAKE_ARGS=-DGGML_CUDA=on
        %PY_CMD% -m pip install --prefer-binary "llama-cpp-python[server]"
    )
    if "!LLAMA_HW!"=="3" (
        echo   Note: MSVC Build Tools and ROCm must be installed before proceeding.
        echo   Set CMAKE_ARGS and install:
        set CMAKE_ARGS=-DGGML_HIPBLAS=on
        %PY_CMD% -m pip install --prefer-binary "llama-cpp-python[server]"
    )
    if errorlevel 1 (
        echo   X  llama-cpp-python installation failed.
        pause
        exit /b 1
    )
    echo   OK  llama-cpp-python installed
)
echo.

echo Choose a model:
echo   1) Llama-3.2-3B-Instruct Q4_K_M  ^(~2 GB download^)
echo   2) Mistral-7B-Instruct-v0.2 Q4_K_M ^(~4 GB download^)
echo   3) Phi-3-mini-4k-instruct Q4_K_M  ^(~2.2 GB download^)
echo   4) Custom GGUF ^(enter HuggingFace repo, URL, or local path^)
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
    set /p GGUF_URL="Enter GGUF download URL, HuggingFace repo (owner/model), or local path: "
    set GGUF_FILE=custom.gguf
    set BACKEND_MODEL=custom
    :: Detect a HuggingFace repo ID: not a URL, not ending in .gguf, contains /
    :: and not a Windows absolute path (drive letter followed by : or \)
    echo !GGUF_URL! | findstr /I /C:"http" >nul 2>&1
    if errorlevel 1 (
        echo !GGUF_URL! | findstr /R "\.gguf$" >nul 2>&1
        if errorlevel 1 (
            echo !GGUF_URL! | findstr /R "^[A-Za-z]:[/\\]" >nul 2>&1
            if errorlevel 1 (
                echo !GGUF_URL! | findstr /C:"/" >nul 2>&1
                if not errorlevel 1 (
                    set HF_REPO=!GGUF_URL!
                    set /p HF_FILE="Enter the GGUF filename within !HF_REPO! (e.g. model-Q4_K_M.gguf): "
                    set GGUF_URL=https://huggingface.co/!HF_REPO!/resolve/main/!HF_FILE!
                    set GGUF_FILE=!HF_FILE!
                )
            )
        )
    )
)

:: Download model if URL
if not exist models mkdir models
echo !GGUF_URL! | findstr /C:"http" >nul 2>&1
if not errorlevel 1 (
    if not exist "models\!GGUF_FILE!" (
        echo [Tanuki] Downloading !GGUF_FILE!...
        where curl >nul 2>&1
        if not errorlevel 1 (
            curl -L --progress-bar -o "models\!GGUF_FILE!" "!GGUF_URL!"
        ) else (
            echo   curl not found -- please manually download:
            echo     !GGUF_URL!
            echo     -^> models\!GGUF_FILE!
        )
    ) else (
        echo   OK  Model already downloaded: models\!GGUF_FILE!
    )
    set GGUF_FILE=models\!GGUF_FILE!
) else (
    :: Local path -- use as-is
    set GGUF_FILE=!GGUF_URL!
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
    echo :: Auto-generated by Tanuki launcher -- start the llama.cpp server
    echo set MODEL_PATH=!GGUF_FILE!
    echo set PORT=!LLAMA_PORT!
    echo set CTX=!LLAMA_CTX!
    echo echo Starting llama.cpp server on port %%PORT%%...
    echo !PY_CMD! -m llama_cpp.server --model "%%MODEL_PATH%%" --port %%PORT%% --n_ctx %%CTX%%
) > start-llamacpp.bat
echo   OK  Generated start-llamacpp.bat
echo.
goto :eof

:: -----------------------------------------------------------------------------
:configure_external_api
echo.
echo Choose API provider:
echo   1) OpenAI          ^(https://api.openai.com/v1^)
echo   2) Ollama          ^(http://localhost:11434/v1^)
echo   3) LM Studio       ^(http://localhost:1234/v1^)
echo   4) Together AI     ^(https://api.together.xyz/v1^)
echo   5) Groq            ^(https://api.groq.com/openai/v1^)
echo   6) Custom URL
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
echo Choose a model:
echo   1) gpt-4o-mini
echo   2) gpt-4o
echo   3) gpt-4-turbo
echo   4) llama3
echo   5) mistral
echo   6) Custom model name
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

:: -----------------------------------------------------------------------------
:configure_credentials
echo.
echo --------------------------------------------------------
echo [Tanuki] Configuring application credentials...
echo.
set /p ADMIN_USER="Admin username [admin]: "
if "%ADMIN_USER%"=="" set ADMIN_USER=admin
echo   Note: password characters will be hidden.
for /f "delims=" %%p in ('powershell -Command "$p = Read-Host -AsSecureString 'Admin password'; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"') do set ADMIN_PASS=%%p
echo.
goto :eof

:: -----------------------------------------------------------------------------
:configure_reading_level
echo.
echo --------------------------------------------------------
echo [Tanuki] Configuring default reading level...
echo.
echo Choose a default reading complexity for stories:
echo   1) Simple       ^(early elementary^)
echo   2) Intermediate ^(upper elementary / middle school^)
echo   3) Advanced     ^(high school / adult^)
echo.
set /p RL_CHOICE="Enter number [2]: "
if "%RL_CHOICE%"=="" set RL_CHOICE=2
if "%RL_CHOICE%"=="1" set DEFAULT_READING_LEVEL=simple
if "%RL_CHOICE%"=="2" set DEFAULT_READING_LEVEL=intermediate
if "%RL_CHOICE%"=="3" set DEFAULT_READING_LEVEL=advanced
if "!DEFAULT_READING_LEVEL!"=="" set DEFAULT_READING_LEVEL=intermediate
echo   OK  Default reading level: !DEFAULT_READING_LEVEL!
echo.
goto :eof

:: -----------------------------------------------------------------------------
:import_students_csv
echo.
echo --------------------------------------------------------
echo [Tanuki] Student account setup...
echo.
echo How would you like to set up student accounts?
echo   1) Import from a CSV file  ^(username,password per line^)
echo   2) Skip -- I will manage students in the Admin UI
echo.
set /p CSV_CHOICE="Enter number [2]: "
if "%CSV_CHOICE%"=="" set CSV_CHOICE=2
if not "%CSV_CHOICE%"=="1" (
    echo   OK  Skipping CSV import -- use the Admin UI to add students later.
    echo.
    goto :eof
)
set /p CSV_PATH="Path to CSV file (e.g. students.csv): "
if not exist "!CSV_PATH!" (
    echo   Warning: File not found: !CSV_PATH! -- skipping CSV import.
    echo.
    goto :eof
)
if not exist data mkdir data
node -e "const fs=require('fs');const lines=fs.readFileSync(process.argv[2],'utf8').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);const data=lines[0].toLowerCase().includes('username')?lines.slice(1):lines;let ex=[];try{ex=JSON.parse(fs.readFileSync('data/users.json','utf8'));}catch{}let c=0;for(const l of data){const p=l.split(',');if(p.length<2)continue;const u=p[0].trim(),pw=p[1].trim();if(!u||!pw)continue;const i=ex.findIndex(e=>e.username===u);const entry={username:u,password:pw,role:'student'};if(i!==-1){ex[i]=entry;}else{ex.push(entry);}c++;}fs.writeFileSync('data/users.json',JSON.stringify(ex,null,2));console.log('Imported '+c+' student(s)');" "!CSV_PATH!"
echo.
goto :eof

:: -----------------------------------------------------------------------------
:write_env
echo [Tanuki] Writing .env.local...

:: Generate a random hex secret using PowerShell
for /f %%i in ('powershell -Command "[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"') do set SESSION_SECRET=%%i

(
    echo # Generated by Tanuki launcher
    echo SESSION_SECRET=!SESSION_SECRET!
    echo.
    echo # Admin credentials
    echo ADMIN_USERNAME=!ADMIN_USER!
    echo ADMIN_PASSWORD=!ADMIN_PASS!
    echo.
    echo # Default reading level ^(simple ^| intermediate ^| advanced^)
    echo DEFAULT_READING_LEVEL=!DEFAULT_READING_LEVEL!
) > .env.local

if not "!BACKEND_API_KEY!"=="" if not "!BACKEND_API_KEY!"=="EMPTY" (
    echo. >> .env.local
    echo # AI API >> .env.local
    echo OPENAI_API_KEY=!BACKEND_API_KEY! >> .env.local
)
if not "!BACKEND_URL!"=="" (
    echo OPENAI_BASE_URL=!BACKEND_URL! >> .env.local
)

echo   OK  .env.local written
echo.
goto :eof

:: -----------------------------------------------------------------------------
:register_startup
echo [Tanuki] Registering as a startup application...
:: Check if an identical entry already exists before writing
for /f "tokens=2*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "TanukiStories" 2^>nul ^| findstr /i "TanukiStories"') do set "EXISTING_ENTRY=%%b"
if "!EXISTING_ENTRY!"=="\"!SCRIPT_PATH!\"" (
    echo   OK  Startup entry already up to date
) else (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
        /v "TanukiStories" ^
        /t REG_SZ ^
        /d "\"!SCRIPT_PATH!\"" ^
        /f >nul 2>&1
    if errorlevel 1 (
        echo   Warning: Could not register startup entry ^(non-fatal^).
    ) else (
        echo   OK  Registered in HKCU Run key
    )
)
echo.
goto :eof

:: -----------------------------------------------------------------------------
:launch_backend
:: Check which AI backend scripts exist (generated during setup)
if exist "start-vllm.bat" (
    echo [Tanuki] Starting vLLM inference server in a new window...
    start "Tanuki - vLLM Server" cmd /k "cd /d \"!SCRIPT_DIR!\" && call start-vllm.bat"
    echo   OK  vLLM server window launched
    echo   Waiting !BACKEND_WAIT! seconds for the server to initialize...
    timeout /t !BACKEND_WAIT! /nobreak >nul
) else if exist "start-llamacpp.bat" (
    echo [Tanuki] Starting llama.cpp inference server in a new window...
    start "Tanuki - llama.cpp Server" cmd /k "cd /d \"!SCRIPT_DIR!\" && call start-llamacpp.bat"
    echo   OK  llama.cpp server window launched
    echo   Waiting !BACKEND_WAIT! seconds for the server to initialize...
    timeout /t !BACKEND_WAIT! /nobreak >nul
) else (
    echo [Tanuki] No local AI backend script found -- skipping ^(external API or mock mode^).
)
echo.
goto :eof

:: -----------------------------------------------------------------------------
:launch_npm
:: Use the production server if a Next.js build exists, otherwise dev server.
echo [Tanuki] Starting npm server in a new window...
if exist ".next\BUILD_ID" (
    echo   Using production build ^(npm start^)...
    start "Tanuki - Web Server" cmd /k "cd /d \"!SCRIPT_DIR!\" && npm start"
) else (
    echo   No production build found -- using development server ^(npm run dev^)...
    echo   Tip: run "npm run build" once for faster production startup.
    start "Tanuki - Web Server" cmd /k "cd /d \"!SCRIPT_DIR!\" && npm run dev"
)
echo   OK  Web server window launched
echo.
goto :eof

:: -----------------------------------------------------------------------------
:open_browser
:: Give the dev/prod server a moment to bind before opening the browser.
echo [Tanuki] Waiting for web server to start ^(!WEB_SERVER_WAIT! seconds^)...
timeout /t !WEB_SERVER_WAIT! /nobreak >nul
echo [Tanuki] Opening http://localhost:3000 in the default browser...
start "" "http://localhost:3000"
echo   OK  Browser opened
echo.
goto :eof
