#!/usr/bin/env bash
# install-systemd-service.sh - Install systemd service for cloudflare-sync uploader
#
# This creates a systemd user service that:
# - Auto-starts uploader after reboot
# - Restarts on failure
# - Manages logs via journalctl
#
# Usage: ./scripts/install-systemd-service.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

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
echo -e "${BOLD}🛰️  RBMonitor Auto-Start Setup${NC}"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
  error ".env file not found. Run ./scripts/register-user.sh first."
fi

# Check if cloudflare-sync.js exists
if [ ! -f "cloudflare-sync.js" ]; then
  error "cloudflare-sync.js not found in project root."
fi

# Ensure systemd user directory exists
SYSTEMD_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_DIR"

SERVICE_NAME="rbmonitor-uploader.service"
SERVICE_FILE="$SYSTEMD_DIR/$SERVICE_NAME"

log "Creating systemd service file..."

# Create service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=RBMonitor Cloudflare Uploader
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_ROOT
EnvironmentFile=$PROJECT_ROOT/.env
ExecStart=/usr/bin/node $PROJECT_ROOT/cloudflare-sync.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource limits
MemoryMax=256M
CPUQuota=50%

[Install]
WantedBy=default.target
EOF

success "Service file created: $SERVICE_FILE"
echo ""

# Reload systemd daemon
log "Reloading systemd daemon..."
systemctl --user daemon-reload
success "Daemon reloaded"
echo ""

# Enable service (auto-start on boot)
log "Enabling service for auto-start..."
systemctl --user enable "$SERVICE_NAME"
success "Service enabled - will auto-start on boot"
echo ""

# Ask if user wants to start now
read -r -p "Start uploader service now? [Y/n] " start_reply
start_reply="${start_reply,,}"
if [[ "$start_reply" != "n" && "$start_reply" != "no" ]]; then
  log "Starting service..."
  systemctl --user start "$SERVICE_NAME"
  sleep 2
  
  # Check status
  if systemctl --user is-active --quiet "$SERVICE_NAME"; then
    success "Service started successfully!"
  else
    warn "Service failed to start. Check status with: systemctl --user status $SERVICE_NAME"
  fi
else
  log "Skipped starting service. Start manually with: systemctl --user start $SERVICE_NAME"
fi

echo ""
echo -e "${BOLD}📋 Service Management Commands:${NC}"
echo "  Start:   ${CYAN}systemctl --user start $SERVICE_NAME${NC}"
echo "  Stop:    ${CYAN}systemctl --user stop $SERVICE_NAME${NC}"
echo "  Status:  ${CYAN}systemctl --user status $SERVICE_NAME${NC}"
echo "  Logs:    ${CYAN}journalctl --user -u $SERVICE_NAME -f${NC}"
echo "  Disable: ${CYAN}systemctl --user disable $SERVICE_NAME${NC}"
echo ""

echo -e "${BOLD}🔄 Docker Container:${NC}"
echo "  The Docker container (producer) has its own restart policy."
echo "  It will auto-start automatically - no systemd service needed."
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo "Uploader will now auto-start after reboot."
echo ""
