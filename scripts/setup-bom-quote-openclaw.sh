#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/setup-bom-quote-openclaw.sh [bundle-dir] [repo-root]

Examples:
  bash scripts/setup-bom-quote-openclaw.sh
  bash scripts/setup-bom-quote-openclaw.sh plugins/bom-quote-openclaw /workspace/clawos

Environment overrides:
  BOM_MCP_STATE_DIR
  BOM_MCP_DB_PATH
  BOM_MCP_EXPORT_DIR
  BOM_MCP_CACHE_DIR
  BOM_MCP_FX_USD_CNY
  BOM_MCP_DIGIKEY_CDP_URL
USAGE
}

if [[ $# -gt 2 ]]; then
  usage
  exit 1
fi

repo_root_default="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bundle_dir="${1:-plugins/bom-quote-openclaw}"
repo_root="${2:-$repo_root_default}"

if [[ ! -d "$bundle_dir" ]]; then
  echo "bundle dir not found: $bundle_dir" >&2
  exit 1
fi

mcp_entry="$repo_root/mcp/bom-mcp/src/index.ts"
if [[ ! -f "$mcp_entry" ]]; then
  echo "bom-mcp entry not found: $mcp_entry" >&2
  exit 1
fi

state_dir_default="$HOME/.openclaw/state/bom-mcp"
state_dir="${BOM_MCP_STATE_DIR:-$state_dir_default}"
db_path="${BOM_MCP_DB_PATH:-$state_dir/bom-mcp.sqlite}"
export_dir="${BOM_MCP_EXPORT_DIR:-$state_dir/exports}"
cache_dir="${BOM_MCP_CACHE_DIR:-$state_dir/cache}"
fx_usd_cny="${BOM_MCP_FX_USD_CNY:-7.2}"
digikey_cdp_url="${BOM_MCP_DIGIKEY_CDP_URL:-}"

mkdir -p "$state_dir" "$export_dir" "$cache_dir"

output_path="$bundle_dir/.mcp.json"
cat > "$output_path" <<JSON
{
  "mcpServers": {
    "bom-mcp": {
      "command": "bun",
      "args": [
        "$mcp_entry",
        "serve",
        "--transport",
        "stdio"
      ],
      "env": {
        "BOM_MCP_STATE_DIR": "$state_dir",
        "BOM_MCP_DB_PATH": "$db_path",
        "BOM_MCP_EXPORT_DIR": "$export_dir",
        "BOM_MCP_CACHE_DIR": "$cache_dir",
        "BOM_MCP_FX_USD_CNY": "$fx_usd_cny",
        "BOM_MCP_DIGIKEY_CDP_URL": "$digikey_cdp_url"
      }
    }
  }
}
JSON

echo "generated $output_path"
echo "- entry: $mcp_entry"
echo "- state: $state_dir"
