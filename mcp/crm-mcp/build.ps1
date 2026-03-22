param(
  [string]$Entry = ".\\mcp\\crm-mcp\\src\\index.ts",
  [string]$OutDir = ".\\mcp\\crm-mcp\\dist",
  [string]$ExeName = "crm-mcp"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error "bun not found in PATH"
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$OutFile = Join-Path $OutDir "$ExeName.exe"

bun build $Entry --compile --outfile $OutFile
if ($LASTEXITCODE -ne 0) {
  Write-Error "build failed"
  exit $LASTEXITCODE
}

Write-Host "Built: $OutFile"
