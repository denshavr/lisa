@echo off
chcp 65001 > nul
title Лисичка ❤️

cd /d "%~dp0"

if not exist node_modules (
    echo.
    echo  Устанавливаю необходимые зависимости (express, sqlite3, cors)...
    echo.
    call npm install
)

echo.
echo  Останавливаю предыдущий сервер на порту 3000...
echo.

:: Убиваем всех, кто занимает порт 3000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":3000 "') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F > nul 2>&1
    )
)

:: Небольшая пауза чтобы порт освободился
timeout /t 1 /nobreak > nul

echo  Запускаю сервер и открываю окно...
echo.

:: Открываем приложение (Edge есть на всех современных Windows) с разрешением музыки без клика
start "" /b cmd /c "timeout /t 2 /nobreak > nul && start msedge --app=http://localhost:3000 --autoplay-policy=no-user-gesture-required"

:: Запускаем сервер (блокирует окно пока работает)
SET PORT=3000
npm run dev

pause
