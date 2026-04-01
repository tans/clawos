@echo off
setlocal EnableExtensions EnableDelayedExpansion

if "%~1"=="-h" goto :usage
if "%~1"=="--help" goto :usage

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT_DEFAULT=%%~fI"
set "BUNDLE_DIR=%~1"
if "%BUNDLE_DIR%"=="" set "BUNDLE_DIR=plugins\bom-quote-openclaw"
set "REPO_ROOT=%~2"
if "%REPO_ROOT%"=="" set "REPO_ROOT=%REPO_ROOT_DEFAULT%"

if not exist "%BUNDLE_DIR%" (
  echo bundle dir not found: %BUNDLE_DIR% 1>&2
  exit /b 1
)

set "MCP_ENTRY=%REPO_ROOT%\mcp\bom-mcp\src\index.ts"
if not exist "%MCP_ENTRY%" (
  echo bom-mcp entry not found: %MCP_ENTRY% 1>&2
  exit /b 1
)

if "%BOM_MCP_STATE_DIR%"=="" set "BOM_MCP_STATE_DIR=%USERPROFILE%\.openclaw\state\bom-mcp"
if "%BOM_MCP_DB_PATH%"=="" set "BOM_MCP_DB_PATH=%BOM_MCP_STATE_DIR%\bom-mcp.sqlite"
if "%BOM_MCP_EXPORT_DIR%"=="" set "BOM_MCP_EXPORT_DIR=%BOM_MCP_STATE_DIR%\exports"
if "%BOM_MCP_CACHE_DIR%"=="" set "BOM_MCP_CACHE_DIR=%BOM_MCP_STATE_DIR%\cache"
if "%BOM_MCP_FX_USD_CNY%"=="" set "BOM_MCP_FX_USD_CNY=7.2"
if "%BOM_MCP_DIGIKEY_CDP_URL%"=="" set "BOM_MCP_DIGIKEY_CDP_URL="

if not exist "%BOM_MCP_STATE_DIR%" mkdir "%BOM_MCP_STATE_DIR%"
if not exist "%BOM_MCP_EXPORT_DIR%" mkdir "%BOM_MCP_EXPORT_DIR%"
if not exist "%BOM_MCP_CACHE_DIR%" mkdir "%BOM_MCP_CACHE_DIR%"

set "OUTPUT_PATH=%BUNDLE_DIR%\.mcp.json"
(
  echo {
  echo   "mcpServers": {
  echo     "bom-mcp": {
  echo       "command": "bun",
  echo       "args": [
  echo         "%MCP_ENTRY:\=\\%",
  echo         "serve",
  echo         "--transport",
  echo         "stdio"
  echo       ],
  echo       "env": {
  echo         "BOM_MCP_STATE_DIR": "%BOM_MCP_STATE_DIR:\=\\%",
  echo         "BOM_MCP_DB_PATH": "%BOM_MCP_DB_PATH:\=\\%",
  echo         "BOM_MCP_EXPORT_DIR": "%BOM_MCP_EXPORT_DIR:\=\\%",
  echo         "BOM_MCP_CACHE_DIR": "%BOM_MCP_CACHE_DIR:\=\\%",
  echo         "BOM_MCP_FX_USD_CNY": "%BOM_MCP_FX_USD_CNY%",
  echo         "BOM_MCP_DIGIKEY_CDP_URL": "%BOM_MCP_DIGIKEY_CDP_URL%"
  echo       }
  echo     }
  echo   }
  echo }
) > "%OUTPUT_PATH%"

echo generated %OUTPUT_PATH%
echo - entry: %MCP_ENTRY%
echo - state: %BOM_MCP_STATE_DIR%
exit /b 0

:usage
echo Usage:
echo   scripts\setup-bom-quote-openclaw.bat [bundle-dir] [repo-root]
echo.
echo Examples:
echo   scripts\setup-bom-quote-openclaw.bat
echo   scripts\setup-bom-quote-openclaw.bat plugins\bom-quote-openclaw C:\clawos
echo.
echo Environment overrides:
echo   BOM_MCP_STATE_DIR
echo   BOM_MCP_DB_PATH
echo   BOM_MCP_EXPORT_DIR
echo   BOM_MCP_CACHE_DIR
echo   BOM_MCP_FX_USD_CNY
echo   BOM_MCP_DIGIKEY_CDP_URL
exit /b 0
