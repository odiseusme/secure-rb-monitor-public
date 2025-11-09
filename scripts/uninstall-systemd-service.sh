#!/usr/bin/env bash
# uninstall-systemd-service.sh - Remove systemd service for cloudflare-sync uploader
#
# Usage: ./scripts/uninstall-systemd-service.sh

set -euo pipefail

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log() { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

echo ""
echo -e "${BOLD}🛰️  RBMonitor Auto-Start Removal${NC}"
echo "==================================="
echo ""

SERVICE_NAME="rbmonitor-uploader.service"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME"

# Check if service exists
if [ ! -f "$SERVICE_FILE" ]; then
  warn "Service file not found: $SERVICE_FILE"
  echo "Service may not be installed or was already removed."
  exit 0
fi

# Stop service if running
if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  log "Stopping service..."
  systemctl --user stop "$SERVICE_NAME"
  success "Service stopped"
else
  log "Service is not running"
fi

# Disable service
if systemctl --user is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
  log "Disabling service..."
  systemctl --user disable "$SERVICE_NAME"
  success "Service disabled"
else
  log "Service is not enabled"
fi

# Remove service file
log "Removing service file..."
rm -f "$SERVICE_FILE"
success "Service file removed: $SERVICE_FILE"

# Reload systemd daemon
log "Reloading systemd daemon..."
systemctl --user daemon-reload
success "Daemon reloaded"

echo ""
echo -e "${GREEN}✅ Service removed successfully!${NC}"
echo ""
echo "The uploader will no longer auto-start on boot."
echo "To start monitoring manually, use:"
echo "  ${CYAN}./scripts/monitor_control.sh start${NC}"
echo ""
