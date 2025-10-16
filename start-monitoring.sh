#!/usr/bin/env bash
# Robust launcher for cloudflare-sync.js
# - Ensures logs directory exists
# - Verifies env + config (non-secret)
# - Starts Node uploader in background and writes ./logs/cloudflare-sync.log
# - Avoids premature exit due to strict shell flags around the Node spawn

set -Eeuo pipefail

# --- paths ---
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
LOG_FILE="${LOG_DIR}/cloudflare-sync.log"
PID_FILE="${LOG_DIR}/cloudflare-sync.pid"
SYNC_JS="${ROOT_DIR}/cloudflare-sync.js"
CFG="${ROOT_DIR}/.cloudflare-config.json"

mkdir -p "${LOG_DIR}"
touch "${LOG_FILE}"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { printf "[%s] %s\n" "$(timestamp)" "$*" | tee -a "${LOG_FILE}"; }

# --- preflight checks (non-secret) ---
if [[ ! -f "${SYNC_JS}" ]]; then
  log "ERROR: Missing ${SYNC_JS}"
  exit 1
fi

if [[ ! -f "${CFG}" ]]; then
  log "ERROR: Missing ${CFG}"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  log "ERROR: jq is required but not installed."
  exit 1
fi

# Require passphrase (do NOT echo it)
if [[ -z "${DASH_PASSPHRASE:-}" ]]; then
  log "ERROR: DASH_PASSPHRASE is not set in this shell."
  log "HINT: export DASH_PASSPHRASE='your-strong-passphrase'"
  exit 1
fi

# Minimal config sanity (do not print secrets)
BASE_URL="$(jq -r '.baseUrl // empty' "${CFG}")"
PUB_ID="$(jq -r '.publicId // empty' "${CFG}")"
HAS_TOKEN="$(jq -r 'has("writeToken")' "${CFG}")"
HAS_SALT="$(jq -r 'has("salt")' "${CFG}")"

if [[ -z "${BASE_URL}" || -z "${PUB_ID}" || "${HAS_TOKEN}" != "true" || "${HAS_SALT}" != "true" ]]; then
  log "ERROR: .cloudflare-config.json missing required fields (baseUrl/publicId/writeToken/salt)."
  exit 1
fi

log "INIT: baseUrl=${BASE_URL} publicId=${PUB_ID}"
log "INIT: logs -> ${LOG_FILE}"

# --- start uploader ---
# Do not let strict flags kill the script on node's exit; always continue logging.
set +e

# Use line-buffering if available so logs appear promptly
if command -v stdbuf >/dev/null 2>&1; then
  stdbuf -oL -eL node "${SYNC_JS}" >> "${LOG_FILE}" 2>&1 &
else
  node "${SYNC_JS}" >> "${LOG_FILE}" 2>&1 &
fi

PID="$!"   # backgrounded node PID

set -e

# Persist PID (non-fatal if fails)
echo "${PID}" > "${PID_FILE}" 2>/dev/null || true

log "STARTED: cloudflare-sync.js (pid=${PID})"
log "TAIL: run 'tail -f ${LOG_FILE}' to follow"

exit 0
