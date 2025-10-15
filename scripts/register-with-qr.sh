#!/usr/bin/env bash
set -Eeuo pipefail

# Usage:
#   BASE_URL="https://<your-worker>.workers.dev" ./scripts/register-with-qr.sh --invite INVITE-XXXX
# Optional:
#   DASH_PASSPHRASE='your-strong-pass' BASE_URL=... ./scripts/register-with-qr.sh --invite INVITE-XXXX --qr-with-pass
#
# Notes:
# - If --qr-with-pass is set AND DASH_PASSPHRASE is provided, the QR embeds the passphrase in the URL fragment (#p=...).
#   Fragments are not sent to the server, but anyone who scans the QR can read it. Treat that PNG as sensitive.

INVITE=""
QR_WITH_PASS=0

# --- parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --invite)        INVITE="${2:-}"; shift 2 ;;
    --qr-with-pass)  QR_WITH_PASS=1;  shift  ;;
    *) echo "[ERROR] Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${INVITE}" ]]; then
  echo "[ERROR] Missing --invite INVITE-CODE" >&2; exit 1
fi

: "${BASE_URL:?Set BASE_URL to your worker/dev URL (e.g., https://your-worker.workers.dev)}"

# --- run existing registrar and capture output ---
OUTFILE="$(mktemp)"
if ! ./scripts/register-user.sh --invite "${INVITE}" | tee "${OUTFILE}"; then
  echo "[ERROR] Registration failed" >&2
  exit 3
fi

# --- extract the dashboard URL ---
DASH_URL="$(grep -Eo 'https?://[^[:space:]]+/d/[A-Za-z0-9]+' "${OUTFILE}" | tail -n1 || true)"
if [[ -z "${DASH_URL}" ]]; then
  echo "[ERROR] Could not find Dashboard URL in output" >&2
  exit 4
fi

echo "[INFO] Dashboard URL: ${DASH_URL}"

QR_TEXT="${DASH_URL}"

# Optional: include passphrase in fragment
if [[ "${QR_WITH_PASS}" -eq 1 ]]; then
  if [[ -z "${DASH_PASSPHRASE:-}" ]]; then
    echo "[WARN] --qr-with-pass set but DASH_PASSPHRASE is empty; using URL-only QR." >&2
  else
    ENCPASS="$(python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.quote(os.environ["DASH_PASSPHRASE"]))
PY
)"
    QR_TEXT="${DASH_URL}#p=${ENCPASS}"
    echo "[WARN] QR includes passphrase in #fragment. Treat the PNG as sensitive."
  fi
fi

# Filename based on user id
USER_ID="$(echo "${DASH_URL}" | sed -E 's#.*/d/([A-Za-z0-9]+).*#\1#')"
OUTPNG="dashboard-${USER_ID}.png"

# Generate QR (PNG + terminal)
if ! command -v qrencode >/dev/null 2>&1; then
  echo "[ERROR] qrencode not installed. Try: sudo apt-get install -y qrencode" >&2
  exit 5
fi

qrencode -o "${OUTPNG}" "${QR_TEXT}"
echo "[INFO] QR written to: ${OUTPNG}"
echo "[INFO] QR (terminal view):"
qrencode -t ansiutf8 "${QR_TEXT}"

echo
echo "=== SUMMARY ==="
echo "URL: ${DASH_URL}"
if [[ "${QR_WITH_PASS}" -eq 1 && -n "${DASH_PASSPHRASE:-}" ]]; then
  echo "Passphrase embedded in fragment (local-only): yes"
else
  echo "Passphrase embedded in fragment: no (safer default)"
fi
echo "PNG: ${OUTPNG}"
