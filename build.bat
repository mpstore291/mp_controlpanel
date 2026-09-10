@echo off
chcp 65001 >nul
title Build
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js er ikke installeret.
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

echo bygger installer...
call npm run build
if errorlevel 1 (
    echo Build fejlede.
    echo.
    pause
    exit /b
)

echo.
echo Faerdig. Installeren ligger i dist\
echo.
pause
