[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$TargetDir,

  [string]$DownloadUrl = "https://clawos.minapp.xin/downloads/latest",

  [switch]$KeepBackup,

  [string]$AppIdentifier = "cc.clawos.desktop",

  [string]$PreferredChannel = "stable"
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

function Parse-ContentDispositionFileName {
  param([string]$ContentDisposition)

  if (-not $ContentDisposition) {
    return $null
  }

  $matchUtf8 = [System.Text.RegularExpressions.Regex]::Match(
    $ContentDisposition,
    "filename\\*=UTF-8''(?<name>[^;]+)",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if ($matchUtf8.Success) {
    $encoded = $matchUtf8.Groups["name"].Value
    try {
      return [System.Uri]::UnescapeDataString($encoded)
    } catch {
      return $encoded
    }
  }

  $matchQuoted = [System.Text.RegularExpressions.Regex]::Match(
    $ContentDisposition,
    'filename="(?<name>[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if ($matchQuoted.Success) {
    return $matchQuoted.Groups["name"].Value
  }

  $matchPlain = [System.Text.RegularExpressions.Regex]::Match(
    $ContentDisposition,
    "filename=(?<name>[^;]+)",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if ($matchPlain.Success) {
    return $matchPlain.Groups["name"].Value.Trim('"', "'", " ")
  }

  return $null
}

function Ensure-SafeFileName {
  param([string]$FileName)

  $name = [System.IO.Path]::GetFileName($FileName)
  if (-not $name) {
    return "clawos-latest.bin"
  }
  $safe = [System.Text.RegularExpressions.Regex]::Replace($name, "[^a-zA-Z0-9._-]", "_")
  if ([string]::IsNullOrWhiteSpace($safe)) {
    return "clawos-latest.bin"
  }
  return $safe
}

function Detect-PayloadType {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$FileName
  )

  $lower = $FileName.ToLowerInvariant()
  if ($lower.EndsWith(".zip")) {
    return "zip"
  }
  if ($lower.EndsWith(".exe")) {
    if ($lower.Contains("setup")) {
      return "setup-exe"
    }
    return "portable-exe"
  }

  try {
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    if ($bytes.Length -ge 4 -and $bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B -and $bytes[2] -eq 0x03 -and $bytes[3] -eq 0x04) {
      return "zip"
    }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
      if ($lower.Contains("setup")) {
        return "setup-exe"
      }
      return "portable-exe"
    }
  } catch {
    # ignore magic check failure
  }

  return "unknown"
}

function Download-Payload {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$TempRoot
  )

  Enable-Tls12

  if (-not (Test-Path -LiteralPath $TempRoot)) {
    New-Item -Path $TempRoot -ItemType Directory -Force | Out-Null
  }

  $stamp = Get-Date -Format "yyyyMMddHHmmssfff"
  $tempPath = Join-Path -Path $TempRoot -ChildPath ("clawos-download-{0}.bin" -f $stamp)
  $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $tempPath

  if (-not (Test-Path -LiteralPath $tempPath)) {
    throw "Downloaded file is missing: $tempPath"
  }

  $size = (Get-Item -LiteralPath $tempPath).Length
  if ($size -le 0) {
    throw "Downloaded file is empty."
  }

  $contentDisposition = ""
  try {
    $contentDisposition = [string]$response.Headers["Content-Disposition"]
  } catch {
    $contentDisposition = ""
  }

  $remoteName = Parse-ContentDispositionFileName -ContentDisposition $contentDisposition
  if (-not $remoteName) {
    try {
      $remoteName = [System.IO.Path]::GetFileName([System.Uri]$response.BaseResponse.ResponseUri)
    } catch {
      $remoteName = $null
    }
  }

  $resolvedName = if ($remoteName) { $remoteName } else { "clawos-latest.bin" }
  $safeName = Ensure-SafeFileName -FileName $resolvedName
  $finalPath = Join-Path -Path $TempRoot -ChildPath ("{0}-{1}" -f $stamp, $safeName)
  Move-Item -LiteralPath $tempPath -Destination $finalPath -Force

  return [pscustomobject]@{
    Path = $finalPath
    Name = $safeName
    Size = $size
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

function Update-RunAutoStart {
  param([string]$CommandPath)

  $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  $runName = "ClawOS"
  $runValue = ('"{0}"' -f $CommandPath)

  try {
    if (-not (Test-Path -LiteralPath $runKey)) {
      New-Item -Path $runKey -Force | Out-Null
    }
    Set-ItemProperty -Path $runKey -Name $runName -Value $runValue -Type String -ErrorAction Stop
    Write-Host ("Autostart updated: {0}" -f $runValue) -ForegroundColor DarkGray
  } catch {
    Write-Host ("Warning: failed to update autostart registry. {0}" -f $_.Exception.Message) -ForegroundColor Yellow
  }
}

function Read-ElectrobunMetadata {
  param([string]$ExtractedDir)

  $metadata = Get-ChildItem -LiteralPath $ExtractedDir -Filter "*.metadata.json" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $metadata) {
    return $null
  }

  try {
    $raw = Get-Content -LiteralPath $metadata.FullName -Raw -Encoding UTF8
    $obj = $raw | ConvertFrom-Json
    return [pscustomobject]@{
      Identifier = [string]$obj.identifier
      Channel = [string]$obj.channel
      Name = [string]$obj.name
    }
  } catch {
    return $null
  }
}

function Resolve-ElectrobunLauncherCandidates {
  param(
    [string]$Identifier,
    [string]$Channel,
    [string]$FallbackIdentifier,
    [string]$FallbackChannel
  )

  $candidates = New-Object System.Collections.Generic.List[string]
  $localAppData = $env:LOCALAPPDATA
  if (-not $localAppData) {
    return @()
  }

  $id = if ($Identifier) { $Identifier } else { $FallbackIdentifier }
  $ch = if ($Channel) { $Channel } else { $FallbackChannel }

  if ($id -and $ch) {
    $candidates.Add((Join-Path -Path $localAppData -ChildPath ("{0}\\{1}\\app\\bin\\launcher.exe" -f $id, $ch)))
  }
  if ($id) {
    $candidates.Add((Join-Path -Path $localAppData -ChildPath ("{0}\\app\\bin\\launcher.exe" -f $id)))
  }

  if ($FallbackIdentifier -and $FallbackChannel) {
    $candidates.Add((Join-Path -Path $localAppData -ChildPath ("{0}\\{1}\\app\\bin\\launcher.exe" -f $FallbackIdentifier, $FallbackChannel)))
  }

  if ($FallbackIdentifier) {
    $base = Join-Path -Path $localAppData -ChildPath $FallbackIdentifier
    if (Test-Path -LiteralPath $base) {
      $extra = Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object { Join-Path -Path $_.FullName -ChildPath "app\\bin\\launcher.exe" }
      foreach ($item in $extra) {
        $candidates.Add($item)
      }
    }
  }

  return $candidates | Select-Object -Unique
}

function Resolve-InstalledElectrobunLauncher {
  param(
    [string]$ExtractedDir,
    [string]$FallbackIdentifier,
    [string]$FallbackChannel
  )

  $meta = Read-ElectrobunMetadata -ExtractedDir $ExtractedDir
  $identifier = if ($meta) { $meta.Identifier } else { "" }
  $channel = if ($meta) { $meta.Channel } else { "" }

  $candidates = Resolve-ElectrobunLauncherCandidates -Identifier $identifier -Channel $channel -FallbackIdentifier $FallbackIdentifier -FallbackChannel $FallbackChannel
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Install-PortableExe {
  param(
    [Parameter(Mandatory = $true)][string]$PayloadPath,
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [switch]$KeepBackup
  )

  $targetExe = Join-Path -Path $InstallDir -ChildPath "clawos.exe"
  $backupExe = "$targetExe.old"
  $mode = if (Test-Path -LiteralPath $targetExe) { "update" } else { "install" }
  $didMoveOld = $false

  if (-not (Test-Path -LiteralPath $InstallDir)) {
    New-Item -Path $InstallDir -ItemType Directory -Force | Out-Null
  }

  if ($mode -eq "update") {
    Stop-ExistingClawos -ExePath $targetExe
    if (Test-Path -LiteralPath $backupExe) {
      Remove-Item -LiteralPath $backupExe -Force
    }
    Move-Item -LiteralPath $targetExe -Destination $backupExe -Force
    $didMoveOld = $true
  }

  try {
    Copy-Item -LiteralPath $PayloadPath -Destination $targetExe -Force

    if (-not (Test-Path -LiteralPath $targetExe)) {
      throw "Target executable write failed: $targetExe"
    }

    Update-RunAutoStart -CommandPath $targetExe
    Start-Process -FilePath $targetExe | Out-Null

    if (-not $KeepBackup -and (Test-Path -LiteralPath $backupExe)) {
      Remove-Item -LiteralPath $backupExe -Force
    }

    return [pscustomobject]@{
      Mode = $mode
      Target = $targetExe
      LaunchPath = $targetExe
    }
  } catch {
    if ($didMoveOld -and (Test-Path -LiteralPath $backupExe)) {
      try {
        if (Test-Path -LiteralPath $targetExe) {
          Remove-Item -LiteralPath $targetExe -Force
        }
        Move-Item -LiteralPath $backupExe -Destination $targetExe -Force
      } catch {
        # rollback best effort
      }
    }
    throw
  }
}

function Run-SetupInstaller {
  param(
    [Parameter(Mandatory = $true)][string]$SetupExe,
    [Parameter(Mandatory = $true)][string]$FallbackIdentifier,
    [Parameter(Mandatory = $true)][string]$FallbackChannel,
    [Parameter(Mandatory = $true)][string]$ExtractedDir
  )

  if (-not (Test-Path -LiteralPath $SetupExe)) {
    throw "Setup not found: $SetupExe"
  }

  $proc = Start-Process -FilePath $SetupExe -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    throw "Setup exited with code $($proc.ExitCode)"
  }

  Start-Sleep -Seconds 2
  $launcher = Resolve-InstalledElectrobunLauncher -ExtractedDir $ExtractedDir -FallbackIdentifier $FallbackIdentifier -FallbackChannel $FallbackChannel
  if ($launcher) {
    Update-RunAutoStart -CommandPath $launcher
    Start-Process -FilePath $launcher | Out-Null
  } else {
    Write-Host "Warning: setup completed, but launcher.exe was not found for autostart update." -ForegroundColor Yellow
  }

  return [pscustomobject]@{
    Mode = "setup"
    Target = $launcher
    LaunchPath = $launcher
  }
}

function Install-ElectrobunZip {
  param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$TempRoot,
    [Parameter(Mandatory = $true)][string]$FallbackIdentifier,
    [Parameter(Mandatory = $true)][string]$FallbackChannel
  )

  $expanded = Join-Path -Path $TempRoot -ChildPath ("expanded-{0}" -f (Get-Date -Format "yyyyMMddHHmmssfff"))
  New-Item -Path $expanded -ItemType Directory -Force | Out-Null
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $expanded -Force

  $setup = Get-ChildItem -LiteralPath $expanded -Filter "*Setup*.exe" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $setup) {
    throw "未在 Electrobun 压缩包中找到 Setup.exe。"
  }

  return Run-SetupInstaller -SetupExe $setup.FullName -FallbackIdentifier $FallbackIdentifier -FallbackChannel $FallbackChannel -ExtractedDir $expanded
}

