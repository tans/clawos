@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "SCRIPT_URL=https://clawos.minapp.xin/public/install-or-update-clawos.ps1"
set "LOCAL_SCRIPT=%~dp0install-or-update-clawos.ps1"
set "TEMP_ROOT=%TEMP%\clawos-installer"
set "TEMP_SCRIPT=%TEMP_ROOT%\install-or-update-clawos.ps1"
set "SCRIPT_TO_RUN=%LOCAL_SCRIPT%"

if not exist "%LOCAL_SCRIPT%" (
  echo [bootstrap] Downloading installer script...
  if not exist "%TEMP_ROOT%" mkdir "%TEMP_ROOT%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "$ProgressPreference='SilentlyContinue';" ^
    "Invoke-WebRequest -UseBasicParsing -Uri '%SCRIPT_URL%' -OutFile '%TEMP_SCRIPT%'"
  if errorlevel 1 goto :fail
  set "SCRIPT_TO_RUN=%TEMP_SCRIPT%"
)

echo [bootstrap] Running: %SCRIPT_TO_RUN%
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_TO_RUN%" %*
set "ERR=%ERRORLEVEL%"

if exist "%TEMP_SCRIPT%" del /F /Q "%TEMP_SCRIPT%" >nul 2>&1
exit /b %ERR%

:fail
set "ERR=%ERRORLEVEL%"
if "%ERR%"=="0" set "ERR=1"
echo Failed: bootstrap script download failed. (error %ERR%)
echo You can manually open: %SCRIPT_URL%
exit /b %ERR%
