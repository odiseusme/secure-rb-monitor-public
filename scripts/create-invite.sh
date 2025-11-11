#!/usr/bin/env bash
#
# Create Cloudflare Worker Invite Codes (Admin Only)
#
# Usage: ./scripts/create-invite.sh [OPTIONS]
#
# Options:
#   --count N          Number of invites to create (default: from .admin.env or 1)
#   --days N           Expiry days (default: from .admin.env or 30)
#   --local            Use local worker (http://localhost:38472)
#   -h, --help         Show this help
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

show_help() {
    cat << EOF
Create Cloudflare Worker Invite Codes (Admin Only)

USAGE:
    ./scripts/create-invite.sh [OPTIONS]

OPTIONS:
    --count N          Number of invites to create (default: from .admin.env or 1)
    --days N           Expiry days (default: from .admin.env or 30)
    --local            Use local development worker (http://localhost:38472)
    -h, --help         Show this help

SETUP:
    1. Copy .admin.env.example to .admin.env
    2. Edit .admin.env and set your ADMIN_KEY
    3. Run this script

EXAMPLES:
    # Create 1 invite (30 days expiry)
    ./scripts/create-invite.sh

    # Create 5 invites with 90 days expiry
    ./scripts/create-invite.sh --count 5 --days 90

    # Create invite for local development
    ./scripts/create-invite.sh --local

EOF
    exit 0
}

# Parse arguments
USE_LOCAL=false
INVITE_COUNT=""
INVITE_EXPIRY_DAYS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        --count)
            INVITE_COUNT="$2"
            shift 2
            ;;
        --days)
            INVITE_EXPIRY_DAYS="$2"
            shift 2
            ;;
        --local)
            USE_LOCAL=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Run with --help for usage information"
            exit 1
            ;;
    esac
done

# Load admin config
if [[ ! -f ".admin.env" ]]; then
    log_error "Missing .admin.env file"
    echo ""
    echo "Setup required:"
    echo "  1. cp .admin.env.example .admin.env"
    echo "  2. Edit .admin.env and set your ADMIN_KEY"
    echo ""
    exit 1
fi

# Source the config file
set -a
source .admin.env
set +a

# Validate required config
if [[ -z "$ADMIN_KEY" ]] || [[ "$ADMIN_KEY" == "your-admin-key-hash-here" ]]; then
    log_error "ADMIN_KEY not configured in .admin.env"
    echo ""
    echo "Edit .admin.env and set your actual admin key hash"
    exit 1
fi

# Set defaults from config or fallback
INVITE_COUNT="${INVITE_COUNT:-${INVITE_COUNT:-1}}"
INVITE_EXPIRY_DAYS="${INVITE_EXPIRY_DAYS:-${INVITE_EXPIRY_DAYS:-30}}"

# Determine worker URL
if [[ "$USE_LOCAL" == true ]]; then
    WORKER_URL="http://localhost:38472"
    log_info "Using local worker: $WORKER_URL"
else
    WORKER_URL="${WORKER_URL:-https://mute-mouse-2cd2.rbmonitor.workers.dev}"
    log_info "Using production worker: $WORKER_URL"
fi

# Check dependencies
if ! command -v curl >/dev/null 2>&1; then
    log_error "curl is required but not installed"
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    log_error "jq is required but not installed"
    echo "Install with: sudo apt-get install jq"
    exit 1
fi

# Display configuration
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Creating Invite Codes"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Worker URL:    $WORKER_URL"
echo "Invite Count:  $INVITE_COUNT"
echo "Expiry Days:   $INVITE_EXPIRY_DAYS"
echo ""

# Create invite
log_info "Sending request to worker..."

response=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/api/admin/create-invite" \
    -H "x-admin-key: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"count\": $INVITE_COUNT, \"expiresInDays\": $INVITE_EXPIRY_DAYS}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" != "200" ]]; then
    log_error "Request failed (HTTP $http_code)"
    echo ""
    echo "Response:"
    echo "$body" | jq -r '.' 2>/dev/null || echo "$body"
    echo ""
    
    if [[ "$http_code" == "401" ]]; then
        log_warn "Check your ADMIN_KEY in .admin.env"
    elif [[ "$http_code" == "500" ]] && echo "$body" | grep -q "KV put"; then
        log_warn "Cloudflare KV write limit exceeded"
        echo "The worker has hit the daily write limit (1,000 writes/day)"
        echo "Limit resets at UTC 00:00"
        echo ""
        echo "Current UTC time: $(date -u)"
    fi
    exit 1
fi

# Parse and display invites
echo ""
log_success "Invite codes created successfully!"
echo ""

invites=$(echo "$body" | jq -r '.invites[]')
count=0

while IFS= read -r invite; do
    if [[ -n "$invite" ]]; then
        count=$((count + 1))
        echo "  Invite $count: $invite"
    fi
done <<< "$invites"

echo ""
log_info "Share these codes with users to register"
echo ""

# Show expiry info
expiry_date=$(date -u -d "+$INVITE_EXPIRY_DAYS days" "+%Y-%m-%d %H:%M UTC")
log_info "Expires: $expiry_date"
echo ""
