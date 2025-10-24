#!/usr/bin/env bash
# monitor_control.sh — Cloudflare monitoring controller (Docker-first)
# - Orchestrates local producer (write_status.js) and uploader (cloudflare-sync.js)
# - Commands: start / stop / status / restart
# - If no command is given, shows a tiny interactive menu (S/V/X/R/Q)
# - Auto-detects externally started processes & differently named containers
# - Strict preflights, clear diagnostics, CI-friendly
#
# Assumptions for your environment:
# - Docker is always present and enabled
# - Node/jq/curl are installed on the host
# - .cloudflare-config.json exists in repo root (created by scripts/register-user.sh)
#
# Requirements: bash 4+, jq, curl, node, docker
# Secrets: never printed; uses .cloudflare-config.json (created by register-user.sh)

set -Eeuo pipefail
IFS=$'\n\t'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

RUN_DIR="${RUN_DIR:-.run}"
mkdir -p "$RUN_DIR"

# Producer (Docker) settings
USE_DOCKER="${USE_DOCKER:-1}"    # 1=use docker
CONTAINER_NAME="${CONTAINER_NAME:-rosen-bridge-monitor}"     # your actual container name
WRITE_STATUS_IMAGE="${WRITE_STATUS_IMAGE:-}"                  # optional custom image
WRITE_STATUS_PATH="${WRITE_STATUS_PATH:-write_status.js}"    # repo-relative path to producer

# Uploader (host) settings
UPLOADER_PID_FILE="$RUN_DIR/uploader.pid"

# Worker base URL
BASE_URL="${BASE_URL:-http://localhost:38472}"

# Colors/logging
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
  BLUE="$(tput setaf 4)"; GREEN="$(tput setaf 2)"; YELLOW="$(tput setaf 3)"; RED="$(tput setaf 1)"; NC="$(tput sgr0)"
else
  BLUE=$'\033[0;34m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'
fi
log()  { printf "%b\n" "$*"; }
info() { log "${BLUE}[INFO]${NC} $*"; }
ok()   { log "${GREEN}✅${NC} $*"; }
warn() { log "${YELLOW}[WARN]${NC} $*"; }
err()  { log "${RED}[ERROR]${NC} $*"; }
die()  { err "$*"; exit 1; }
trap 'err "Unexpected error on line $LINENO"; exit 1' ERR

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"; }

# --- Docker helpers (stderr guarded; docker assumed present) ---
docker_available() { [ "$USE_DOCKER" = "1" ] && command -v docker >/dev/null 2>&1; }

container_exists() {
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER_NAME"
}

container_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER_NAME"
}

# Find any container whose command hints at write_status.js
find_producer_container_name() {
  docker ps --format '{{.Names}}\t{{.Command}}' 2>/dev/null \
  | awk '/write_status\.js/ {print $1; found=1} END{ if(!found) exit 1 }'
}

start_container() {
  if ! docker_available; then
    die "Docker unavailable/disabled (USE_DOCKER=$USE_DOCKER) — this environment expects Docker."
  fi

  # Producer file check
  [ -f "$WRITE_STATUS_PATH" ] || die "Producer script not found: $WRITE_STATUS_PATH (at $PROJECT_ROOT)"

  if container_running; then
    info "Producer container already running: $CONTAINER_NAME"
    return 0
  fi

  # Remove any existing stopped container to avoid name conflicts with docker-compose
  if container_exists; then
    info "Removing stopped container: $CONTAINER_NAME"
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

  info "Starting producer container via docker-compose"
  docker compose up -d >/dev/null 2>&1
  
  sleep 2  # Give container time to start
  
  if container_running; then
    ok "Producer up (container: $CONTAINER_NAME)"
  else
    die "Failed to start producer container"
  fi
}

stop_container() {
  if docker_available; then
    if container_exists || container_running; then
      info "Stopping producer container: $CONTAINER_NAME"
      docker compose stop >/dev/null 2>&1
      ok "Producer stopped"
    else
      # try to find an external differently named container
      if CN="$(find_producer_container_name 2>/dev/null)"; then
        info "Stopping external producer container: $CN"
        docker rm -f "$CN" >/dev/null 2>&1 || true
        ok "External producer stopped"
      else
        info "Producer container not present"
      fi
    fi
  else
    die "Docker unavailable/disabled (USE_DOCKER=$USE_DOCKER) — this environment expects Docker."
  fi
}

