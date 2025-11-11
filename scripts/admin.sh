#!/usr/bin/env bash
#
# RBMonitor Admin CLI - Unified admin tool for Cloudflare Worker
#
# Usage: ./scripts/admin.sh COMMAND [OPTIONS]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

show_help() {
    cat << 'EOF'
RBMonitor Admin CLI - Manage users and invites

USAGE:
    ./scripts/admin.sh COMMAND [OPTIONS]

COMMANDS:
    create-invite          Generate invitation code(s)
    stats                  View user statistics and analytics
    create-user            Create new user account (direct, no invite)
    delete-user            Delete user account and all data
    help                   Show this help

GLOBAL OPTIONS:
    --local                Use local development worker (http://localhost:38472)
    -h, --help             Show this help

SETUP:
    1. Copy .admin.env.example to .admin.env
    2. Edit .admin.env and set your ADMIN_KEY
    3. Run: ./scripts/admin.sh COMMAND

EXAMPLES:
    # Generate 1 invite code (30 days)
    ./scripts/admin.sh create-invite

    # Generate 5 invites with 90 days expiry
    ./scripts/admin.sh create-invite --count 5 --days 90

    # View user statistics
    ./scripts/admin.sh stats

    # View inactive and suspicious users
    ./scripts/admin.sh stats --inactive --suspicious

    # Create user directly (no invite needed)
    ./scripts/admin.sh create-user

    # Delete a user by public ID
    ./scripts/admin.sh delete-user <public-id>

    # Use local development worker
    ./scripts/admin.sh create-invite --local

COMMAND-SPECIFIC HELP:
    ./scripts/admin.sh create-invite --help
    ./scripts/admin.sh stats --help
    ./scripts/admin.sh delete-user --help

EOF
    exit 0
}

# Load admin config
load_config() {
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
    set +u  # Temporarily disable unset variable check
    set -a
    source .admin.env
    set +a
    set -u

    if [[ -z "$ADMIN_KEY" ]] || [[ "$ADMIN_KEY" == "your-admin-key-hash-here" ]]; then
        log_error "ADMIN_KEY not configured in .admin.env"
        exit 1
    fi
}

# Check dependencies
check_deps() {
    local missing=0
    
    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl is required but not installed"
        missing=1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq is required but not installed (apt install jq)"
        missing=1
    fi
    
    if [[ $missing -eq 1 ]]; then
        exit 1
    fi
    
    return 0
}

# Set worker URL based on environment
set_worker_url() {
    local use_local="$1"
    
    if [[ "$use_local" == true ]]; then
        WORKER_URL="http://localhost:38472"
    else
        WORKER_URL="${WORKER_URL:-https://mute-mouse-2cd2.rbmonitor.workers.dev}"
    fi
}

# API call wrapper with error handling
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    
    local curl_opts=(
        -sS --fail-with-body
        --connect-timeout 5 --max-time 20
        -w "\n%{http_code}"
    )
    
    if [[ "$method" == "POST" ]]; then
        curl_opts+=(-X POST)
        [[ -n "$data" ]] && curl_opts+=(-d "$data")
    fi
    
    curl_opts+=(
        -H "x-admin-key: $ADMIN_KEY"
        -H "Content-Type: application/json"
        "$WORKER_URL$endpoint"
    )
    
    curl "${curl_opts[@]}"
}

# Parse response and handle errors
handle_response() {
    local response="$1"
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" != "200" ]]; then
        log_error "Request failed (HTTP $http_code)"
        echo ""
        echo "$body" | jq -r '.' 2>/dev/null || echo "$body"
        echo ""
        
        case "$http_code" in
            401)
                log_warn "Unauthorized: check ADMIN_KEY in .admin.env"
                ;;
            403)
                log_warn "Forbidden: admin key not accepted in this environment"
                ;;
            429)
                log_warn "Rate limited: retry later or lower request rate"
                ;;
            500)
                if echo "$body" | grep -q "KV put"; then
                    log_warn "Cloudflare KV write limit exceeded (1,000/day)"
                    echo "Limit resets at UTC 00:00. Current: $(date -u '+%Y-%m-%d %H:%M UTC')"
                fi
                ;;
        esac
        return 1
    fi
    
    echo "$body"
}

# Validation helper
is_posint() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -gt 0 ]; }

