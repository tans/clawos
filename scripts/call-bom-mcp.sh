#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/call-bom-mcp.sh <tool> <json-file> [env-file]

Examples:
  bash scripts/call-bom-mcp.sh doctor examples/mcp/bom-mcp.doctor.json examples/mcp/bom-mcp.env.example
  bash scripts/call-bom-mcp.sh quote_customer_message examples/mcp/bom-mcp.quote_customer_message.json /path/to/bom-mcp.env
EOF
}

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage
  exit 1
fi

tool="$1"
json_file="$2"
env_file="${3:-}"

if [[ ! -f "$json_file" ]]; then
  echo "json file not found: $json_file" >&2
  exit 1
fi

if [[ -n "$env_file" ]]; then
  if [[ ! -f "$env_file" ]]; then
    echo "env file not found: $env_file" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

args="$(cat "$json_file")"
exec bun mcp/bom-mcp/src/index.ts "$tool" "$args"
