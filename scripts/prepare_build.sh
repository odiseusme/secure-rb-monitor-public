#!/usr/bin/env bash
set -euo pipefail

# ---------- Paths / Env ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

# ---------- Defaults (overridable via env) ----------
START_PORT="${START_PORT:-8080}"
MAX_TRIES="${MAX_TRIES:-25}"
ALLOW_REUSE_EXISTING="${ALLOW_REUSE_EXISTING:-1}"   # reuse HOST_PORT in .env if still free
FORCE="${FORCE:-0}"                                 # ignore existing HOST_PORT and pick new
BIND_ALL="${BIND_ALL:-1}"                           # 1 = bind to 0.0.0.0 instead of 127.0.0.1
SHOW_QR="${SHOW_QR:-0}"                             # 1 = print a QR code (needs qrencode)
OPEN_BROWSER="${OPEN_BROWSER:-0}"                   # 1 = open the URL

log() { printf '[port-select] %s\n' "$*" >&2; }

# ---------- Helpers ----------
has_cmd() { command -v "$1" >/dev/null 2>&1; }

# Validate network names to prevent command injection
validate_network_name() {
  local net="$1"
  if [[ ! "$net" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log "ERROR: Invalid network name: $net (contains unsafe characters)"
    return 1
  fi
  return 0
}

# Validate port numbers are in valid range
validate_port() {
  local port="$1"
  if [[ ! "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    log "ERROR: Invalid port number: $port"
    return 1
  fi
  return 0
}

# Warn before sudo operations
warn_sudo_install() {
  local package="$1"
  echo ""
  echo "⚠️  Installing '$package' requires administrator privileges (sudo)"
  echo "    This will run package manager commands with elevated permissions"
  echo ""
  read -r -p "Do you want to proceed with sudo installation? [y/N] " consent
  consent="${consent,,}"
  if [[ "$consent" == "y" || "$consent" == "yes" ]]; then
    return 0
  else
    echo "Installation cancelled by user"
    return 1
  fi
}

port_in_use() {
  local p="$1"
  if has_cmd ss; then
    ss -ltn "( sport = :$p )" | awk 'NR>1{print; exit 0} END{exit (NR>1?0:1)}'
  elif has_cmd lsof; then
    lsof -i TCP:"$p" -sTCP:LISTEN -Pn >/dev/null 2>&1
  elif has_cmd netstat; then
    netstat -ltn | awk -v p=":$p" '$4 ~ p{found=1} END{exit (found?0:1)}'
  else
    # best-effort
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
    log "qrencode not found; skipping QR."
  fi
}

open_browser() {
  local url="$1"
  [ "$OPEN_BROWSER" = "1" ] || return 0
  if has_cmd xdg-open; then xdg-open "$url" >/dev/null 2>&1 || true
  elif has_cmd open; then open "$url" >/dev/null 2>&1 || true
  fi
}

set_docker_gid() {
  local gid
  gid="$(getent group docker | cut -d: -f3 || true)"
  gid="${gid:-984}" # common fallback
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

get_host_port_for_watcher() {
  local cname="$1"
  docker ps --format '{{.Names}} {{.Ports}}' \
    | awk -v name="$cname" '$1 == name && $2 ~ /->/ {split($2, arr, ":"); split(arr[2], arr2, "->"); print arr[2]}' \
    | awk -F'->' '{print $1}' \
    | awk -F':' '{print $1}'
}

# ---------- Watcher discovery + files ----------
discover_watchers_and_generate_files() {
  log "Discovering watcher UI containers…"
  # Get all running containers ending in -ui-1
  local ui_containers
  ui_containers=$(docker ps --format '{{.Names}}' | awk '/-ui-1$/')

  if [ -z "$ui_containers" ]; then
    log "No watcher UIs found; not generating config.json."
    echo 0
    return 0
  fi

  local config_file="${PROJECT_ROOT}/config.json"
  log "Generating ${config_file}…"
  {
    echo '['
    local first=1
    for ui_name in $ui_containers; do
      local line ui_port
      line=$(docker ps --format '{{.Names}} {{.Ports}}' | grep "^$ui_name ")
      local regex='([0-9\.]+):([0-9]+)->'
      if [[ $line =~ $regex ]]; then
        ui_port="${BASH_REMATCH[2]}"
        # SECURITY FIX: Validate extracted port
        if ! validate_port "$ui_port"; then
          log "Skipping invalid port for $ui_name"
          continue
        fi
      else
        ui_port="80"
      fi

      local base_name="${ui_name%-ui-1}"
      local service_name="${base_name}-service-1"
      local service_port="3000"
      local service_url="http://${service_name}:${service_port}/info"

      if [ $first -eq 0 ]; then
        echo '    },'
      fi
      first=0
      echo '    {'
      echo "      \"name\": \"${base_name}\","
      echo "      \"ui_name\": \"${ui_name}\","
      echo "      \"ui_port\": ${ui_port},"
      echo "      \"service_name\": \"${service_name}\","
      echo "      \"service_url\": \"${service_url}\","
      echo "      \"network\": \"ergo\""
    done
    echo '    }'
    echo ']'
  } | awk 'BEGIN {print "{\n  \"watchers\": "} {print} END {print "}\n"}' > "$config_file"

  # 2) docker-compose.override.yml – as before
  log "Determining watcher networks…"
  declare -A networks=()
  local net
  for name in $ui_containers; do
    while read -r net; do
      [ -z "$net" ] && continue
      case "$net" in
        bridge|host|none) continue ;;
        *)
          # SECURITY FIX: Validate network name before using
          if validate_network_name "$net"; then
            networks["$net"]=1
          else
            log "Skipping invalid network name: $net"
          fi
          ;;
      esac
    done < <(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$name")
  done

  # Create missing external networks
  log "Ensuring external networks exist…"
  for net in "${!networks[@]}"; do
    # Network name already validated above
    if ! docker network inspect "$net" >/dev/null 2>&1; then
      log "Creating network: $net"
      docker network create "$net" || log "Warning: Could not create network $net"
    fi
  done

  local override_file="${PROJECT_ROOT}/docker-compose.override.yml"
  log "Generating ${override_file}…"
  {
    # No 'version:' header (Compose v2 ignores/complains)
    echo "services:"
    echo "  rosen-monitor:"
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
  echo $(echo "$ui_containers" | wc -w)
}


# ---------- Main ----------
main() {
  set_docker_gid
  maybe_bind_all

  # Run watcher discovery ONCE and get watcher count
  WATCHERS_FOUND=$(discover_watchers_and_generate_files)

  # Port selection and config
  local port count host_ip display_host ip_lan current MONITOR_URL LAN_URL QR_URL
  if [ -f "$ENV_FILE" ] && grep -qE '^HOST_PORT=' "$ENV_FILE" && [ "$FORCE" -ne 1 ]; then
    current="$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
    # SECURITY FIX: Validate port from .env
    if ! validate_port "$current"; then
      log "Invalid port in .env: $current, selecting new port"
      current=""
    fi
    
    if [ -n "$current" ]; then
      host_ip="$(grep -E '^HOST_IP='  "$ENV_FILE" | tail -1 | cut -d= -f2 || echo 127.0.0.1)"
      display_host="$host_ip"; [ "$display_host" = "0.0.0.0" ] && display_host="localhost"
      ip_lan="$(lan_ip_guess || echo 127.0.0.1)"
      MONITOR_URL="http://${display_host}:${current}/"
      LAN_URL=""
      if [ "$ip_lan" != "127.0.0.1" ]; then
        LAN_URL="http://${ip_lan}:${current}/"
      fi
      echo "Monitor URL: $MONITOR_URL"
      [ -n "$LAN_URL" ] && echo "LAN URL:     $LAN_URL"
      QR_URL="$MONITOR_URL"
      [ -n "$LAN_URL" ] && QR_URL="$LAN_URL"
      print_qr "$QR_URL"
      open_browser "$MONITOR_URL"
    fi
  fi
  
  # If current is empty (no valid port in .env or FORCE=1), find a new port
  if [ -z "${current:-}" ]; then
    port="$START_PORT"
    count=0
    if [ "$ALLOW_REUSE_EXISTING" = "1" ] && [ -f "$ENV_FILE" ] && grep -qE '^HOST_PORT=' "$ENV_FILE"; then
      local existing
      existing="$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
      if [ -n "$existing" ] && validate_port "$existing" && ! port_in_use "$existing"; then
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
    host_ip="$(grep -E '^HOST_IP=' "$ENV_FILE" | tail -1 | cut -d= -f2 || echo 127.0.0.1)"
    display_host="$host_ip"; [ "$display_host" = "0.0.0.0" ] && display_host="localhost"
    ip_lan="$(lan_ip_guess || echo 127.0.0.1)"
    MONITOR_URL="http://${display_host}:${port}/"
    LAN_URL=""
    if [ "$ip_lan" != "127.0.0.1" ]; then
      LAN_URL="http://${ip_lan}:${port}/"
    fi
    echo "Monitor URL: $MONITOR_URL"
    [ -n "$LAN_URL" ] && echo "LAN URL:     $LAN_URL"
    QR_URL="$MONITOR_URL"
    [ -n "$LAN_URL" ] && QR_URL="$LAN_URL"
    print_qr "$QR_URL"
    open_browser "$MONITOR_URL"
  fi

    # Interactive prompts if watchers are found
      if [ "$WATCHERS_FOUND" -gt 0 ]; then
        # --- QR code prompt (only if not already shown via SHOW_QR) ---
        if [ "$SHOW_QR" != "1" ]; then
          while true; do
            read -r -p "Would you like to see a QR code for phone access to the monitor at $QR_URL? [y/N] " qr_reply
      qr_reply="${qr_reply,,}"  # to lowercase
      if [[ -z "$qr_reply" || "$qr_reply" == "n" || "$qr_reply" == "no" ]]; then
        break
      elif [[ "$qr_reply" == "y" || "$qr_reply" == "yes" ]]; then
        if ! command -v qrencode >/dev/null 2>&1; then
          # SECURITY FIX: Warn before sudo install
          if warn_sudo_install "qrencode"; then
            if command -v apt-get >/dev/null 2>&1; then
              sudo apt-get update && sudo apt-get install -y qrencode
            elif command -v brew >/dev/null 2>&1; then
              brew install qrencode
            else
              echo "Cannot auto-install 'qrencode' (unknown package manager)."
              break
            fi
          else
            echo "Skipping QR code."
            break
          fi
        fi
        if command -v qrencode >/dev/null 2>&1; then
          echo "Monitor (LAN) URL: $QR_URL"
          echo " "
          qrencode -t ansiutf8 -s 1 -l H "$QR_URL"
          echo "  "
          # --- Copy-to-clipboard prompt ---
          if command -v xclip >/dev/null 2>&1; then
            while true; do
              read -r -p "Would you like to copy the monitor LAN URL to clipboard? [Y/n] " clip_reply
              clip_reply="${clip_reply,,}"
              if [[ -z "$clip_reply" || "$clip_reply" == "n" || "$clip_reply" == "no" ]]; then
                break
              elif [[ "$clip_reply" == "y" || "$clip_reply" == "yes" ]]; then
                echo -n "$QR_URL" | xclip -selection clipboard
                echo "Copied to clipboard!"
                break
              fi
            done
          elif command -v pbcopy >/dev/null 2>&1; then
            while true; do
              read -r -p "Would you like to copy the monitor LAN URL to clipboard? [Y/n] " clip_reply
              clip_reply="${clip_reply,,}"
              if [[ -z "$clip_reply" || "$clip_reply" == "n" || "$clip_reply" == "no" ]]; then
                break
              elif [[ "$clip_reply" == "y" || "$clip_reply" == "yes" ]]; then
                echo -n "$QR_URL" | pbcopy
                echo "Copied to clipboard!"
                break
              fi
            done
          fi
        fi
        break
      fi
    done
    fi  # Close the "if [ "$SHOW_QR" != "1" ]" block

    # --- Monitor run prompt ---
    while true; do
      read -r -p "Would you like to start the monitor now (docker compose up -d --build)? [y/N] " runmon_reply
      runmon_reply="${runmon_reply,,}"
      if [[ -z "$runmon_reply" || "$runmon_reply" == "n" || "$runmon_reply" == "no" ]]; then
        echo "Monitor not started. You can run it later with 'docker compose up -d --build'."
        break
      elif [[ "$runmon_reply" == "y" || "$runmon_reply" == "yes" ]]; then
        if command -v docker-compose >/dev/null 2>&1; then
          docker-compose up -d --build
        else
          docker compose up -d --build
        fi
        echo "Monitor started."
        break
      fi
    done

    # --- Cloudflare sync setup prompt ---
    while true; do
      read -r -p "Would you like to set up encrypted Cloudflare sync? [y/N] " cf_reply
      cf_reply="${cf_reply,,}"
      if [[ "$cf_reply" == "y" || "$cf_reply" == "yes" ]]; then
        ./scripts/register-user.sh
        break
      else
        break
      fi
    done
  fi
}

main "$@"
