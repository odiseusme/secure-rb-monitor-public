#!/usr/bin/env bash
# show_dashboard_url_and_qr.sh - Display dashboard access info with QR codes
# Supports both local (Docker) and remote (Cloudflare) dashboards
# Optional passphrase embedding for convenience

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
  CYAN="$(tput setaf 6)"
  GREEN="$(tput setaf 2)"
  YELLOW="$(tput setaf 3)"
  RED="$(tput setaf 1)"
  BLUE="$(tput setaf 4)"
  BOLD="$(tput bold)"
  NC="$(tput sgr0)"
else
  CYAN=$'\033[0;36m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
  RED=$'\033[0;31m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; NC=$'\033[0m'
fi

# Parse command-line options
SHOW_LOCAL=0
SHOW_REMOTE=0
EMBED_PASSPHRASE=0
AUTO_YES=0

usage() {
  cat <<EOF
${BOLD}${CYAN}Rosen Bridge Monitor - Dashboard Display${NC}

${BOLD}Usage:${NC}
  $0 [OPTIONS]

${BOLD}Options:${NC}
  --local              Show local dashboard only
  --remote             Show remote dashboard only
  --embed-passphrase   Embed passphrase in URL (less secure)
  -y, --yes           Auto-answer yes to all prompts
  -h, --help          Show this help

${BOLD}Examples:${NC}
  $0                          # Interactive mode (choose local or remote)
  $0 --local                  # Show only local dashboard
  $0 --remote                 # Show only remote dashboard
  $0 --remote --embed-passphrase  # Remote with embedded passphrase
  $0 -y                       # Show both without prompts

${BOLD}Note:${NC}
  - Local dashboard requires Docker container running
  - Remote dashboard requires .cloudflare-config.json (run registration first)
  - Passphrase embedding is convenient but less secure
  - QR codes saved as PNG files in current directory
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) SHOW_LOCAL=1; shift ;;
    --remote) SHOW_REMOTE=1; shift ;;
    --embed-passphrase) EMBED_PASSPHRASE=1; shift ;;
    -y|--yes) AUTO_YES=1; shift ;;
    -h|--help) usage ;;
    *) echo "${RED}Unknown option: $1${NC}"; usage ;;
  esac
done

# Helper functions
ask_yn() {
  local prompt="$1"
  local default="${2:-n}"
  
  if [ "$AUTO_YES" = "1" ]; then
    echo "${prompt} [Y/n] y (auto)"
    return 0
  fi
  
  while true; do
    if [ "$default" = "y" ]; then
      read -r -p "${prompt} [Y/n] " response
      response="${response:-y}"
    else
      read -r -p "${prompt} [y/N] " response
      response="${response:-n}"
    fi
    
    response="${response,,}"
    case "$response" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
      *) echo "Please answer yes or no." ;;
    esac
  done
}

get_lan_ip() {
  local ip=""
  
  # Try hostname -I (Linux)
  if command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ] && { echo "$ip"; return; }
  fi
  
  # Try ipconfig (macOS)
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 eth0; do
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
      [ -n "$ip" ] && { echo "$ip"; return; }
    done
  fi
  
  # Try ip route (Linux)
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1);exit}}}')
    [ -n "$ip" ] && { echo "$ip"; return; }
  fi
  
  echo "127.0.0.1"
}

show_qr() {
  local url="$1"
  local filename="$2"
  
  # Strip ANSI color codes from URL (in case it got any)
  url=$(echo "$url" | sed 's/\x1b\[[0-9;]*m//g')
  
  if ! command -v qrencode >/dev/null 2>&1; then
    echo "${YELLOW}⚠  qrencode not installed - skipping QR code${NC}"
    echo "   Install: ${CYAN}sudo apt install qrencode${NC} (Ubuntu/Debian)"
    echo "           ${CYAN}brew install qrencode${NC} (macOS)"
    return
  fi
  
  echo ""
  
  # Terminal QR
  qrencode -t ANSIUTF8 -m 2 "$url" 2>/dev/null || {
    echo "${YELLOW}⚠  Failed to generate terminal QR${NC}"
    return
  }
  echo ""
  
  # PNG QR
  if qrencode -o "$filename" -m 2 "$url" 2>/dev/null; then
    echo "${GREEN}✓ Saved QR code: ${BOLD}${filename}${NC}"
  else
    echo "${YELLOW}⚠  Failed to save PNG QR code${NC}"
  fi
}

