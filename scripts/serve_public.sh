#!/usr/bin/env bash
set -euo pipefail

log() { printf '[serve_public] %s\n' "$*" >&2; }

log "serve_public.sh invoked at $(date)"

# --- Paths / Env ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

# --- Defaults / knobs (can be overridden via env) ---
START_PORT="${START_PORT:-8080}"
MAX_TRIES="${MAX_TRIES:-25}"
ALLOW_REUSE_EXISTING="${ALLOW_REUSE_EXISTING:-1}"   # 1 = reuse port in .env if still free
FORCE="${FORCE:-0}"                                 # 1 = ignore .env HOST_PORT and pick a new one
SERVICE_NAME="${SERVICE_NAME:-rosen-bridge-monitor}"
BIND_ALL="${BIND_ALL:-0}"                           # 1 = bind to 0.0.0.0 instead of 127.0.0.1
SHOW_QR="${SHOW_QR:-0}"                             # 1 = print a QR code (needs qrencode)
OPEN_BROWSER="${OPEN_BROWSER:-0}"                   # 1 = try to open the URL

log() { printf '[port-select] %s\n' "$*" >&2; }

# ------------------------------
# Helpers
# ------------------------------
has_cmd() { command -v "$1" >/dev/null 2>&1; }

port_in_use() {
  local p="$1"
  if has_cmd ss; then
    ss -ltn "( sport = :$p )" | awk 'NR>1{print; exit 0} END{exit (NR>1?0:1)}'
  elif has_cmd lsof; then
    lsof -i TCP:"$p" -sTCP:LISTEN -Pn >/dev/null 2>&1
  elif has_cmd netstat; then
    netstat -ltn | awk -v p=":$p" '$4 ~ p{found=1} END{exit (found?0:1)}'
  else
    # last resort: try binding with bash + /dev/tcp
    (exec 3<>/dev/tcp/127.0.0.1/"$p") >/dev/null 2>&1 && { exec 3>&-; return 0; } || return 1
  fi
}

update_env_kv() {
  local key="$1" val="$2"
  touch "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak -E "s|^${key}=.*$|${key}=${val}|" "$ENV_FILE"
  else
    printf "%s=%s\n" "$key" "$val" >> "$ENV_FILE"
  fi
}

lan_ip_guess() {
  # Prefer the primary route’s src IP
  if has_cmd ip; then
    ip -o route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++){if($i=="src"){print $(i+1); exit}}}'
  fi
}

print_qr() {
  local url="$1"
  [ "$SHOW_QR" = "1" ] || return 0
  if has_cmd qrencode; then
    echo
    qrencode -t ANSIUTF8 "$url" || true
    echo
  else
    log "qrencode not found; skipping QR code."
  fi
}

open_browser() {
  local url="$1"
  if [ "$OPEN_BROWSER" = "1" ]; then
    if has_cmd xdg-open; then xdg-open "$url" >/dev/null 2>&1 || true
    elif has_cmd open; then open "$url" >/dev/null 2>&1 || true
    fi
  fi
}

set_docker_gid() {
  local gid
  gid="$(getent group docker | cut -d: -f3 || true)"
  gid="${gid:-984}" # fallback that matches common distros
  update_env_kv "DOCKER_GID" "$gid"
  log ".env updated: DOCKER_GID=$gid"
}

maybe_bind_all() {
  if [ "$BIND_ALL" = "1" ]; then
    update_env_kv "HOST_IP" "0.0.0.0"
  else
    update_env_kv "HOST_IP" "127.0.0.1"
  fi
}

