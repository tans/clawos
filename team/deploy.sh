#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy-$(date '+%Y%m%d-%H%M%S').log"

log() {
  local now
  now="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$now] $*" | tee -a "$LOG_FILE"
}

run_step() {
  local name="$1"
  shift

  log "START: ${name}"
  local step_start step_end duration
  step_start=$(date +%s)

  if "$@" 2>&1 | tee -a "$LOG_FILE"; then
    step_end=$(date +%s)
    duration=$((step_end - step_start))
    log "END: ${name} (耗时 ${duration}s)"
  else
    step_end=$(date +%s)
    duration=$((step_end - step_start))
    log "FAILED: ${name} (耗时 ${duration}s)"
    return 1
  fi
}

overall_start=$(date +%s)
log "Team webhook 部署开始，日志文件: $LOG_FILE"

cd "$BASE_DIR"
run_step "git pull" git pull
run_step "bun install (backend)" bun install
run_step "bun install (frontend)" bash -lc "cd frontend && bun install"
run_step "bun run build:frontend" bun run build:frontend
run_step "pm2 restart clawos-team" pm2 restart clawos-team

overall_end=$(date +%s)
overall_duration=$((overall_end - overall_start))
log "部署完成，总耗时 ${overall_duration}s"
