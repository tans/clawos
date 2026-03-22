# wechat-mcp

Bun-based wechat MCP runtime.

## Features

- Single script: inject + callback receiver + message capture.
- API gateway from `api.md` index (auto route table).
- Metadata endpoints for route discovery.
- Captures callback payloads for schema comparison.

## Start

```powershell
bun .\mcp\wechat-mcp\start.ts --mode http --mcp-port 5000 --upstream-base http://127.0.0.1:19088 --http-callback-url "http://127.0.0.1:5000/api/recvMsg"
```

## Metadata endpoints

- `GET /health`
- `GET /api/_meta/stats`
- `GET /api/_meta/apis`
- `GET /api/_capture/latest`
- `GET /api/_capture/summary`

## Notes

- `api.md` callback items with `N/A` are callback-only and cannot be actively forwarded.
- Captured files are saved under `mcp/wechat-mcp/captures/`.
- Use `--auto-inject false` to run only the MCP server.
