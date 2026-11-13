@echo off
echo ===================================================
echo Installing Sia AI 24/7 Auto-Start on Windows Boot
echo ===================================================

set SCRIPT_DIR=%~dp0
set VBS_TARGET=%SCRIPT_DIR%start-sia-247-silent.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_DIR%\Sia247.lnk

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_TARGET%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

if exist "%SHORTCUT%" (
    echo [OK] Sia AI 24/7 successfully registered in Windows Startup folder!
    echo Location: %SHORTCUT%
    echo Sia AI will now automatically run 24/7 whenever your PC turns on.
) else (
    echo [ERROR] Could not create startup shortcut.
)
pause
