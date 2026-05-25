@echo off
cd /d "C:\GA2\GenericAgent-Portable\GA\GA-Go\ui"
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
call node_modules\.bin\next.cmd build
call node_modules\.bin\next.cmd start -H 0.0.0.0 -p 3000