show_container_status() {
  if docker_available; then
    if container_running; then
      echo "producer: running (container=$CONTAINER_NAME)"
    elif container_exists; then
      echo "producer: stopped (container=$CONTAINER_NAME)"
    else
      if CN="$(find_producer_container_name 2>/dev/null)"; then
        echo "producer: running (container=$CN; external name)"
      else
        # last resort: host process check
        if command -v pgrep >/dev/null 2>&1 && pgrep -f 'node .*write_status\.js' >/dev/null 2>&1; then
          echo "producer: running (host process; external)"
        else
          echo "producer: not present"
        fi
      fi
    fi
  else
    echo "producer: docker unavailable/disabled"
  fi
}

# --- Uploader (host) ---
uploader_running() {
  # 1) PID file
  if [ -f "$UPLOADER_PID_FILE" ]; then
    local pid; pid="$(cat "$UPLOADER_PID_FILE" 2>/dev/null || echo "")"
    [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1 && return 0
  fi
  # 2) Adopt external
  if command -v pgrep >/dev/null 2>&1; then
    local p; p="$(pgrep -f 'node .*cloudflare-sync\.js' | head -n1 || true)"
    if [ -n "$p" ] && kill -0 "$p" >/dev/null 2>&1; then
      echo "$p" > "$UPLOADER_PID_FILE"
      return 0
    fi
  fi
  return 1
}

start_uploader() {
  need_cmd jq; need_cmd node; need_cmd curl

  # Uploader file check
  [ -f "cloudflare-sync.js" ] || die "Uploader script not found: cloudflare-sync.js (at $PROJECT_ROOT)"

  # Health check worker
  local code
  code="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$BASE_URL/health" || true)"
  [ "$code" = "200" ] || die "Worker not responding at $BASE_URL (got HTTP $code). Start wrangler dev first."

  # Config load
  [ -f ".cloudflare-config.json" ] || die ".cloudflare-config.json not found. Run scripts/register-user.sh first."
  local PUBLIC_ID WRITE_TOKEN SALT DASHBOARD_URL
  PUBLIC_ID="$(jq -er '.publicId' .cloudflare-config.json)"
  WRITE_TOKEN="$(jq -er '.writeToken' .cloudflare-config.json)"
  SALT="$(jq -er '.salt' .cloudflare-config.json)"
  DASHBOARD_URL="$(jq -er '.dashboardUrl' .cloudflare-config.json)"

  # Passphrase required
  : "${DASH_PASSPHRASE:?Set DASH_PASSPHRASE in env. It MUST match the dashboard prompt: $DASHBOARD_URL}"

  if uploader_running; then
    local pid; pid="$(cat "$UPLOADER_PID_FILE")"
    info "Uploader already running (pid=$pid)"
    return 0
  fi

  info "Starting uploader (cloudflare-sync.js) — user=$PUBLIC_ID"
  (
    export BASE_URL WRITE_TOKEN DASH_SALT_B64="$SALT" DASH_PASSPHRASE
    nohup node "cloudflare-sync.js" >/dev/null 2>&1 &
    echo $! > "$UPLOADER_PID_FILE"
  ) || die "Failed to start uploader"
  ok "Uploader up (pid=$(cat "$UPLOADER_PID_FILE"))"
}

stop_uploader() {
  if uploader_running; then
    local pid; pid="$(cat "$UPLOADER_PID_FILE")"
    info "Stopping uploader (pid=$pid)"
    kill "$pid" >/dev/null 2>&1 || true
    graceful=""
    for i in 1 2 3 4 5; do
      kill -0 "$pid" >/dev/null 2>&1 || { ok "Uploader exited gracefully"; graceful=1; break; }
      sleep 0.2
    done
    if [ -z "${graceful:-}" ]; then
      warn "Uploader did not exit gracefully; sending SIGKILL"
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$UPLOADER_PID_FILE"
    ok "Uploader stopped"
  else
    # External visibility
    if command -v pgrep >/dev/null 2>&1 && pgrep -f 'node .*cloudflare-sync\.js' >/dev/null 2>&1; then
      warn "Uploader running externally (not managed by controller)"
    else
      info "Uploader not running"
    fi
  fi
}

