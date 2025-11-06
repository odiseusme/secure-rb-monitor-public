#!/usr/bin/env bash
# test-systemd-autostart.sh - Test systemd auto-start functionality
#
# This script will:
# 1. Install the systemd service
# 2. Start it
# 3. Check if it's running
# 4. Show you the logs
# 5. Give instructions for reboot test
#
# Usage: ./test-systemd-autostart.sh

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
echo -e "${BOLD}🧪 Testing Systemd Auto-Start${NC}"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "scripts/install-systemd-service.sh" ]; then
  error "Run this script from the project root directory"
fi

# Stop any running monitor first
log "Stopping any existing monitor processes..."
if [ -f "scripts/monitor_control.sh" ]; then
  ./scripts/monitor_control.sh stop 2>/dev/null || true
fi
sleep 2

# Install the service
log "Installing systemd service..."
./scripts/install-systemd-service.sh

echo ""
log "Waiting 5 seconds for service to stabilize..."
sleep 5

# Check if service is running
echo ""
log "Checking service status..."
if systemctl --user is-active --quiet rbmonitor-uploader.service; then
  success "Service is running!"
else
  error "Service is NOT running. Check: systemctl --user status rbmonitor-uploader.service"
fi

# Show recent logs
echo ""
log "Recent logs (last 20 lines):"
echo "---"
journalctl --user -u rbmonitor-uploader.service -n 20 --no-pager
echo "---"

# Check Docker container
echo ""
log "Checking Docker container..."
if docker ps | grep -q rosen-bridge-monitor; then
  success "Docker container is running"
else
  warn "Docker container is NOT running. Start with: docker compose up -d"
fi

echo ""
echo -e "${BOLD}📋 Test Results Summary:${NC}"
echo ""

# Service status
if systemctl --user is-active --quiet rbmonitor-uploader.service; then
  echo -e "  Uploader Service: ${GREEN}✓ RUNNING${NC}"
else
  echo -e "  Uploader Service: ${RED}✗ NOT RUNNING${NC}"
fi

# Docker status
if docker ps | grep -q rosen-bridge-monitor; then
  echo -e "  Docker Container: ${GREEN}✓ RUNNING${NC}"
else
  echo -e "  Docker Container: ${YELLOW}⚠ NOT RUNNING${NC}"
fi

echo ""
echo -e "${BOLD}🔄 Reboot Test Instructions:${NC}"
echo ""
echo "1. Note the current state above"
echo "2. Reboot your system: ${CYAN}sudo reboot${NC}"
echo "3. After reboot, wait 1-2 minutes"
echo "4. Check if services auto-started:"
echo ""
echo "   ${CYAN}# Check uploader service${NC}"
echo "   systemctl --user status rbmonitor-uploader.service"
echo ""
echo "   ${CYAN}# Check Docker container${NC}"
echo "   docker ps | grep rosen-bridge-monitor"
echo ""
echo "   ${CYAN}# View uploader logs${NC}"
echo "   journalctl --user -u rbmonitor-uploader.service -f"
echo ""
echo -e "${BOLD}Expected after reboot:${NC}"
echo "  - Docker container: ${GREEN}✓ Auto-started (restart: unless-stopped policy)${NC}"
echo "  - Uploader service: ${GREEN}✓ Auto-started (systemd service enabled)${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to run this after reboot for systemd user services:${NC}"
echo "  loginctl enable-linger \$USER"
echo ""