show_local_dashboard() {
  echo ""
  echo "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${BOLD}${CYAN}   Rosen Bridge Monitor - LOCAL DASHBOARD${NC}"
  echo "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Check if Docker container is running
  if ! command -v docker >/dev/null 2>&1; then
    echo "${RED}✗ Docker not found${NC}"
    return 1
  fi
  
  if ! docker ps --format '{{.Names}}' | grep -q "rosen-bridge-monitor"; then
    echo "${YELLOW}⚠  Docker container not running${NC}"
    echo "   Start with: ${CYAN}docker compose up -d${NC}"
    return 1
  fi
  
  # Get port from .env or docker
  local host_port=""
  local host_ip="0.0.0.0"
  
  if [ -f ".env" ]; then
    host_port=$(grep -E '^HOST_PORT=' .env | tail -1 | cut -d= -f2 || true)
    host_ip=$(grep -E '^HOST_IP=' .env | tail -1 | cut -d= -f2 || echo "0.0.0.0")
  fi
  
  if [ -z "$host_port" ]; then
    # Try to detect from docker
    host_port=$(docker port rosen-bridge-monitor 8080 2>/dev/null | cut -d: -f2 || echo "8080")
  fi
  
  # Determine display host
  local display_host="$host_ip"
  if [ "$display_host" = "0.0.0.0" ] || [ "$display_host" = "127.0.0.1" ]; then
    display_host="localhost"
  fi
  
  # Get LAN IP
  local lan_ip=$(get_lan_ip)
  
  echo ""
  echo "${GREEN}✓ Docker container running${NC}"
  echo ""
  echo "${BOLD}Access from this computer:${NC}"
  echo "  ${BLUE}http://${display_host}:${host_port}/${NC}"
  
  if [ "$lan_ip" != "127.0.0.1" ]; then
    echo ""
    echo "${BOLD}Access from mobile/other devices (same network):${NC}"
    echo "  ${BLUE}http://${lan_ip}:${host_port}/${NC}"
    echo ""
    
    # Ask to show QR
    if ask_yn "${BOLD}Show QR code for mobile access?${NC}" "y"; then
      show_qr "http://${lan_ip}:${host_port}/" "dashboard-local.png"
    fi
  fi
}

show_remote_dashboard() {
  echo ""
  echo "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${BOLD}${CYAN}   REMOTE DASHBOARD (Cloudflare)${NC}"
  echo "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Check if registered
  if [ ! -f ".cloudflare-config.json" ]; then
    echo "${YELLOW}⚠  Not registered with Cloudflare${NC}"
    echo "   Register with: ${CYAN}./scripts/register-user.sh${NC}"
    echo "   Or QR mode: ${CYAN}./scripts/register-with-qr.sh --invite CODE${NC}"
    return 1
  fi
  
  # Check for jq
  if ! command -v jq >/dev/null 2>&1; then
    echo "${RED}✗ jq not found (required to read config)${NC}"
    echo "   Install: ${CYAN}sudo apt install jq${NC}"
    return 1
  fi
  
  # Extract info
  local dashboard_url public_id
  dashboard_url=$(jq -r '.dashboardUrl' .cloudflare-config.json 2>/dev/null || echo "")
  public_id=$(jq -r '.publicId' .cloudflare-config.json 2>/dev/null || echo "")
  
  if [ -z "$dashboard_url" ] || [ "$dashboard_url" = "null" ]; then
    echo "${RED}✗ Invalid .cloudflare-config.json${NC}"
    return 1
  fi
  
  echo ""
  echo "${BOLD}Dashboard URL:${NC}"
  echo ""
  echo "${BLUE}${dashboard_url}${NC}"
  
  # Ask to show QR
  echo ""
  if ask_yn "${BOLD}Show QR code to access dashboard?${NC}" "y"; then
    local qr_filename="dashboard-${public_id}.png"
    show_qr "$dashboard_url" "$qr_filename"
  fi
}

# Main logic
main() {
  # If no flags specified, show both
  if [ "$SHOW_LOCAL" = "0" ] && [ "$SHOW_REMOTE" = "0" ]; then
    SHOW_LOCAL=1
    SHOW_REMOTE=1
  fi
  
  # Show requested dashboards
  local exit_code=0
  
  if [ "$SHOW_LOCAL" = "1" ]; then
    show_local_dashboard || exit_code=$?
  fi
  
  if [ "$SHOW_REMOTE" = "1" ]; then
    show_remote_dashboard || exit_code=$?
  fi
  
  exit $exit_code
}

main "$@"
