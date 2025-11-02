#!/usr/bin/env bash
set -euo pipefail

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

# Prompt for passphrase if not in .env
if [ -z "${DASH_PASSPHRASE:-}" ]; then
  echo "🔐 Passphrase required for encryption"
  read -s -p "Enter passphrase: " DASH_PASSPHRASE
  echo ""
  export DASH_PASSPHRASE
fi

node cloudflare-sync.js
