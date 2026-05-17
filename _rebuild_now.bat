@echo off
cd /d C:\GA2\GenericAgent-Portable\GA\GA-Go\ui
echo === REBUILD START ===
set PATH=C:\GA2\GenericAgent-Portable\GA\temp\tools\node-v22.21.1-win-x64;%PATH%
call npx next build > rebuild.log 2>&1
echo === REBUILD DONE ===
echo Killing old next start...
taskkill /F /IM node.exe /T > nul 2>&1
timeout /t 2 > nul
echo === START NEW next start ===
start "next-server" /MIN cmd /c "set PATH=C:\GA2\GenericAgent-Portable\GA\temp\tools\node-v22.21.1-win-x64;%PATH% && npx next start -H 0.0.0.0 -p 3000 > next.log 2>&1"
echo Done
