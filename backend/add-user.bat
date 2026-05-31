@echo off
chcp 65001 >nul
echo 🏥 Охорона праці — Додавання користувача
echo.
cd /d "%~dp0"
node add-user.js
pause
