#!/usr/bin/env bash

# Load environment from .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Check required variables
[ -z "${BASE_URL:-}" ] && { echo "Error: BASE_URL not set in .env"; exit 1; }
[ -z "${WRITE_TOKEN:-}" ] && { echo "Error: WRITE_TOKEN not set in .env"; exit 1; }
[ -z "${DASH_SALT_B64:-}" ] && { echo "Error: DASH_SALT_B64 not set in .env"; exit 1; }
[ -z "${DASH_PASSPHRASE:-}" ] && { echo "Error: DASH_PASSPHRASE not set in .env"; exit 1; }

node cloudflare-sync.js