#
# COMMAND: create-invite
#
cmd_create_invite() {
    local show_help=false
    local count=""
    local days=""
    local note=""
    local use_local=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help=true; shift ;;
            --count) count="$2"; shift 2 ;;
            --days) days="$2"; shift 2 ;;
            --note) note="$2"; shift 2 ;;
            --local) use_local=true; shift ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [[ "$show_help" == true ]]; then
        cat << 'EOF'
Create invitation codes for new users

USAGE:
    ./scripts/admin.sh create-invite [OPTIONS]

OPTIONS:
    --count N          Number of invite codes (default: from .admin.env or 1)
    --days N           Expiry days (default: from .admin.env or 30)
    --note TEXT        Optional note about this batch
    --local            Use local development worker
    -h, --help         Show this help

EXAMPLES:
    # Create 1 invite (30 days)
    ./scripts/admin.sh create-invite

    # Create 5 invites with 90 days expiry
    ./scripts/admin.sh create-invite --count 5 --days 90

    # Add a note for tracking
    ./scripts/admin.sh create-invite --note "For team alpha"

EOF
        exit 0
    fi
    
    set_worker_url "$use_local"
    
    # Use config defaults if not overridden
    count="${count:-${INVITE_COUNT:-1}}"
    days="${days:-${INVITE_EXPIRY_DAYS:-30}}"
    
    # Validate
    is_posint "$count" || { log_error "--count must be a positive integer"; exit 1; }
    is_posint "$days" || { log_error "--days must be a positive integer"; exit 1; }
    
    echo ""
    echo -e "${BOLD}Creating Invitation Code(s)${NC}"
    echo "════════════════════════════════════════"
    echo "Worker:  $WORKER_URL"
    echo "Count:   $count"
    echo "Expiry:  $days days"
    [[ -n "$note" ]] && echo "Note:    $note"
    echo ""
    
    # Build JSON payload with proper escaping
    local payload="{\"count\": $count, \"expiresInDays\": $days"
    if [[ -n "$note" ]]; then
        local escaped_note=$(jq -R -n --arg str "$note" '$str')
        payload+=", \"note\": $escaped_note"
    fi
    payload+="}"
    
    log_info "Sending request..."
    local response=$(api_call POST "/api/admin/create-invite" "$payload")
    local body=$(handle_response "$response") || {
        log_error "Failed to create invitations"
        return 1
    }
    
    log_success "Invitation codes created!"
    echo ""
    
    # Save audit log with secure permissions
    local ts="$(date -u +'%Y%m%dT%H%M%SZ')"
    umask 0077
    mkdir -p .admin-logs
    echo "$body" > ".admin-logs/invitations.$ts.json"
    log_info "Audit: .admin-logs/invitations.$ts.json"
    echo ""
    
    # Display invites
    mapfile -t INVITES < <(echo "$body" | jq -r '.invitations[].code' 2>/dev/null)
    local idx=0
    for code in "${INVITES[@]}"; do
        [[ -n "$code" ]] || continue
        idx=$((idx + 1))
        echo "  Invite $idx: $code"
    done
    
    echo ""
    
    # CSV output
    local csv_line="${INVITES[*]}"
    csv_line="${csv_line// /,}"
    echo "CSV: \"$csv_line\""
    echo ""
    
    # Portable date calculation (BSD/macOS vs GNU/Linux)
    local expiry_date
    if date -v+1d >/dev/null 2>&1; then
        # BSD date (macOS)
        expiry_date=$(date -u -v+${days}d "+%Y-%m-%d %H:%M UTC")
    else
        # GNU date (Linux)
        expiry_date=$(date -u -d "+$days days" "+%Y-%m-%d %H:%M UTC")
    fi
    log_info "Expires: $expiry_date"
    echo ""
}

#
# COMMAND: stats
#
cmd_stats() {
    local show_help=false
    local include_inactive=false
    local suspicious_only=false
    local use_local=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help=true; shift ;;
            --inactive) include_inactive=true; shift ;;
            --suspicious) suspicious_only=true; shift ;;
            --local) use_local=true; shift ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [[ "$show_help" == true ]]; then
        cat << 'EOF'
View user analytics and activity statistics

USAGE:
    ./scripts/admin.sh stats [OPTIONS]

OPTIONS:
    --inactive         Include users inactive >30 days
    --suspicious       Show only suspicious users
    --local            Use local development worker
    -h, --help         Show this help

