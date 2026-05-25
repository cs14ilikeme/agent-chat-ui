@echo off
REM GA-Go UI Production Startup Script
REM Usage: start.bat [port]
REM Default port: 3000

setlocal
set PORT=%1
if "%PORT%"=="" set PORT=3000

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Check if .next exists (built)
if not exist ".next" (
    echo [GA-Go UI] No build found. Building...
    call node_modules\.bin\next.cmd build
    if errorlevel 1 (
        echo [GA-Go UI] Build failed!
        exit /b 1
    )
)

echo [GA-Go UI] Starting on port %PORT%...
echo [GA-Go UI] URL: http://127.0.0.1:%PORT%
echo [GA-Go UI] Press Ctrl+C to stop.

set NODE_ENV=production
call node_modules\.bin\next.cmd start -p %PORT%
