param(
  [string]$Ref = "main",
  [string]$RepoUrl = "https://github.com/CursorTouch/Windows-MCP.git",
  [string]$OutputDir = ".\\dist",
  [string]$WorkDir = ".\\.cache\\windows-mcp-src",
  [string]$VenvDir = ".\\.venv",
  [string]$ExeName = "windows-mcp"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-Tool([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    return $null
  }

  return $command.Source
}

function Invoke-Step([string]$Label, [scriptblock]$Action) {
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Action
}

function New-Venv {
  param(
    [string]$TargetDir
  )

  $uv = Resolve-Tool "uv"
  if ($uv) {
    & $uv venv $TargetDir --python 3.13
    return
  }

  $py = Resolve-Tool "py"
  if ($py) {
    & $py -3.13 -m venv $TargetDir
    return
  }

  $python = Resolve-Tool "python"
  if ($python) {
    & $python -m venv $TargetDir
    return
  }

  throw "Python 3.13 or uv is required. Install uv, or ensure py/python is available."
}

if ($env:OS -ne "Windows_NT") {
  throw "This script only supports Windows."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $OutputDir))
$workPath = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $WorkDir))
$venvPath = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $VenvDir))
$buildPath = Join-Path $scriptDir "build"
$entryPath = Join-Path $buildPath "entry.py"
$git = Resolve-Tool "git"

if (-not $git) {
  throw "git is required to fetch $RepoUrl"
}

Invoke-Step "Preparing directories" {
  New-Item -ItemType Directory -Force -Path $buildPath | Out-Null
  New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
}

Invoke-Step "Syncing upstream source ($Ref)" {
  if (-not (Test-Path (Join-Path $workPath ".git"))) {
    if (Test-Path $workPath) {
      Remove-Item $workPath -Recurse -Force
    }

    & $git clone $RepoUrl $workPath
  }

  & $git -C $workPath fetch --tags --force origin
  & $git -C $workPath checkout --force $Ref
  & $git -C $workPath reset --hard $Ref
}

Invoke-Step "Creating virtual environment" {
  if (-not (Test-Path $venvPath)) {
    New-Venv -TargetDir $venvPath
  }
}

$venvPython = Join-Path $venvPath "Scripts\\python.exe"
if (-not (Test-Path $venvPython)) {
  throw "Virtual environment python was not found at $venvPython"
}

Invoke-Step "Installing dependencies" {
  & $venvPython -m pip install --upgrade pip setuptools wheel pyinstaller
  & $venvPython -m pip install $workPath
}

Invoke-Step "Writing PyInstaller entrypoint" {
  @'
from windows_mcp.__main__ import main

if __name__ == "__main__":
    main()
'@ | Set-Content -Path $entryPath -Encoding ASCII
}

Invoke-Step "Building $ExeName.exe" {
  & $venvPython -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --name $ExeName `
    --distpath $outputPath `
    --workpath (Join-Path $buildPath "pyinstaller") `
    --specpath $buildPath `
    --collect-all windows_mcp `
    --collect-all fastmcp `
    --copy-metadata windows-mcp `
    $entryPath
}

$exePath = Join-Path $outputPath "$ExeName.exe"
if (-not (Test-Path $exePath)) {
  throw "Build finished without producing $exePath"
}

Write-Host ""
Write-Host "Executable ready:" -ForegroundColor Green
Write-Host $exePath
