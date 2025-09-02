#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "[show-url] No .env found. Run scripts/select_host_port.sh first."; exit 1
fi

HOST_PORT=$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2 || true)
HOST_IP=$(grep -E '^HOST_IP=' "$ENV_FILE" | tail -1 | cut -d= -f2 || echo "127.0.0.1")

if [ -z "${HOST_PORT}" ]; then
  echo "[show-url] HOST_PORT not set. Run scripts/select_host_port.sh"; exit 1
fi

display_host="$HOST_IP"
if [ "$display_host" = "0.0.0.0" ] || [ "$display_host" = "127.0.0.1" ]; then
  display_host="localhost"
fi

local_url="http://${display_host}:${HOST_PORT}/"
echo "Local URL:  ${local_url}"

lan_ip_guess() {
  if command -v hostname >/dev/null 2>&1; then
    hip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "${hip:-}" ] && { echo "$hip"; return; }
  fi
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1; do
      hip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
      [ -n "${hip:-}" ] && { echo "$hip"; return; }
    done
  fi
  if command -v ip >/dev/null 2>&1; then
    hip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1);exit}}}')
    [ -n "${hip:-}" ] && { echo "$hip"; return; }
  fi
  echo "127.0.0.1"
}

lan_ip=$(lan_ip_guess)
if [ "$lan_ip" != "127.0.0.1" ]; then
  echo "LAN URL:    http://${lan_ip}:${HOST_PORT}/"
fi

# Warn if container not running
if command -v docker >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -q "rosen-bridge-monitor"; then
    echo "[show-url] Warning: rosen-bridge-monitor container not running"
  fi
fi

# Optional QR code
if [ "${SHOW_QR:-0}" = "1" ] || [ "${QR:-0}" = "1" ]; then
  if command -v qrencode >/dev/null 2>&1; then
    echo
    echo "QR Code:"
    qrencode -t ANSIUTF8 "http://${lan_ip}:${HOST_PORT}/" || echo "[show-url] qrencode failed"
    echo
  else
    echo "[show-url] QR requested but qrencode not installed"
  fi
fi
