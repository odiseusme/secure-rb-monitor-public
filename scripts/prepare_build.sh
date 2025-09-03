#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

START_PORT="${START_PORT:-8080}"
MAX_TRIES="${MAX_TRIES:-25}"
ALLOW_REUSE_EXISTING="${ALLOW_REUSE_EXISTING:-1}"
FORCE="${FORCE:-0}"
SERVICE_NAME="rosen-bridge-monitor"
BIND_ALL="${BIND_ALL:-0}"
SHOW_QR="${SHOW_QR:-0}"
OPEN_BROWSER="${OPEN_BROWSER:-0}"

log() { printf '[port-select] %s\n' "$*" >&2; }
have_cmd() { command -v "$1" >/dev/null 2>&1; }

set_docker_gid() {
  # Detect the docker group GID and write it to .env
  local gid
  gid=$(getent group docker | cut -d: -f3)
  if [ -z "$gid" ]; then
    log "Error: Could not find 'docker' group on this system."
    exit 1
  fi
  if [ ! -f "$ENV_FILE" ]; then
    echo "DOCKER_GID=$gid" > "$ENV_FILE"; return
  fi
  if grep -qE "^DOCKER_GID=" "$ENV_FILE"; then
    tmp="$(mktemp "${ENV_FILE}.XXXX")"
    awk -v k="DOCKER_GID" -v v="$gid" -F= '
      BEGIN{u=0}
      $1==k {$0=k"="v; u=1}
      {print}
      END{ if(!u){print k"="v} }' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "DOCKER_GID=$gid" >> "$ENV_FILE"
  fi
  log ".env updated: DOCKER_GID=$gid"
}

port_in_use() {
  local port="$1"
  if have_cmd ss; then
    ss -ltn "( sport = :$port )" 2>/dev/null | awk 'NR>1 {exit 0} END {exit (NR<=1)}'; return
  fi
  if have_cmd lsof; then
    lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | grep -q ":$port (LISTEN" && return 0 || return 1
  fi
  if have_cmd nc; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1 && return 0 || return 1
  fi
  (exec 3<>/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1 && { exec 3>&- 2>&-; return 0; } || return 1
}

port_used_by_monitor_container() {
  local port="$1"
  have_cmd docker || return 1
  docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | \
    awk -v p=":${port}->8080" -v name="$SERVICE_NAME" '
      $1==name && index($0,p)>0 {found=1}
      END {exit (found?0:1)}'
}

update_env_kv() {
  local key="$1" value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    echo "$key=$value" > "$ENV_FILE"; return
  fi
  if grep -qE "^${key}=" "$ENV_FILE"; then
    tmp="$(mktemp "${ENV_FILE}.XXXX")"
    awk -v k="$key" -v v="$value" -F= '
      BEGIN{u=0}
      $1==k {$0=k"="v; u=1}
      {print}
      END{ if(!u){print k"="v} }' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "$key=$value" >> "$ENV_FILE"
  fi
}

lan_ip_guess() {
  if have_cmd hostname; then
    hip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "${hip:-}" ] && { echo "$hip"; return; }
  fi
  if have_cmd ip; then
    hip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1);exit}}}')
    [ -n "${hip:-}" ] && { echo "$hip"; return; }
  fi
  echo "127.0.0.1"
}

maybe_bind_all() {
  [ "$BIND_ALL" != "1" ] && return
  local current=""
  [ -f "$ENV_FILE" ] && current=$(grep -E '^HOST_IP=' "$ENV_FILE" | tail -1 | cut -d= -f2 || true)
  if [ -z "$current" ] || [ "$current" = "127.0.0.1" ]; then
    update_env_kv "HOST_IP" "0.0.0.0"
    log "Set HOST_IP=0.0.0.0 (BIND_ALL=1)."
  else
    log "HOST_IP already $current."
  fi
}

open_browser() {
  local url="$1"
  case "$(uname -s)" in
    Darwin) command -v open >/dev/null && open "$url" >/dev/null 2>&1 || true ;;
    Linux) command -v xdg-open >/dev/null && xdg-open "$url" >/dev/null 2>&1 || true ;;
    MINGW*|MSYS*|CYGWIN*) cmd.exe /c start "" "$url" >/dev/null 2>&1 || true ;;
  esac
}

print_qr() {
  local url="$1"
  [ "$SHOW_QR" = "1" ] || return
  have_cmd qrencode || { log "SHOW_QR=1 but qrencode not installed"; return; }
  echo
  echo "QR:"
  qrencode -t ANSIUTF8 "$url" || log "qrencode failed."
  echo
}

main() {
  set_docker_gid      # <<== NEW: always update DOCKER_GID in .env before anything else
  maybe_bind_all

  if [ -f "$ENV_FILE" ] && grep -qE '^HOST_PORT=' "$ENV_FILE" && [ "$FORCE" -ne 1 ]; then
    local current host_ip ip_lan display_host
    current=$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)
    host_ip=$(grep -E '^HOST_IP=' "$ENV_FILE" | tail -1 | cut -d= -f2 || echo "127.0.0.1")
    display_host="$host_ip"
    [ "$display_host" = "0.0.0.0" ] && display_host="localhost"
    echo "Monitor URL: http://${display_host}:${current}/"
    ip_lan=$(lan_ip_guess)
    [ "$ip_lan" != "127.0.0.1" ] && echo "LAN URL:     http://${ip_lan}:${current}/"
    print_qr "http://${ip_lan}:${current}/"
    [ "$OPEN_BROWSER" = "1" ] && open_browser "http://${display_host}:${current}/"
    exit 0
  fi

  local port="$START_PORT" candidate="" count=0
  while [ $count -lt "$MAX_TRIES" ]; do
    if port_in_use "$port"; then
      if [ "$ALLOW_REUSE_EXISTING" -eq 1 ] && port_used_by_monitor_container "$port"; then
        log "Reusing existing container mapping $port."
        candidate="$port"; break
      fi
      log "Port $port busy; next."
      port=$((port+1)); count=$((count+1)); continue
    fi
    candidate="$port"; break
  done
  [ -z "$candidate" ] && { log "No free port found."; exit 2; }

  update_env_kv "HOST_PORT" "$candidate"
  grep -qE '^MONITOR_PORT=' "$ENV_FILE" || echo "MONITOR_PORT=8080" >> "$ENV_FILE"
  grep -qE '^HOST_IP=' "$ENV_FILE" || echo "HOST_IP=127.0.0.1" >> "$ENV_FILE"
  grep -qE '^UPDATE_INTERVAL=' "$ENV_FILE" || echo "UPDATE_INTERVAL=30000" >> "$ENV_FILE"

  local host_ip display_host ip_lan
  host_ip=$(grep -E '^HOST_IP=' "$ENV_FILE" | tail -1 | cut -d= -f2 || echo "127.0.0.1")
  display_host="$host_ip"
  [ "$display_host" = "0.0.0.0" ] && display_host="localhost"
  echo "Selected HOST_PORT=$candidate"
  echo "Monitor URL: http://${display_host}:${candidate}/"
  ip_lan=$(lan_ip_guess)
  [ "$ip_lan" != "127.0.0.1" ] && echo "LAN URL:     http://${ip_lan}:${candidate}/"
  print_qr "http://${ip_lan}:${candidate}/"
  [ "$OPEN_BROWSER" = "1" ] && open_browser "http://${display_host}:${candidate}/"
}

main "$@"