usage() {
  cat <<USAGE
Usage: $0 {start|stop|status|restart} [--no-docker] [--no-sync]

Commands:
  start     Start producer (Docker) and uploader (host)
  stop      Stop both (adopts external processes where possible)
  status    Show producer/uploader state (auto-detect external)
  restart   stop + start

Flags:
  --no-docker  Skip Docker producer (only uploader)
  --no-sync    Skip uploader (only producer)

Env:
  BASE_URL           (default: $BASE_URL)
  USE_DOCKER=0/1     (default: $USE_DOCKER)
  WRITE_STATUS_PATH  (default: $WRITE_STATUS_PATH)
  WRITE_STATUS_IMAGE (default: empty → node:20-alpine with bind mount)
  DASH_PASSPHRASE    (required for start when uploader is enabled)
USAGE
}

# --- parse args (or interactive if none) ---
CMD="${1:-}"; shift || true
DO_PRODUCER=1
DO_UPLOADER=1
while [ $# -gt 0 ]; do
  case "$1" in
    --no-docker) DO_PRODUCER=0;;
    --no-sync)   DO_UPLOADER=0;;
    -h|--help)   usage; exit 0;;
    *) die "Unknown argument: $1";;
  esac
  shift
done

if [ -z "${CMD:-}" ]; then
  echo
  echo "🛰️  Cloudflare Monitor — What would you like to do?"
  echo "   [S]tatus   [V] Start   [X] Stop   [R] Restart   [Q] Quit"
  read -r -p "   Choice: " choice
  case "$choice" in
    s|S) CMD="status" ;;
    v|V) CMD="start" ;;
    x|X) CMD="stop" ;;
    r|R) CMD="restart" ;;
    q|Q|"") exit 0 ;;
    *) echo "Unknown choice"; exit 1 ;;
  esac
fi

# --- commands ---
case "$CMD" in
  start)
    [ "$DO_PRODUCER" = "1" ] && start_container
    [ "$DO_UPLOADER" = "1" ] && start_uploader
    ok "Start complete."
    ;;
  stop)
    stop_uploader
    stop_container
    ok "Stop complete."
    ;;
  status)
    echo
    echo "🛰️  Cloudflare Monitor — Status"
    echo "   🌐  Base URL: ${BLUE}${BASE_URL}${NC}"
    PROD_LINE="$(show_container_status)"
    case "$PROD_LINE" in
      *"running"*)  echo "   🐳  Producer: ${GREEN}running${NC} ${PROD_LINE#producer: running }" ;;
      *"stopped"*)  echo "   💤  Producer: ${YELLOW}stopped${NC} ${PROD_LINE#producer: stopped }" ;;
      *"not present"*)
        echo "   ⛔  Producer: ${RED}not present${NC}";;
      *"docker unavailable"*)
        echo "   🚫  Producer: docker unavailable/disabled";;
      *)  echo "   🐳  Producer: ${PROD_LINE#producer: }";;
    esac
    if uploader_running; then
      UPL_PID="$(cat "$UPLOADER_PID_FILE")"
      echo "   ⬆️  Uploader: ${GREEN}running${NC} (pid=${UPL_PID})"
    else
      if command -v pgrep >/dev/null 2>&1 && pgrep -f 'node .*cloudflare-sync\.js' >/dev/null 2>&1; then
        echo "   ⬆️  Uploader: ${GREEN}running${NC} (external; not managed by controller)"
      else
        echo "   ⚠️  Uploader: ${YELLOW}stopped${NC}"
      fi
    fi
    echo
    ;;
  restart)
    NO_PROD_FLAG=""
    NO_SYNC_FLAG=""
    [ "${DO_PRODUCER:-1}" = "0" ] && NO_PROD_FLAG="--no-docker"
    [ "${DO_UPLOADER:-1}" = "0" ] && NO_SYNC_FLAG="--no-sync"
    "$0" stop $NO_PROD_FLAG $NO_SYNC_FLAG
    "$0" start $NO_PROD_FLAG $NO_SYNC_FLAG
    ;;
  ""|-h|--help)
    usage
    ;;
  *)
    die "Unknown command: $CMD (use --help)"
    ;;
esac