function Install-ElectrobunSetupExe {
  param(
    [Parameter(Mandatory = $true)][string]$SetupExePath,
    [Parameter(Mandatory = $true)][string]$TempRoot,
    [Parameter(Mandatory = $true)][string]$FallbackIdentifier,
    [Parameter(Mandatory = $true)][string]$FallbackChannel
  )

  $setupDir = Split-Path -Path $SetupExePath -Parent
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($SetupExePath)
  $metadataPath = Join-Path -Path $setupDir -ChildPath ("{0}.metadata.json" -f $stem)
  $archivePath = Join-Path -Path $setupDir -ChildPath ("{0}.tar.zst" -f $stem)

  if (-not (Test-Path -LiteralPath $metadataPath) -or -not (Test-Path -LiteralPath $archivePath)) {
    throw "检测到 Setup.exe，但缺少同目录 .metadata.json/.tar.zst。请发布 Windows Setup.zip，而不是单独 exe。"
  }

  return Run-SetupInstaller -SetupExe $SetupExePath -FallbackIdentifier $FallbackIdentifier -FallbackChannel $FallbackChannel -ExtractedDir $setupDir
}

$downloaded = $null
$tempRoot = $null

try {
  $resolvedTargetDir = Resolve-TargetDir -RawTargetDir $TargetDir
  $tempRoot = Join-Path -Path $env:TEMP -ChildPath "clawos-installer"

  Write-Step "[1/5] Prepare folders"
  New-Item -Path $tempRoot -ItemType Directory -Force | Out-Null

  Write-Step "[2/5] Download latest package"
  $downloaded = Download-Payload -Url $DownloadUrl -TempRoot $tempRoot

  $payloadType = Detect-PayloadType -FilePath $downloaded.Path -FileName $downloaded.Name
  Write-Host ("Downloaded: {0} ({1} bytes), type={2}" -f $downloaded.Name, $downloaded.Size, $payloadType) -ForegroundColor DarkGray

  $result = $null
  if ($payloadType -eq "zip") {
    Write-Step "[3/5] Install Electrobun package"
    $result = Install-ElectrobunZip -ZipPath $downloaded.Path -TempRoot $tempRoot -FallbackIdentifier $AppIdentifier -FallbackChannel $PreferredChannel
  } elseif ($payloadType -eq "setup-exe") {
    Write-Step "[3/5] Install Electrobun setup"
    $result = Install-ElectrobunSetupExe -SetupExePath $downloaded.Path -TempRoot $tempRoot -FallbackIdentifier $AppIdentifier -FallbackChannel $PreferredChannel
  } elseif ($payloadType -eq "portable-exe") {
    Write-Step "[3/5] Install portable executable"
    $result = Install-PortableExe -PayloadPath $downloaded.Path -InstallDir $resolvedTargetDir -KeepBackup:$KeepBackup
  } else {
    throw "不支持的安装包类型：$($downloaded.Name)。请检查发布文件格式。"
  }

  Write-Step "[4/5] Cleanup"
  if ($downloaded -and (Test-Path -LiteralPath $downloaded.Path)) {
    Remove-Item -LiteralPath $downloaded.Path -Force -ErrorAction SilentlyContinue
  }

  Write-Step "[5/5] Done"
  Write-Host "Install/update completed." -ForegroundColor Green
  if ($result -and $result.Target) {
    Write-Host ("Target: {0}" -f $result.Target)
  }
  exit 0
} catch {
  $errorMessage = $_.Exception.Message
  Write-Host ("Failed: install/update did not finish. {0}" -f $errorMessage) -ForegroundColor Red
  exit 1
}