EXAMPLES:
    # View all active users
    ./scripts/admin.sh stats

    # Include inactive users
    ./scripts/admin.sh stats --inactive

    # Show only suspicious activity
    ./scripts/admin.sh stats --suspicious

    # Both inactive and suspicious
    ./scripts/admin.sh stats --inactive --suspicious

EOF
        exit 0
    fi
    
    set_worker_url "$use_local"
    
    local query=""
    [[ "$include_inactive" == true ]] && query="?includeInactive=true"
    [[ "$suspicious_only" == true ]] && {
        [[ -n "$query" ]] && query+="&suspiciousOnly=true" || query="?suspiciousOnly=true"
    }
    
    echo ""
    echo -e "${BOLD}User Statistics${NC}"
    echo "════════════════════════════════════════"
    echo "Worker: $WORKER_URL"
    echo ""
    
    log_info "Fetching statistics..."
    local response=$(api_call GET "/api/admin/stats$query")
    local body=$(handle_response "$response") || exit 1
    
    echo ""
    # TTY-aware colorized output
    if [[ -t 1 ]]; then
        echo "$body" | jq -C '.'
    else
        echo "$body" | jq '.'
    fi
    echo ""
}

#
# COMMAND: create-user
#
cmd_create_user() {
    local show_help=false
    local use_local=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help=true; shift ;;
            --local) use_local=true; shift ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [[ "$show_help" == true ]]; then
        cat << 'EOF'
Create new user account directly (bypasses invite system)

USAGE:
    ./scripts/admin.sh create-user [OPTIONS]

OPTIONS:
    --local            Use local development worker
    -h, --help         Show this help

EXAMPLES:
    # Create user on production worker
    ./scripts/admin.sh create-user

    # Create user on local worker
    ./scripts/admin.sh create-user --local

WARNING:
    This bypasses the invitation system. Use create-invite for normal workflows.

EOF
        exit 0
    fi
    
    set_worker_url "$use_local"
    
    echo ""
    echo -e "${BOLD}Creating User Account${NC}"
    echo "════════════════════════════════════════"
    echo "Worker: $WORKER_URL"
    echo ""
    log_warn "This creates a user directly without an invite code"
    read -p "Continue? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Cancelled"; exit 0; }
    
    log_info "Creating user..."
    local response=$(api_call POST "/api/admin/create-user")
    local body=$(handle_response "$response") || exit 1
    
    log_success "User created!"
    echo ""
    # TTY-aware colorized output
    if [[ -t 1 ]]; then
        echo "$body" | jq -C '.'
    else
        echo "$body" | jq '.'
    fi
    echo ""
}

#
# COMMAND: delete-user
#
cmd_delete_user() {
    local show_help=false
    local public_id=""
    local use_local=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help=true; shift ;;
            --local) use_local=true; shift ;;
            *)
                if [[ -z "$public_id" ]]; then
                    public_id="$1"
                    shift
                else
                    log_error "Unknown option: $1"
                    exit 1
                fi
                ;;
        esac
    done
    
    if [[ "$show_help" == true ]]; then
        cat << 'EOF'
Delete user account and all associated data

USAGE:
    ./scripts/admin.sh delete-user <public-id> [OPTIONS]

OPTIONS:
    --local            Use local development worker
    -h, --help         Show this help

EXAMPLES:
    # Delete user by public ID
    ./scripts/admin.sh delete-user ABC123XYZ789

    # Delete on local worker
    ./scripts/admin.sh delete-user ABC123XYZ789 --local

WARNING:
    This permanently deletes the user and ALL their data. Cannot be undone.

EOF
        exit 0
    fi
    
    if [[ -z "$public_id" ]]; then
        log_error "Missing public ID"
        echo ""
        echo "Usage: ./scripts/admin.sh delete-user <public-id>"
        echo "Run with --help for more information"
        exit 1
    fi
    
    set_worker_url "$use_local"
    
    echo ""
    echo -e "${BOLD}Deleting User Account${NC}"
    echo "════════════════════════════════════════"
    echo "Worker:    $WORKER_URL"
    echo "Public ID: $public_id"
    echo ""
    log_warn "This will permanently delete the user and ALL their data!"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Cancelled"; exit 0; }
    
    log_info "Deleting user..."
    local response=$(api_call POST "/api/admin/delete-user/$public_id")
    local body=$(handle_response "$response") || exit 1
    
    log_success "User deleted"
    echo ""
    # TTY-aware colorized output
    if [[ -t 1 ]]; then
        echo "$body" | jq -C '.'
    else
        echo "$body" | jq '.'
    fi
    echo ""
}

