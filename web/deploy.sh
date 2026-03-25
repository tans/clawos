#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"
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
log "部署开始，日志文件: $LOG_FILE"

run_step "git pull" git pull
run_step "bun install" bun install
run_step "bun run tailwind:build" bun run tailwind:build
run_step "pm2 restart clawos" pm2 restart clawos

overall_end=$(date +%s)
overall_duration=$((overall_end - overall_start))
log "部署完成，总耗时 ${overall_duration}s"
