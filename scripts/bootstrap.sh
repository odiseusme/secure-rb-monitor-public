#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for Rosen Bridge Monitor
# One-shot convenience: port select (if needed), create dirs, compose up, show URL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { printf '[bootstrap] %s\n' "$*" >&2; }

cd "$PROJECT_ROOT"

# Step 1: Port selection (if needed)
if [ ! -f .env ] || ! grep -qE '^HOST_PORT=' .env; then
  log "Selecting available port..."
  scripts/select_host_port.sh
else
  log "Port already configured in .env"
fi

# Step 2: Create directories
log "Creating directories..."
mkdir -p data logs config

# Step 3: Start with docker-compose
log "Starting monitor with docker-compose..."
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  log "Error: Neither 'docker-compose' nor 'docker compose' found"
  exit 1
fi

$COMPOSE_CMD up -d --build

# Step 4: Wait for container to start
log "Waiting for container to start..."
sleep 5

# Step 5: Show URL
log "Monitor is starting up..."
scripts/show_monitor_url.sh

log "Bootstrap complete! Monitor should be accessible at the URLs above."
log "Use '$COMPOSE_CMD logs -f' to view logs."
log "Use '$COMPOSE_CMD down' to stop."