#
# INTERACTIVE MENU
#
show_menu() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo -e "  ${BOLD}RBMonitor Admin Console${NC}"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "What would you like to do?"
    echo ""
    echo "  [1] Create invitation code(s)      (default)"
    echo "  [2] View user statistics"
    echo "  [3] Create user directly (no invite)"
    echo "  [4] Delete user account"
    echo "  [5] Help / Usage information"
    echo "  [Q] Quit"
    echo ""
}

interactive_mode() {
    check_deps
    load_config
    
    while true; do
        show_menu
        read -p "Your choice [1]: " -r choice || { echo ""; echo "Goodbye!"; echo ""; exit 0; }
        choice="${choice:-1}"  # Default to 1
        
        case "$choice" in
            1)
                echo ""
                read -p "Number of invites [1]: " -r count
                count="${count:-1}"
                
                read -p "Expiry days [30]: " -r days
                days="${days:-30}"
                
                read -p "Optional note (press Enter to skip): " -r note
                
                read -p "Use local worker? [y/N]: " -r local_choice
                local use_local=false
                [[ "${local_choice:-}" =~ ^[Yy]$ ]] && use_local=true
                
                local args=(--count "$count" --days "$days")
                [[ -n "${note:-}" ]] && args+=(--note "$note")
                [[ "$use_local" == true ]] && args+=(--local)
                
                cmd_create_invite "${args[@]}" || true
                
                echo ""
                read -p "Press Enter to continue..." -r
                ;;
            2)
                echo ""
                read -p "Include inactive users? [y/N]: " -r inactive
                read -p "Show only suspicious? [y/N]: " -r suspicious
                read -p "Use local worker? [y/N]: " -r local_choice
                
                local args=()
                [[ "${inactive:-}" =~ ^[Yy]$ ]] && args+=(--inactive)
                [[ "${suspicious:-}" =~ ^[Yy]$ ]] && args+=(--suspicious)
                [[ "${local_choice:-}" =~ ^[Yy]$ ]] && args+=(--local)
                
                cmd_stats "${args[@]}"
                
                read -p "Press Enter to continue..." -r
                ;;
            3)
                echo ""
                read -p "Use local worker? [y/N]: " -r local_choice
                
                local args=()
                [[ "${local_choice:-}" =~ ^[Yy]$ ]] && args+=(--local)
                
                cmd_create_user "${args[@]}"
                
                read -p "Press Enter to continue..." -r
                ;;
            4)
                echo ""
                read -p "Enter user public ID: " -r public_id
                
                if [[ -z "${public_id:-}" ]]; then
                    log_error "Public ID required"
                    read -p "Press Enter to continue..." -r
                    continue
                fi
                
                read -p "Use local worker? [y/N]: " -r local_choice
                
                local args=("$public_id")
                [[ "${local_choice:-}" =~ ^[Yy]$ ]] && args+=(--local)
                
                cmd_delete_user "${args[@]}"
                
                read -p "Press Enter to continue..." -r
                ;;
            5)
                show_help
                ;;
            q|Q)
                echo ""
                echo "Goodbye!"
                echo ""
                exit 0
                ;;
            *)
                log_error "Invalid choice: $choice"
                read -p "Press Enter to continue..." dummy
                ;;
        esac
    done
}

#
# MAIN
#
main() {
    # If no arguments, start interactive mode
    if [[ $# -eq 0 ]]; then
        interactive_mode
        exit 0
    fi
    
    local command="$1"
    shift
    
    # Check for help flag in command args before loading config
    for arg in "$@"; do
        if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
            case "$command" in
                create-invite|stats|create-user|delete-user)
                    cmd_${command//-/_} "$@"
                    exit 0
                    ;;
            esac
        fi
    done
    
    case "$command" in
        create-invite)
            check_deps
            load_config
            cmd_create_invite "$@"
            ;;
        stats)
            check_deps
            load_config
            cmd_stats "$@"
            ;;
        create-user)
            check_deps
            load_config
            cmd_create_user "$@"
            ;;
        delete-user)
            check_deps
            load_config
            cmd_delete_user "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            echo "Run './scripts/admin.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
