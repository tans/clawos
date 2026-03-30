#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/run-bom-mcp.sh serve [env-file]
  bash scripts/run-bom-mcp.sh doctor [env-file]

Examples:
  bash scripts/run-bom-mcp.sh serve examples/mcp/bom-mcp.env.example
  bash scripts/run-bom-mcp.sh doctor /path/to/bom-mcp.env
EOF
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

mode="$1"
env_file="${2:-}"

case "$mode" in
  serve|doctor)
    ;;
  *)
    usage
    exit 1
    ;;
esac

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

if [[ "$mode" == "serve" ]]; then
  exec bun mcp/bom-mcp/src/index.ts serve --transport stdio
fi

exec bun mcp/bom-mcp/src/index.ts doctor '{}'
