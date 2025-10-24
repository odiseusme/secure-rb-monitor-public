#!/usr/bin/env bash
# register-user.sh — minimal user registration helper
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
  RED="$(tput setaf 1)"; GREEN="$(tput setaf 2)"; CYAN="$(tput setaf 6)"; YELLOW="$(tput setaf 3)"; NC="$(tput sgr0)"
else
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; CYAN=$'\033[0;36m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
fi
die() { echo "${RED}✗${NC} $*" >&2; exit 1; }

# Config
DEFAULT_BASE_URL="http://localhost:38472"
BASE_URL="${BASE_URL:-$DEFAULT_BASE_URL}"
CONFIG_FILE="${CONFIG_FILE:-.cloudflare-config.json}"
INVITE_CODE="${INVITE_CODE:-}"

# Parse args
while [ $# -gt 0 ]; do
  case "$1" in
    --invite) shift; INVITE_CODE="${1:-}"; [ -n "$INVITE_CODE" ] || die "--invite requires a code" ;;
    --base-url) shift; BASE_URL="${1:-}"; [ -n "$BASE_URL" ] || die "--base-url requires a value" ;;
    -h|--help)
      cat <<USAGE
Usage: $0 --invite CODE [--base-url URL]
Example: $0 --invite INVITE-ABC-XYZ
USAGE
      exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
  shift
done

# Check dependencies
for cmd in curl jq node; do
  command -v "$cmd" >/dev/null 2>&1 || die "Required: $cmd"
done

# Health check
HTTP_STATUS="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$BASE_URL/health" 2>/dev/null || true)"
[ "$HTTP_STATUS" = "200" ] || die "Worker not running at $BASE_URL"

# Get invitation code
if [ -z "$INVITE_CODE" ]; then
  read -r -p "Invitation code: " INVITE_CODE
  [ -n "$INVITE_CODE" ] || die "Invitation code required"
fi

# Prompt for passphrase
echo ""
echo "${CYAN}Choose a passphrase for dashboard access${NC}"
echo "This will be used to decrypt your monitoring data"
read -r -s -p "Passphrase (min 8 chars): " PASSPHRASE
echo ""
[ ${#PASSPHRASE} -ge 8 ] || die "Passphrase must be at least 8 characters"

read -r -s -p "Confirm passphrase: " PASSPHRASE_CONFIRM
echo ""
[ "$PASSPHRASE" = "$PASSPHRASE_CONFIRM" ] || die "Passphrases do not match"

# Backup existing config
if [ -f "$CONFIG_FILE" ]; then
  mv "$CONFIG_FILE" "${CONFIG_FILE}.bak.$(date -u +%Y%m%dT%H%M%SZ)" 2>/dev/null || true
fi

# Register
[ -f "setup-cloudflare.js" ] || die "setup-cloudflare.js not found"

# Create a temporary input file
TEMP_INPUT=$(mktemp)
echo "$INVITE_CODE" > "$TEMP_INPUT"

# Run with input redirection and suppress output
BASE_URL="$BASE_URL" node setup-cloudflare.js < "$TEMP_INPUT" > /dev/null 2>&1
EXIT_CODE=$?

# Cleanup
rm -f "$TEMP_INPUT"
[ $EXIT_CODE -eq 0 ] || die "Registration failed"
[ -f "$CONFIG_FILE" ] || die "Registration failed - config not created"

# Extract credentials
PUBLIC_ID="$(jq -er '.publicId' "$CONFIG_FILE")"
WRITE_TOKEN="$(jq -er '.writeToken' "$CONFIG_FILE")"
SALT="$(jq -er '.salt' "$CONFIG_FILE")"
DASHBOARD_URL="$(jq -er '.dashboardUrl' "$CONFIG_FILE")"

# Update .env file with credentials
if [ -f ".env" ]; then
  # Remove existing Cloudflare lines if present
  sed -i '/^# Cloudflare Worker Configuration/,/^DASH_SALT_B64=/d' .env
  sed -i '/^DASH_PASSPHRASE=/d' .env
fi

# Append new configuration
cat >> .env <<ENV_EOF

# Cloudflare Worker Configuration (auto-updated by register-user.sh)
# Updated on: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# These values are specific to YOUR registration - do not share!
BASE_URL=$BASE_URL
WRITE_TOKEN=$WRITE_TOKEN
DASH_SALT_B64=$SALT
DASH_PASSPHRASE=$PASSPHRASE
ENV_EOF

# Generate start script
cat > "start-monitoring.sh" <<SCRIPT_EOF
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
[ -z "\${BASE_URL:-}" ] && { echo "Error: BASE_URL not set in .env"; exit 1; }
[ -z "\${WRITE_TOKEN:-}" ] && { echo "Error: WRITE_TOKEN not set in .env"; exit 1; }
[ -z "\${DASH_SALT_B64:-}" ] && { echo "Error: DASH_SALT_B64 not set in .env"; exit 1; }
[ -z "\${DASH_PASSPHRASE:-}" ] && { echo "Error: DASH_PASSPHRASE not set in .env"; exit 1; }

node cloudflare-sync.js
SCRIPT_EOF
chmod +x "start-monitoring.sh"

# Output
echo ""
echo "${GREEN}✓${NC} Registered: $PUBLIC_ID"
echo "${GREEN}✓${NC} Credentials saved to .env"
echo "${GREEN}✓${NC} Created: start-monitoring.sh"
echo ""
echo "${YELLOW}IMPORTANT:${NC} Your passphrase has been saved to .env"
echo "Keep this file secure and do not commit it to version control!"
echo ""
echo "Dashboard: ${CYAN}$DASHBOARD_URL${NC}"
echo ""
echo "To start monitoring: ${CYAN}./scripts/monitor_control.sh start${NC}"
