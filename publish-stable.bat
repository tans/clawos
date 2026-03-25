@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "TARGET_VERSION=%~1"
if "%TARGET_VERSION%"=="" (
  set /p TARGET_VERSION=Enter version (leave blank to auto-increment^): 
)

set "RELEASE_CMD=bun run scripts/release-clawos.ts --env=stable --release-channel=stable"
if not "%TARGET_VERSION%"=="" (
  set "RELEASE_CMD=%RELEASE_CMD% --version=%TARGET_VERSION%"
)

echo [Stable] Running: %RELEASE_CMD%
call %RELEASE_CMD%
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [Stable] Publish failed, exit code: %EXIT_CODE%
  exit /b %EXIT_CODE%
)

echo [Stable] Publish completed.
exit /b 0
