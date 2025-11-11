#!/usr/bin/env bash
# admin.sh — RBMonitor Admin Console
# Default: use Cloudflare production worker unless user explicitly selects local.
# Shows clear success/failure after DELETE (no silent return).

set -euo pipefail
IFS=$'\n\t'

# ── Pretty logging ─────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD="$(tput bold)"; RESET="$(tput sgr0)"
  GREEN="$(tput setaf 2)"; RED="$(tput setaf 1)"; YELLOW="$(tput setaf 3)"; CYAN="$(tput setaf 6)"
else
  BOLD=""; RESET=""; GREEN=""; RED=""; YELLOW=""; CYAN=""
fi
log_info()    { echo -e "${CYAN}ℹ${RESET} $*"; }
log_warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
log_error()   { echo -e "${RED}✗${RESET} $*" >&2; }
log_success() { echo -e "${GREEN}✓${RESET} $*"; }
press_enter() { read -r -p "Press Enter to continue..."; }

# ── Env & deps ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
[[ -f "$REPO_ROOT/.admin.env" ]] && source "$REPO_ROOT/.admin.env"

: "${LOCAL_WORKER_URL:=http://localhost:38472}"
: "${PROD_WORKER_URL:=${WORKER_URL:-}}"

require_bin() { command -v "$1" >/dev/null 2>&1 || { log_error "Missing dependency: $1"; exit 1; }; }
require_bin curl
require_bin jq

[[ -n "${ADMIN_KEY:-}" ]] || { log_error "ADMIN_KEY not set. Create $REPO_ROOT/.admin.env with: ADMIN_KEY=your-production-admin-key"; exit 1; }
mkdir -p "$REPO_ROOT/.admin-logs"

# ── Worker selection (default = Cloudflare) ───────────────────────────────
choose_worker() {
  echo -n "Use Cloudflare worker? [Y/n]: "
  read -r use_cloud
  if [[ "$use_cloud" =~ ^[nN]$ ]]; then
    WORKER_URL="$LOCAL_WORKER_URL"
  else
    [[ -n "$PROD_WORKER_URL" ]] || { log_error "PROD_WORKER_URL not set. Add to .admin.env or export WORKER_URL."; exit 1; }
    WORKER_URL="$PROD_WORKER_URL"
  fi
}

# ── HTTP helper ────────────────────────────────────────────
# api_call METHOD PATH [JSON_BODY]
# returns: body\nHTTP_CODE (we parse later)
api_call() {
  local method="$1" path="$2" body="${3-}"
  local url="${WORKER_URL%/}${path}"
  local curl_opts=(
    -sS
    --connect-timeout 5 --max-time 20
    -w "\n%{http_code}"
    -H "x-admin-key: $ADMIN_KEY"
  )
  [[ -n "$body" ]] && curl_opts+=(-H "Content-Type: application/json" -d "$body")
  curl "${curl_opts[@]}" -X "$method" "$url"
}

# ── Generic response pretty-printer (for non-delete ops) ──
handle_response() {
  local response="$1"
  local http_code body
  http_code="$(echo "$response" | tail -n1)"
  body="$(echo "$response" | sed '$d')"

  if [[ "$http_code" != "200" && "$http_code" != "204" ]]; then
    # Keep generic printer for non-delete actions
    log_error "Request failed (HTTP $http_code)"
    echo "$body" | jq -r '.' 2>/dev/null || echo "$body"
    echo ""
    return 1
  fi
  echo "$body"
  return 0
}

