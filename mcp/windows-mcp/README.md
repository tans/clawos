# windows-mcp

This directory packages upstream `CursorTouch/Windows-MCP` into a Windows executable.

## Output

Default output:

```text
dist/windows-mcp.exe
```

## Requirements

- Windows
- `git`
- `uv` or Python 3.13

## Usage

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp\windows-mcp\build.ps1
```

Build a specific upstream branch, tag, or commit:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp\windows-mcp\build.ps1 -Ref v0.7.0
```

## What the Script Does

1. Clone or update `https://github.com/CursorTouch/Windows-MCP`
2. Create an isolated virtual environment in this directory
3. Install the upstream package and `PyInstaller`
4. Produce a single-file `windows-mcp.exe`

## Files

- `build.ps1`: packaging script
- `.cache/`: upstream source cache
- `.venv/`: local virtual environment
- `dist/`: output directory
