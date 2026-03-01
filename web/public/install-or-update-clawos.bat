@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "DOWNLOAD_URL=https://clawos.minapp.xin/downloads/latest"
set "TARGET_DIR=C:\虾壳"
set "FALLBACK_TARGET_DIR=C:\xiake"

if not "%~1"=="" (
  set "TARGET_DIR=%~1"
) else (
  if not exist "%TARGET_DIR%\" (
    if exist "%FALLBACK_TARGET_DIR%\" set "TARGET_DIR=%FALLBACK_TARGET_DIR%"
  )
)

set "TARGET_EXE=%TARGET_DIR%\clawos.exe"
set "TEMP_ROOT=%TEMP%\clawos-installer"
set "DOWNLOAD_EXE=%TEMP_ROOT%\clawos-latest-%RANDOM%%RANDOM%.exe"
set "BACKUP_EXE=%TARGET_EXE%.old"
set "MODE=安装"

if exist "%TARGET_EXE%" set "MODE=更新"

echo [1/5] 准备目录...
if not exist "%TEMP_ROOT%" mkdir "%TEMP_ROOT%"
if errorlevel 1 goto :fail
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if errorlevel 1 goto :fail

echo [2/5] 下载最新版本...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
  "$ProgressPreference='SilentlyContinue';" ^
  "Invoke-WebRequest -UseBasicParsing -Uri '%DOWNLOAD_URL%' -OutFile '%DOWNLOAD_EXE%';" ^
  "$fi = Get-Item '%DOWNLOAD_EXE%'; if ($fi.Length -le 0) { throw '下载文件为空' }"
if errorlevel 1 goto :fail

echo [3/5] 当前模式：%MODE%
if /I "%MODE%"=="更新" (
  echo [3/5] 结束旧进程...
  taskkill /F /IM clawos.exe /T >nul 2>&1
  timeout /t 2 /nobreak >nul
)

echo [4/5] 写入目标文件...
if /I "%MODE%"=="更新" (
  if exist "%BACKUP_EXE%" del /F /Q "%BACKUP_EXE%" >nul 2>&1
  move /Y "%TARGET_EXE%" "%BACKUP_EXE%" >nul
  if errorlevel 1 (
    echo 无法替换旧文件，可能仍被占用。
    goto :fail
  )
)

copy /Y "%DOWNLOAD_EXE%" "%TARGET_EXE%" >nul
if errorlevel 1 (
  echo 写入新版本失败。
  if /I "%MODE%"=="更新" (
    echo 尝试回滚旧版本...
    if exist "%BACKUP_EXE%" move /Y "%BACKUP_EXE%" "%TARGET_EXE%" >nul 2>&1
  )
  goto :fail
)

echo [5/5] 启动 ClawOS...
start "" "%TARGET_EXE%"
if errorlevel 1 goto :fail

del /F /Q "%DOWNLOAD_EXE%" >nul 2>&1
echo 完成：%MODE%成功并已启动 ClawOS。
echo 目标路径：%TARGET_EXE%
exit /b 0

:fail
set "ERR=%ERRORLEVEL%"
if "%ERR%"=="0" set "ERR=1"
echo 失败：安装或更新未完成（错误码 %ERR%）。
echo 你可以手动指定目录，例如：
echo   %~nx0 "C:\xiake"
exit /b %ERR%
