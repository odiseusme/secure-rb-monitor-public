#!/usr/bin/env bash
set -Eeuo pipefail

# Load credentials from .env
if [ ! -f .env ]; then
  echo "Error: .env file not found. Run setup-cloudflare.js first."
  exit 1
fi

# Source .env to get BASE_URL, WRITE_TOKEN, DASH_SALT_B64
set -a
source .env
set +a

# Check required variables
[ -z "${BASE_URL:-}" ] && { echo "Error: BASE_URL not set in .env"; exit 1; }
[ -z "${WRITE_TOKEN:-}" ] && { echo "Error: WRITE_TOKEN not set in .env"; exit 1; }
[ -z "${DASH_SALT_B64:-}" ] && { echo "Error: DASH_SALT_B64 not set in .env"; exit 1; }
[ -z "${DASH_PASSPHRASE:-}" ] && { echo "Error: DASH_PASSPHRASE not set"; exit 1; }

# Start cloudflare-sync with environment variables
BASE_URL="$BASE_URL" \
WRITE_TOKEN="$WRITE_TOKEN" \
DASH_PASSPHRASE="$DASH_PASSPHRASE" \
DASH_SALT_B64="$DASH_SALT_B64" \
node cloudflare-sync.js