# ------------------------------
# Watcher discovery + files
# ------------------------------
discover_watchers_and_generate_files() {
  log "Discovering watcher service containers…"
  local service_names
  service_names=$(docker ps --format '{{.Names}}' | awk '/-service-1$/ && /watcher/')

  if [ -z "$service_names" ]; then
    log "No watchers found; not generating config.json or override file."
    return 0
  fi

  # 1) config.json
  local config_file="${PROJECT_ROOT}/config.json"
  log "Generating ${config_file}…"
  {
    echo '{'
    echo '  "watchers": ['
    local first=1
    for name in $service_names; do
      if [ $first -eq 0 ]; then echo ','; fi
      first=0
      printf '    {"name":"%s","url":"http://%s:3000/info"}' "$name" "$name"
    done
    echo
    echo '  ]'
    echo '}'
  } > "$config_file"
  log "Wrote $(echo "$service_names" | wc -w) watchers to ${config_file}"

  # 2) docker-compose.override.yml (attach monitor to each watcher network)
  log "Determining watcher networks…"
  declare -A networks=()
  local net
  for name in $service_names; do
    while read -r net; do
      [ -z "$net" ] && continue
      case "$net" in
        bridge|host|none) continue ;;
        *) networks["$net"]=1 ;;
      esac
    done < <(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$name")
  done

  local override_file="${PROJECT_ROOT}/docker-compose.override.yml"
  log "Generating ${override_file}…"
  {
    echo "version: '3.9'"
    echo "services:"
    echo "  monitor:"
    echo "    networks:"
    for net in "${!networks[@]}"; do
      echo "      - ${net}"
    done
    echo
    echo "networks:"
    for net in "${!networks[@]}"; do
      echo "  ${net}:"
      echo "    external: true"
    done
  } > "$override_file"
  log "Wrote networks to ${override_file}"
}

# ------------------------------
# Main
# ------------------------------
main() {
  set_docker_gid
  maybe_bind_all

  # If HOST_PORT is already set and we're not forcing, show it and exit
  if [ -f "$ENV_FILE" ] && grep -qE '^HOST_PORT=' "$ENV_FILE" && [ "$FORCE" -ne 1 ]; then
    local current host_ip display_host ip_lan
    current="$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
    host_ip="$(grep -E '^HOST_IP='  "$ENV_FILE" | tail -1 | cut -d= -f2 || echo 127.0.0.1)"
    display_host="$host_ip"; [ "$display_host" = "0.0.0.0" ] && display_host="localhost"

    echo "Monitor URL: http://${display_host}:${current}/"
    ip_lan="$(lan_ip_guess || echo 127.0.0.1)"
    [ "$ip_lan" != "127.0.0.1" ] && echo "LAN URL:     http://${ip_lan}:${current}/"
    print_qr "http://${ip_lan}:${current}/"
    open_browser "http://${display_host}:${current}/"

    # always (re)generate watcher files
    discover_watchers_and_generate_files
    return 0
  fi

  # Pick a free port
  local port count
  port="$START_PORT"
  count=0

  if [ "$ALLOW_REUSE_EXISTING" = "1" ] && [ -f "$ENV_FILE" ] && grep -qE '^HOST_PORT=' "$ENV_FILE"; then
    local existing
    existing="$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
    if [ -n "$existing" ] && ! port_in_use "$existing"; then
      port="$existing"
    fi
  fi

  while port_in_use "$port"; do
    log "Port $port busy; next."
    port=$((port+1)); count=$((count+1))
    if [ "$count" -ge "$MAX_TRIES" ]; then
      log "No free port found starting from ${START_PORT} (tried ${MAX_TRIES})."
      exit 1
    fi
  done

  update_env_kv "HOST_PORT" "$port"

  # Display URLs
  local host_ip display_host ip_lan
  host_ip="$(grep -E '^HOST_IP=' "$ENV_FILE" | tail -1 | cut -d= -f2 || echo 127.0.0.1)"
  display_host="$host_ip"; [ "$display_host" = "0.0.0.0" ] && display_host="localhost"

  echo "Monitor URL: http://${display_host}:${port}/"
  ip_lan="$(lan_ip_guess || echo 127.0.0.1)"
  [ "$ip_lan" != "127.0.0.1" ] && echo "LAN URL:     http://${ip_lan}:${port}/"
  print_qr "http://${ip_lan}:${port}/"
  open_browser "http://${display_host}:${port}/"

  # Generate watcher files
  discover_watchers_and_generate_files
}

main "$@"

