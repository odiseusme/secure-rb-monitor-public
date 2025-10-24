#!/usr/bin/env bash
set -Eeuo pipefail

# Load credentials from .env
if [ ! -f .env ]; then
  echo "Error: .env file not found"
  exit 1
fi

set -a
source .env
set +a

# Check required variables
[ -z "${BASE_URL:-}" ] && { echo "Error: BASE_URL not set in .env"; exit 1; }
[ -z "${WRITE_TOKEN:-}" ] && { echo "Error: WRITE_TOKEN not set in .env"; exit 1; }
[ -z "${DASH_SALT_B64:-}" ] && { echo "Error: DASH_SALT_B64 not set in .env"; exit 1; }
[ -z "${DASH_PASSPHRASE:-}" ] && { echo "Error: DASH_PASSPHRASE not set in .env"; exit 1; }

node cloudflare-sync.js
