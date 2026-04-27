@echo off
:: -----------------------------------------------------------------------------
:: Tanuki Stories - Update Script (Windows)
:: Updates an existing install: pulls latest code, refreshes dependencies,
:: and optionally rebuilds for production.
:: Usage:  update.bat
:: -----------------------------------------------------------------------------
setlocal EnableDelayedExpansion
title Tanuki Stories Updater

:: -- Banner -------------------------------------------------------------------
call :print_banner

:: -- Warn if no .env.local ----------------------------------------------------
if not exist .env.local (
    echo   Warning: .env.local not found -- have you run install.bat yet?
    echo   Your configuration will not be changed by this script.
    echo.
)

:: -- Prereq checks ------------------------------------------------------------
call :check_prereqs

:: -- git pull -----------------------------------------------------------------
call :pull_latest

:: -- npm install --------------------------------------------------------------
call :run_npm_install

:: -- Optional production build ------------------------------------------------
echo --------------------------------------------------------
echo.
set /p BUILD_CHOICE="Run production build now? (npm run build) [y/N]: "
if /i "!BUILD_CHOICE!"=="y" (
    call :run_build
) else (
    echo   OK  Skipping build -- run "npm run build" manually when ready.
    echo.
)

:: -- Summary ------------------------------------------------------------------
call :print_summary
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
echo   Tanuki Stories -- Update Script (Windows)
echo   --------------------------------------------------------
echo.
goto :eof

:check_prereqs
echo [Tanuki] Checking prerequisites...
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo   X  Node.js is required. Install from https://nodejs.org
    pause
    exit /b 1
)
echo   OK  node found
where npm >nul 2>&1
if errorlevel 1 (
    echo   X  npm is required ^(bundled with Node.js^).
    pause
    exit /b 1
)
echo   OK  npm found
echo.
goto :eof

:pull_latest
where git >nul 2>&1
if errorlevel 1 (
    echo   Warning: git not found -- skipping source update.
    echo.
    goto :eof
)
if not exist .git (
    echo   Warning: Not a git repository -- skipping source update.
    echo.
    goto :eof
)
echo [Tanuki] Pulling latest changes from remote...
for /f %%i in ('git rev-parse HEAD 2^>nul') do set GIT_BEFORE=%%i
git pull
if errorlevel 1 (
    echo   X  git pull failed. Please resolve any conflicts and try again.
    pause
    exit /b 1
)
for /f %%i in ('git rev-parse HEAD 2^>nul') do set GIT_AFTER=%%i
if "!GIT_BEFORE!"=="!GIT_AFTER!" (
    echo   OK  Already up to date
) else (
    echo   OK  Updated source code
)
echo.
goto :eof

:run_npm_install
echo [Tanuki] Updating Node.js dependencies...
call npm install
if errorlevel 1 (
    echo   X  npm install failed.
    pause
    exit /b 1
)
echo   OK  npm install complete
echo.
goto :eof

:run_build
echo [Tanuki] Building for production...
call npm run build
if errorlevel 1 (
    echo   X  Build failed.
    pause
    exit /b 1
)
echo   OK  Build complete
echo.
goto :eof

:print_summary
echo.
echo --------------------------------------------------------
echo.
echo   Update complete!
echo.
echo   Start Tanuki Stories:
echo.
echo     npm run dev                  ^(development^)
echo     npm run build ^& npm start   ^(production^)
echo.
echo   Open:  http://localhost:3000
echo.
echo --------------------------------------------------------
echo.
pause
goto :eof
