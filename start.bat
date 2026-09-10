@echo off
chcp 65001 >nul
title MP BotControle
cd /d "%~dp0files"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js er ikke installeret.
    echo Download det her: https://nodejs.org
    echo.
    pause
    exit /b
)

where npm >nul 2>nul
if errorlevel 1 (
    echo npm mangler. Installer Node.js igen fra https://nodejs.org
    echo.
    pause
    exit /b
)

echo installerer packages...
call npm install
if errorlevel 1 (
    echo npm install fejlede.
    echo.
    pause
    exit /b
)

echo lukker gammel proces på port 3784 hvis den kører...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3784" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo starter bot og panel...
echo panelet koerer paa port 3784
echo paa VPS: http://DIN-IP:3784
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:3784"
node index.js

echo.
echo stoppet.
pause
