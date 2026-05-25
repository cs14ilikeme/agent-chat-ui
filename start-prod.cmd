@echo off
REM GA-Go UI 生产启动脚本（standalone 模式 + JWT 认证）
setlocal

set UI_DIR=%~dp0
set STANDALONE=%UI_DIR%.next\standalone

REM 1. 复制 static 资源（standalone 模式必需）
if exist "%STANDALONE%\.next\static" rmdir /S /Q "%STANDALONE%\.next\static"
xcopy /E /I /Y /Q "%UI_DIR%.next\static" "%STANDALONE%\.next\static" >nul

REM 2. 复制 public 资源（如果存在）
if exist "%UI_DIR%public" (
    if exist "%STANDALONE%\public" rmdir /S /Q "%STANDALONE%\public"
    xcopy /E /I /Y /Q "%UI_DIR%public" "%STANDALONE%\public" >nul
)

REM 3. 加载 .env.local 到环境变量
for /f "usebackq tokens=1,* delims==" %%a in ("%UI_DIR%.env.local") do (
    set "line=%%a"
    if not "!line:~0,1!"=="#" if not "%%a"=="" set "%%a=%%b"
)
setlocal EnableDelayedExpansion
for /f "usebackq tokens=*" %%l in ("%UI_DIR%.env.local") do (
    set "ln=%%l"
    if not "!ln!"=="" if not "!ln:~0,1!"=="#" (
        for /f "tokens=1,* delims==" %%a in ("!ln!") do set "%%a=%%b"
    )
)

REM 4. 启动配置
set NODE_ENV=production
set PORT=3000
set HOSTNAME=127.0.0.1

echo ============================================
echo  GA-Go UI starting (standalone + JWT auth)
echo  http://127.0.0.1:3000
echo  Login: admin / gago2026
echo ============================================

cd /d "%STANDALONE%"
node server.js

endlocal
