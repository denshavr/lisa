@echo off
chcp 65001 > nul
title Лисичка ❤️

cd /d "%~dp0"

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

echo  Запускаю сервер...
echo.

:: Открываем браузер через 2 секунды в отдельном процессе
start "" /b cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:3000"

:: Запускаем сервер (блокирует окно пока работает)
npm run dev

pause
