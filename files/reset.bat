@echo off
chcp 65001 >nul
title Reset
cd /d "%~dp0"

echo.
echo Dette nulstiller ALT uden backup.
echo Token, server, tickets og kategorier bliver slettet.
echo Det kan ikke fortrydes.
echo.
set /p ok=Skriv JA for at nulstille: 
if /i not "%ok%"=="JA" (
    echo Annulleret.
    echo.
    pause
    exit /b
)

echo lukker botten hvis den kører...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3784" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

node reset.js
if errorlevel 1 (
    echo Reset fejlede.
    echo.
    pause
    exit /b
)

echo.
echo Nulstillet. Start start.bat igen.
echo.
pause