# ── Actions ────────────────────────────────────────────────
action_create_invite() {
  echo ""
  echo "Create invitation code(s)"
  echo "══════════════════════════"
  echo -n "Number of invites [1]: "; read -r INVITE_COUNT; INVITE_COUNT="${INVITE_COUNT:-1}"
  echo -n "Expires in days [30]: "; read -r INVITE_DAYS;  INVITE_DAYS="${INVITE_DAYS:-30}"
  [[ "$INVITE_COUNT" =~ ^[0-9]+$ && "$INVITE_COUNT" -gt 0 ]] || { log_error "--count must be positive"; return 1; }
  [[ "$INVITE_DAYS"  =~ ^[0-9]+$ && "$INVITE_DAYS"  -gt 0 ]] || { log_error "--days must be positive"; return 1; }

  choose_worker
  log_info "Creating $INVITE_COUNT invite(s)…"
  local payload response body ts
  payload="$(jq -n --argjson c "$INVITE_COUNT" --argjson d "$INVITE_DAYS" '{count:$c, expiresInDays:$d}')"
  response="$(api_call POST "/api/admin/create-invite" "$payload")"
  if ! body="$(handle_response "$response")"; then return 1; fi

  log_success "Invite codes created!"
  ts="$(date -u +'%Y%m%dT%H%M%SZ')"
  echo "$body" > "$REPO_ROOT/.admin-logs/invitations.$ts.json"
  mapfile -t INVITES < <(echo "$body" | jq -r '.invitations[].code // empty')
  if ((${#INVITES[@]})); then
    i=0; for code in "${INVITES[@]}"; do ((i++)); echo "  Invite $i: $code"; done
    echo ""; echo "CSV: \"${INVITES[*]}\""; echo ""
  else
    log_warn "No codes found in response."
  fi
}

action_view_stats() {
  echo ""
  echo "View user statistics"
  echo "════════════════════"
  choose_worker
  log_info "Fetching stats from: $WORKER_URL"
  local response body
  response="$(api_call GET "/api/admin/stats")"
  if ! body="$(handle_response "$response")"; then return 1; fi
  echo "$body" | jq -r '.' || echo "$body"
}

# Robust delete with explicit success/failure messages (no ambiguity)
action_delete_user() {
  echo ""
  echo "Deleting User Account"
  echo "═════════════════════"
  echo -n "Enter user public ID: "; read -r public_id
  [[ -n "$public_id" ]] || { log_error "Public ID is required"; return 1; }

  choose_worker
  echo ""; echo "Worker:    $WORKER_URL"; echo "Public ID: $public_id"; echo ""
  echo "⚠ This will permanently delete the user and ALL their data!"
  echo -n "Are you sure? [y/N] "; read -r sure
  [[ "$sure" =~ ^[yY]$ ]] || { log_warn "Cancelled."; return 0; }

  log_info "Deleting user…"

  # Helper to interpret a delete response and emit a clear message
  interpret_delete_response() {
    local response="$1"
    local http_code body
    http_code="$(echo "$response" | tail -n1)"
    body="$(echo "$response" | sed '$d')"

    case "$http_code" in
      200|204)
        log_success "User deleted"
        return 0
        ;;
      404)
        log_warn "User not found"
        return 10
        ;;
      401)
        log_error "Unauthorized (check ADMIN_KEY)"
        echo "$body" | jq -r '.' 2>/dev/null || echo "$body"
        return 20
        ;;
      0|"")
        # e.g., curl couldn't connect (local worker not running)
        log_error "Network error (is the selected worker running/reachable?)"
        return 30
        ;;
      *)
        log_error "Delete failed (HTTP $http_code)"
        echo "$body" | jq -r '.' 2>/dev/null || echo "$body"
        return 40
        ;;
    esac
  }

  # 1) Preferred route per codebase: DELETE /api/user/:publicId
  response="$(api_call DELETE "/api/user/$public_id")"
  if interpret_delete_response "$response"; then
    return 0
  else
    rc=$?
    # If "user not found" already, stop (no noisy fallbacks)
    if [[ $rc -eq 10 ]]; then
      return 0
    fi
    # Try fallbacks only for other errors (route differences)
    log_warn "Trying alternate admin routes…"

    # 2) DELETE /api/admin/users/:publicId
    response="$(api_call DELETE "/api/admin/users/$public_id")"
    if interpret_delete_response "$response"; then
      return 0
    else
      rc=$?
      [[ $rc -eq 10 ]] && return 0

      # 3) Legacy POST /api/admin/delete-user {"publicId": "..."}
      payload="$(jq -n --arg id "$public_id" '{publicId:$id}')"
      response="$(api_call POST "/api/admin/delete-user" "$payload")"
      if interpret_delete_response "$response"; then
        return 0
      else
        return 1
      fi
    fi
  fi
}

action_help() {
  cat <<'EOF'
RBMonitor Admin Console — Help
──────────────────────────────
Default behavior:
  ✔ Uses Cloudflare worker (production) unless you type “n”.
  ✗ Local mode is only for testing wrangler dev (temporary data).

Menu actions:
  1) Create invitation code(s) — POST /api/admin/create-invite
  2) View user statistics     — GET  /api/admin/stats
  4) Delete user account      — DELETE /api/user/<publicId> (preferred)
                                 Fallbacks: /api/admin/users/<id> (DELETE),
                                             /api/admin/delete-user (POST)
Notes:
  - Delete now prints an explicit result:
      ✓ User deleted
      ⚠ User not found
      ✗ Unauthorized / network / other HTTP error (with details)
EOF
}

# ── Menu loop (no screen clear) ───────────────────────────
main_menu() {
  while true; do
    echo "═══════════════════════════════════════════════════════════"
    echo "  RBMonitor Admin Console"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "What would you like to do?"
    echo ""
    echo "  [1] Create invitation code(s)      (default)"
    echo "  [2] View user statistics"
    echo "  [3] Create user directly (no invite)   (not implemented)"
    echo "  [4] Delete user account"
    echo "  [5] Help / Usage information"
    echo "  [Q] Quit"
    echo ""
    read -r -p "Your choice [1]: " choice
    choice="${choice:-1}"
    case "$choice" in
      1) action_create_invite; press_enter ;;
      2) action_view_stats;   press_enter ;;
      3) log_warn "Direct user creation not implemented."; press_enter ;;
      4) action_delete_user;  press_enter ;;
      5) action_help;         press_enter ;;
      q|Q) exit 0 ;;
      *) log_warn "Unknown choice: $choice"; press_enter ;;
    esac
  done
}
main_menu

