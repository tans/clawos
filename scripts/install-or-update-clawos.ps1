[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$TargetDir,

  [string]$DownloadUrl = "https://clawos.minapp.xin/downloads/latest",

  [switch]$KeepBackup
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2

function Write-Step {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function Resolve-DefaultTargetDir {
  $xiakeCn = [string][char]0x867E + [char]0x58F3
  $defaultDir = "C:\$xiakeCn"
  $fallbackDir = "C:\xiake"

  if (Test-Path -LiteralPath $defaultDir) {
    return $defaultDir
  }

  if (Test-Path -LiteralPath $fallbackDir) {
    return $fallbackDir
  }

  return $defaultDir
}

function Resolve-TargetDir {
  param([string]$RawTargetDir)

  if ($RawTargetDir -and $RawTargetDir.Trim().Length -gt 0) {
    return $RawTargetDir.Trim()
  }

  return Resolve-DefaultTargetDir
}

function Enable-Tls12 {
  try {
    $current = [Net.ServicePointManager]::SecurityProtocol
    $tls12 = [Net.SecurityProtocolType]::Tls12
    if (($current -band $tls12) -ne $tls12) {
      [Net.ServicePointManager]::SecurityProtocol = $current -bor $tls12
    }
  } catch {
    # Ignore TLS setup errors and let download throw a real error.
  }
}

function Download-File {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$OutFile
  )

  Enable-Tls12

  $webClient = $null
  try {
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("User-Agent", "clawos-installer")
    $webClient.DownloadFile($Url, $OutFile)
  } finally {
    if ($webClient -ne $null) {
      $webClient.Dispose()
    }
  }

  if (-not (Test-Path -LiteralPath $OutFile)) {
    throw "Downloaded file is missing: $OutFile"
  }

  $size = (Get-Item -LiteralPath $OutFile).Length
  if ($size -le 0) {
    throw "Downloaded file is empty."
  }
}

function Stop-ExistingClawos {
  param([string]$ExePath)

  $procName = [System.IO.Path]::GetFileNameWithoutExtension($ExePath)
  if (-not $procName) {
    $procName = "clawos"
  }

  $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
  if ($null -ne $procs) {
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
}

$downloadExe = $null
$targetExe = $null
$backupExe = $null
$mode = "install"
$didMoveOld = $false

try {
  $resolvedTargetDir = Resolve-TargetDir -RawTargetDir $TargetDir
  $targetExe = Join-Path -Path $resolvedTargetDir -ChildPath "clawos.exe"
  $backupExe = "$targetExe.old"

  $tempRoot = Join-Path -Path $env:TEMP -ChildPath "clawos-installer"
  $stamp = Get-Date -Format "yyyyMMddHHmmssfff"
  $downloadExe = Join-Path -Path $tempRoot -ChildPath ("clawos-latest-{0}.exe" -f $stamp)

  if (Test-Path -LiteralPath $targetExe) {
    $mode = "update"
  }

  Write-Step "[1/5] Prepare folders"
  New-Item -Path $tempRoot -ItemType Directory -Force | Out-Null
  New-Item -Path $resolvedTargetDir -ItemType Directory -Force | Out-Null

  Write-Step "[2/5] Download latest build"
  Download-File -Url $DownloadUrl -OutFile $downloadExe

  if ($mode -eq "update") {
    Write-Step "[3/5] Stop running clawos"
    Stop-ExistingClawos -ExePath $targetExe
  } else {
    Write-Step "[3/5] Install mode (skip process stop)"
  }

  Write-Step "[4/5] Replace executable"
  if ($mode -eq "update") {
    if (Test-Path -LiteralPath $backupExe) {
      Remove-Item -LiteralPath $backupExe -Force
    }

    Move-Item -LiteralPath $targetExe -Destination $backupExe -Force
    $didMoveOld = $true
  }

  Copy-Item -LiteralPath $downloadExe -Destination $targetExe -Force

  if (-not (Test-Path -LiteralPath $targetExe)) {
    throw "Target executable write failed: $targetExe"
  }

  Write-Step "[5/5] Start clawos"
  Start-Process -FilePath $targetExe | Out-Null

  if (-not $KeepBackup -and (Test-Path -LiteralPath $backupExe)) {
    Remove-Item -LiteralPath $backupExe -Force
  }

  if ($downloadExe -and (Test-Path -LiteralPath $downloadExe)) {
    Remove-Item -LiteralPath $downloadExe -Force
  }

  Write-Host ("Done: {0} succeeded and clawos is started." -f $mode) -ForegroundColor Green
  Write-Host ("Target: {0}" -f $targetExe)
  exit 0
} catch {
  $errorMessage = $_.Exception.Message
  Write-Host ("Failed: install/update did not finish. {0}" -f $errorMessage) -ForegroundColor Red

  if ($didMoveOld -and $backupExe -and (Test-Path -LiteralPath $backupExe)) {
    try {
      if ($targetExe -and (Test-Path -LiteralPath $targetExe)) {
        Remove-Item -LiteralPath $targetExe -Force
      }
      Move-Item -LiteralPath $backupExe -Destination $targetExe -Force
      Write-Host "Rollback completed." -ForegroundColor Yellow
    } catch {
      Write-Host ("Rollback failed: {0}" -f $_.Exception.Message) -ForegroundColor Red
    }
  }

  if ($downloadExe -and (Test-Path -LiteralPath $downloadExe)) {
    try {
      Remove-Item -LiteralPath $downloadExe -Force
    } catch {
      # ignore cleanup failures
    }
  }

  exit 1
}
