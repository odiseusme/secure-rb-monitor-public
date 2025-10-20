#!/usr/bin/env bash
set -euo pipefail

# register-with-qr.sh
# Registers a user (via ./scripts/register-user.sh), prints the dashboard URL,
# and generates a QR code. Optionally embeds the passphrase in the URL fragment.
#
# Requirements:
#   - ./scripts/register-user.sh            (this script calls it)
#   - qrencode, jq                          (installed)
#   - BASE_URL env var or --base-url arg    (target Worker)
#
# Usage examples:
#   BASE_URL="https://<your-worker>.workers.dev" ./scripts/register-with-qr.sh --invite INVITE-XXXX
#   ./scripts/register-with-qr.sh --invite INVITE-XXXX --base-url https://<your-worker>.workers.dev
#   ./scripts/register-with-qr.sh --invite INVITE-XXXX --embed-passphrase
#   ./scripts/register-with-qr.sh --invite INVITE-XXXX --embed-passphrase --passphrase 'My Strong Pass'
#   ./scripts/register-with-qr.sh --invite INVITE-XXXX --fragment-key pass --qr-out my-dash.png
#
# Notes:
#   - By default, the passphrase is NOT embedded (safer).
#   - If you pass --embed-passphrase with no --passphrase, you will be securely prompted.
#   - The passphrase (if embedded) is placed in the URL fragment (#p=...), which is not sent to the server,
#     but anyone scanning the QR can read it. Treat that PNG/URL as sensitive.
#
# Exit codes:
#   0  success
#   2  usage / bad args
#   3  dependency missing
#   4  helper script missing
#   5  registration failed
#   6  cannot detect dashboard URL from helper output

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") --invite INVITE-XXXX [options]

Required:
  --invite CODE             Registration invite code (e.g., INVITE-ABCDEF-123456)

Optional:
  --embed-passphrase        Embed passphrase in URL fragment (#p=...)
  --passphrase VALUE        Passphrase to embed (only used if --embed-passphrase is set)
  --fragment-key KEY        Fragment key name (default: p), e.g., "#KEY=..."
  --base-url URL            Override target Worker base URL (else uses \$BASE_URL)
  --qr-out FILE.png         Output PNG path (default: dashboard-<publicId>.png)
  -h | --help               Show this help
USAGE
}

# ---- Helper function to strip ANSI color codes ----
strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g'
}

# ---- parse args ----
INVITE=""
EMBED_PASSPHRASE="no"
PASSPHRASE=""
FRAG_KEY="p"
BASE_URL_OVERRIDE=""
QR_OUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --invite)           INVITE="${2:-}"; shift 2;;
    --embed-passphrase) EMBED_PASSPHRASE="yes"; shift;;
    --passphrase)       PASSPHRASE="${2:-}"; shift 2;;
    --fragment-key)     FRAG_KEY="${2:-p}"; shift 2;;
    --base-url)         BASE_URL_OVERRIDE="${2:-}"; shift 2;;
    --qr-out)           QR_OUT_FILE="${2:-}"; shift 2;;
    -h|--help)          usage; exit 0;;
    *) echo "[ERROR] Unknown arg: $1" >&2; usage; exit 2;;
  esac
done

if [[ -z "$INVITE" ]]; then
  echo "[ERROR] Missing --invite INVITE-CODE" >&2
  usage
  exit 2
fi

BASE_URL="${BASE_URL_OVERRIDE:-${BASE_URL:-}}"
if [[ -z "${BASE_URL}" ]]; then
  echo "[ERROR] BASE_URL is not set and --base-url was not provided." >&2
  exit 2
fi

# ---- deps & helper ----
if ! command -v qrencode >/dev/null 2>&1; then
  echo "[ERROR] qrencode not found. Install: sudo apt-get install -y qrencode" >&2
  exit 3
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq not found. Install: sudo apt-get install -y jq" >&2
  exit 3
fi

REGISTER_HELPER="./scripts/register-user.sh"
if [[ ! -x "$REGISTER_HELPER" ]]; then
  echo "[ERROR] Missing or non-executable: $REGISTER_HELPER" >&2
  exit 4
fi

echo "[INFO] Targeting: ${BASE_URL}"
echo "[INFO] Using invite: ${INVITE}"

# ---- run registrar and capture output ----
set +e
REG_OUT="$("$REGISTER_HELPER" --invite "$INVITE" 2>&1)"
REG_RC=$?
set -e
printf '%s\n' "$REG_OUT"
if [[ $REG_RC -ne 0 ]]; then
  echo "[ERROR] Registration helper failed (exit $REG_RC)" >&2
  exit 5
fi

# ---- extract dashboard URL (strip ANSI codes first) ----
CLEAN_OUT="$(printf '%s\n' "$REG_OUT" | strip_ansi)"

DASH_URL="$(printf '%s\n' "$CLEAN_OUT" | awk '/^Dashboard: /{print $2}' | tail -n1)"
if [[ -z "$DASH_URL" ]]; then
  DASH_URL="$(printf '%s\n' "$CLEAN_OUT" | grep -Eo 'https?://[^ ]+/d/[A-Za-z0-9]+' | tail -n1)"
fi
if [[ -z "$DASH_URL" ]]; then
  echo "[ERROR] Could not detect dashboard URL from register-user output." >&2
  exit 6
fi
echo "[INFO] Dashboard URL: ${DASH_URL}"

# ---- publicId for filenames ----
PUBLIC_ID="$(printf '%s\n' "$DASH_URL" | sed -n 's|.*/d/\([A-Za-z0-9]\{16,\}\).*|\1|p')"
[[ -z "$PUBLIC_ID" ]] && PUBLIC_ID="unknown"

FINAL_URL="$DASH_URL"
EMBED_NOTE="no (safer default)"

if [[ "$EMBED_PASSPHRASE" == "yes" ]]; then
  # ensure passphrase
  if [[ -z "$PASSPHRASE" ]]; then
    read -rsp "Enter passphrase to EMBED in QR/URL (hidden): " PASSPHRASE; echo
    read -rsp "Re-enter passphrase: " PASSPHRASE2; echo
    if [[ "$PASSPHRASE" != "$PASSPHRASE2" ]]; then
      echo "[ERROR] Passphrases do not match." >&2
      exit 2
    fi
  fi
  # URL-encode via jq
  P_ENC="$(printf '%s' "$PASSPHRASE" | jq -sRr @uri)"
  FINAL_URL="${DASH_URL}#${FRAG_KEY}=${P_ENC}"
  EMBED_NOTE="YES – fragment key: #${FRAG_KEY}"
fi

# ---- QR output path ----
if [[ -z "$QR_OUT_FILE" ]]; then
  QR_OUT_FILE="dashboard-${PUBLIC_ID}.png"
fi

# ---- generate QR ----
qrencode -o "$QR_OUT_FILE" "$FINAL_URL"
echo "[INFO] QR written to: $QR_OUT_FILE"
echo "[INFO] QR (terminal view):"
qrencode -t ansiutf8 "$FINAL_URL"

cat <<SUMMARY

=== SUMMARY ===
URL: $DASH_URL
Passphrase embedded in fragment: $EMBED_NOTE
QR PNG: $QR_OUT_FILE
$( [[ "$EMBED_PASSPHRASE" == "yes" ]] && echo "⚠️  Security: This QR contains your passphrase in the fragment. Share with care." )
SUMMARY

# start-uploader hint (no secrets)
echo "Start uploader:"
echo "  DASH_PASSPHRASE='(your-passphrase)' ./start-monitoring.sh"
