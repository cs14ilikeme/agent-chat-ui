@echo off
cd /d "C:\GA2\GenericAgent-Portable\GA\GA-Go\ui"
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul
set HOSTNAME=0.0.0.0
set PORT=3000
"node_modules\.bin\next.cmd" start -H 0.0.0.0 -p 3000
