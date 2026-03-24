@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "TARGET_VERSION=%~1"
if "%TARGET_VERSION%"=="" (
  set /p TARGET_VERSION=输入版本号(留空自动递增): 
)

set "RELEASE_CMD=bun run scripts/release-clawos.ts --env=canary --release-channel=beta"
if not "%TARGET_VERSION%"=="" (
  set "RELEASE_CMD=%RELEASE_CMD% --version=%TARGET_VERSION%"
)

echo [Beta] 执行: %RELEASE_CMD%
call %RELEASE_CMD%
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [Beta] 发布失败，退出码: %EXIT_CODE%
  exit /b %EXIT_CODE%
)

echo [Beta] 发布完成。
exit /b 0
