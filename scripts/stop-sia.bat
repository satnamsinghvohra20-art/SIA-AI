@echo off
echo Stopping Sia AI 24/7 background processes...
powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*sia*' -or $_.CommandLine -like '*server*' } | Stop-Process -Force"
powershell -NoProfile -Command "Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force"
echo Sia AI processes stopped.
pause
