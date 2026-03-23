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

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  $hasNativeErrorPreference = $null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
  if ($hasNativeErrorPreference) {
    $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }

  try {
    & $FilePath @Arguments
  } finally {
    if ($hasNativeErrorPreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
    }
  }

  if ($LASTEXITCODE -ne 0) {
    $commandText = if ($Arguments.Count -gt 0) {
      "$FilePath $($Arguments -join ' ')"
    } else {
      $FilePath
    }
    throw "Command failed with exit code ${LASTEXITCODE}: $commandText"
  }
}

function Test-NativeSuccess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  $hasNativeErrorPreference = $null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
  if ($hasNativeErrorPreference) {
    $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }

  try {
    & $FilePath @Arguments *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  } finally {
    if ($hasNativeErrorPreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
    }
  }
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
    Invoke-Native -FilePath $uv -Arguments @("venv", $TargetDir, "--python", "3.13", "--seed")
    return
  }

  $py = Resolve-Tool "py"
  if ($py) {
    Invoke-Native -FilePath $py -Arguments @("-3.13", "-m", "venv", $TargetDir)
    return
  }

  $python = Resolve-Tool "python"
  if ($python) {
    Invoke-Native -FilePath $python -Arguments @("-m", "venv", $TargetDir)
    return
  }

  throw "Python 3.13 or uv is required. Install uv, or ensure py/python is available."
}

function Ensure-VenvPip {
  param(
    [string]$PythonExe
  )

  if (Test-NativeSuccess -FilePath $PythonExe -Arguments @("-m", "pip", "--version")) {
    return
  }

  if (Test-NativeSuccess -FilePath $PythonExe -Arguments @("-m", "ensurepip", "--upgrade")) {
    if (Test-NativeSuccess -FilePath $PythonExe -Arguments @("-m", "pip", "--version")) {
      return
    }
  }

  $uv = Resolve-Tool "uv"
  if ($uv) {
    Invoke-Native -FilePath $uv -Arguments @("pip", "install", "--python", $PythonExe, "pip", "setuptools", "wheel")
    if (Test-NativeSuccess -FilePath $PythonExe -Arguments @("-m", "pip", "--version")) {
      return
    }
  }

  throw "pip is unavailable in virtual environment: ${PythonExe}"
}

function Invoke-GitFetchAllowFailure {
  param(
    [string]$GitExe,
    [string]$RepositoryPath
  )

  $hasNativeErrorPreference = $null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
  if ($hasNativeErrorPreference) {
    $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }

  try {
    & $GitExe -C $RepositoryPath fetch --tags --force origin
  } finally {
    if ($hasNativeErrorPreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
    }
  }

  return $LASTEXITCODE
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
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $workPath) | Out-Null
}

Invoke-Step "Syncing upstream source ($Ref)" {
  if (-not (Test-Path (Join-Path $workPath ".git"))) {
    if (Test-Path $workPath) {
      Remove-Item $workPath -Recurse -Force
    }

    Invoke-Native -FilePath $git -Arguments @("clone", $RepoUrl, $workPath)
  }

  $fetchExitCode = Invoke-GitFetchAllowFailure -GitExe $git -RepositoryPath $workPath
  if ($fetchExitCode -ne 0) {
    Write-Host "Fetch failed; continuing with cached source at $workPath" -ForegroundColor Yellow
  }

  if (-not (Test-NativeSuccess -FilePath $git -Arguments @("-C", $workPath, "rev-parse", "--verify", $Ref))) {
    throw "Git ref '$Ref' is unavailable in cached repository: $workPath"
  }

  Invoke-Native -FilePath $git -Arguments @("-C", $workPath, "checkout", "--force", $Ref)
}

Invoke-Step "Creating virtual environment" {
  if (Test-Path $venvPath) {
    Remove-Item $venvPath -Recurse -Force
  }

  New-Venv -TargetDir $venvPath
}

$venvPython = Join-Path $venvPath "Scripts\\python.exe"
if (-not (Test-Path $venvPython)) {
  throw "Virtual environment python was not found at $venvPython"
}

Invoke-Step "Installing dependencies" {
  Ensure-VenvPip -PythonExe $venvPython
  Invoke-Native -FilePath $venvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel", "pyinstaller")
  Invoke-Native -FilePath $venvPython -Arguments @("-m", "pip", "install", $workPath)
}

Invoke-Step "Writing PyInstaller entrypoint" {
  @'
from windows_mcp.__main__ import main

if __name__ == "__main__":
    main()
'@ | Set-Content -Path $entryPath -Encoding ASCII
}

Invoke-Step "Building $ExeName.exe" {
  Invoke-Native -FilePath $venvPython -Arguments @(
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--name",
    $ExeName,
    "--distpath",
    $outputPath,
    "--workpath",
    (Join-Path $buildPath "pyinstaller"),
    "--specpath",
    $buildPath,
    "--collect-all",
    "windows_mcp",
    "--collect-all",
    "fastmcp",
    "--copy-metadata",
    "windows-mcp",
    $entryPath
  )
}

$exePath = Join-Path $outputPath "$ExeName.exe"
if (-not (Test-Path $exePath)) {
  throw "Build finished without producing $exePath"
}

Write-Host ""
Write-Host "Executable ready:" -ForegroundColor Green
Write-Host $exePath
