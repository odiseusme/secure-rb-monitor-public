#!/usr/bin/env bash
# Rosen Bridge Monitor - Start encrypted sync
set -Eeuo pipefail

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Verify required variables
[ -n "${DASH_PASSPHRASE:-}" ] || { echo "Error: DASH_PASSPHRASE not set"; exit 1; }
[ -n "${BASE_URL:-}" ] || { echo "Error: BASE_URL not set in .env"; exit 1; }
[ -n "${WRITE_TOKEN:-}" ] || { echo "Error: WRITE_TOKEN not set in .env"; exit 1; }
[ -n "${DASH_SALT_B64:-}" ] || { echo "Error: DASH_SALT_B64 not set in .env"; exit 1; }

# Start cloudflare sync
BASE_URL="$BASE_URL" \
WRITE_TOKEN="$WRITE_TOKEN" \
DASH_PASSPHRASE="$DASH_PASSPHRASE" \
DASH_SALT_B64="$DASH_SALT_B64" \
node cloudflare-sync.js
