#!/bin/sh
# ──────────────────────────────────────────────────────────────
# Renne TGBot — pull the latest image and recreate the container.
#
# Designed for Synology Task Scheduler (run as root) on a schedule,
# e.g. every 30 minutes:
#   Control Panel → Task Scheduler → Create → Scheduled Task
#   User: root
#   Command: /volume1/docker/renne-tgbot/scripts/nas-update.sh
#
# Override defaults with env vars:
#   COMPOSE_DIR=/path/to/compose-dir LOG_FILE=/path/to/log.sh
# ──────────────────────────────────────────────────────────────

set -eu

COMPOSE_DIR="${COMPOSE_DIR:-/volume1/docker/renne-tgbot}"
LOG_FILE="${LOG_FILE:-$COMPOSE_DIR/update.log}"

cd "$COMPOSE_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# Prefer the v2 plugin, fall back to legacy docker-compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  log "ERROR: neither 'docker compose' nor 'docker-compose' found"
  exit 1
fi

log "Checking for image updates in $COMPOSE_DIR"

if $COMPOSE pull renne-tgbot >> "$LOG_FILE" 2>&1; then
  $COMPOSE up -d renne-tgbot >> "$LOG_FILE" 2>&1
  log "Update applied"
  # Best-effort cleanup of dangling old images
  docker image prune -f >> "$LOG_FILE" 2>&1 || true
else
  log "Pull failed — keeping current container"
  exit 1
fi
