Rosen Bridge Monitor — Complete Docs and Roadmap

Last updated: 2025-10-26 (Updated with v1.0.3 improvements)

1) Complete Project Documentation (Updated)
1.1 Purpose and Overview

Rosen Bridge Monitor provides a secure, zero-knowledge remote monitoring dashboard for Rosen Bridge watchers. It supports local or remote operation. Sensitive data remains encrypted end-to-end; the server never sees decrypted content.

Key capabilities:

Zero-knowledge architecture with client-side decryption (AES-GCM; keys derived via PBKDF2-SHA256)

Remote dashboard served via Cloudflare Worker or local static server

Invitation-based registration (admin-controlled)

Interactive passphrase setup with confirmation and validation (v1.0.2)

QR code registration for quick mobile onboarding (optional passphrase embedding)

Unified monitoring control via monitor_control.sh (v1.0.2)

Automated status uploads via secure scripts

Mobile-responsive UI, dual timers for uptime and data freshness

1.2 Architecture and Data Flow

High-level flow:

Producer (Docker) collects watcher status → writes to status.json

Uploader (host) encrypts status → sends to Worker (or serves locally)

Dashboard fetches encrypted blob → decrypts in browser → renders

Components:

Cloudflare Worker + KV Storage (production path, HTTPS, rate limit, invite flows)

Static local server (development/local path)

Producer container (write_status.js) - dockerized data collection

Uploader process (cloudflare-sync.js) - host-based encryption/upload

Monitor control script (monitor_control.sh) - unified orchestration

Upload/monitor scripts (Node + shell) handling encryption + transport

Client web UI that decrypts and displays status

Security model:

AES-GCM 256-bit encryption

PBKDF2-SHA256 key derivation (100,000 iterations)

Salt stored in KV; passphrase never leaves client

Minimum 8-character passphrase enforced (v1.0.2)

Passphrase confirmation to prevent typos (v1.0.2)

CSP and security headers enforced at proxy/Worker; local server to set minimal headers

1.3 Repository Structure (current)

worker/mute-mouse-2cd2/: Cloudflare Worker source and config

scripts/: helper scripts (registration, QR, setup, monitoring control)

register-user.sh: Interactive registration with passphrase validation (v1.0.2)

monitor_control.sh: Unified producer/uploader control (v1.0.2)

register-with-qr.sh: QR code registration

prepare_build.sh: Auto-setup and watcher discovery

public/: dashboard static assets

write_status.js: Producer - watcher data collection

cloudflare-sync.js: Uploader - encryption and sync

status-updater.js, static-server.js: local operation support

docker-compose.yml, Dockerfile: containerization and runtime hardening

.env: Auto-generated credentials (created by register-user.sh, gitignored)

.cloudflare-config.json: Registration metadata (auto-generated, gitignored)

README.md: user documentation

.github/workflows: CI and security scans

1.4 Registration and Access

Standard registration (v1.0.2 improvements):

User obtains invite from admin

Runs BASE_URL="..." ./scripts/register-user.sh --invite CODE

Interactive passphrase prompting:

Enter passphrase (hidden input, minimum 8 characters)

Confirm passphrase (must match exactly)

Validation enforced before registration proceeds

Automatic credential management:

Credentials written to .env with proper formatting

Timestamped backups of existing config files

start-monitoring.sh script auto-generated with credential loading

Security warnings displayed about keeping .env secure

Dashboard URL returned; user enters passphrase in client to decrypt

Ready to start monitoring with ./scripts/monitor_control.sh start

QR registration:

scripts/register-with-qr.sh generates QR codes for mobile

Optional: embed passphrase in URL fragment for auto-login (trade-off: convenience vs shoulder-surf risk)

Fragment stays client-side; server never receives passphrase

Registration workflow robustness (v1.0.2):

Temporary input file cleanup even on errors

Config backup before overwrite (timestamped)

Proper shell quoting throughout

Cross-platform color support with fallbacks

Health check before registration

Dependency checking (curl, jq, node)

1.5 Monitoring Control (v1.0.2)

Unified monitoring via monitor_control.sh:

Commands:

start: Start both producer (Docker) and uploader (host)

stop: Gracefully stop both components with cleanup

status: Show current state of producer and uploader

restart: Stop and start both components

(no args): Interactive menu for user-friendly operation

Producer Management:

Uses docker compose up -d for proper restart policies

Auto-removes stopped containers before starting

Detects externally-started containers

Supports custom container names via CONTAINER_NAME env var

Uploader Management:

Runs as background host process

PID tracking in .run/uploader.pid

Graceful shutdown with 5-second timeout

SIGKILL fallback for hung processes

Reads credentials from .env (no secrets in command line)

Health check of Worker before starting

Advanced Options:

--no-docker: Skip producer, only manage uploader

--no-sync: Skip uploader, only manage producer

Custom BASE_URL via environment variable

Integration:

Validates .env file exists and contains required variables

Adopts externally-managed processes where possible

Clear diagnostic output with status indicators

CI-friendly with proper exit codes

1.6 Monitoring and Timers

Dual timers:

System uptime timer (resets after >6 min silence)

Data freshness timer (resets when watcher data changes)

Status dot: green <5.5 min silence; orange 5.5–6 min; red >6 min

Uploader and status:

start-monitoring.sh (auto-generated) reads credentials only from .env

cloudflare-sync.js encrypts and uploads

write_status.js manages status generation

monitor_control.sh orchestrates the full stack (v1.0.2)

1.7 Deployment

Production path (recommended):

Cloudflare Worker deployed via Wrangler

Admin key stored as secret

KV namespace for user metadata and encrypted blobs

HTTPS enforced, rate-limiting available, invite-based onboarding

Users register with production Worker URL

Monitor control manages local producer and uploader

Local path (development/local ops):

Static server serves public/ with minimal security headers

Compose binds to localhost by default (127.0.0.1)

Healthcheck exposed at /health

Wrangler dev on port 38472 for local Worker testing

1.8 Container and Runtime Hardening (current state)

Non-root runtime (USER node)

Read-only root filesystem (read_only: true)

Capabilities dropped (cap_drop: ALL); only SETUID/SETGID added

Loopback bind by default for host port exposure

Resource limits and healthchecks configured

No docker.sock mount (no privileged socket access)

Docker compose restart policies respected (v1.0.2)

1.9 CI/CD

Baseline CI (ci.yml) for install/build/syntax

Security workflow (security.yml) runs npm audit, Trivy FS, Gitleaks, Semgrep on PR/push/weekly cron

Current scans soft-fail; roadmap includes enforcement (fail-on-high/critical)

1.10 Recent Feature Highlights (v1.0.2)

Registration Script Improvements:

Interactive passphrase prompting with hidden input

Passphrase confirmation to prevent typos

Minimum 8-character validation enforced

Automatic .env file creation with proper formatting

No more merged lines in .env (proper newline handling)

Timestamped backups of existing config files

Security warnings about .env file

Auto-generation of start-monitoring.sh wrapper script

Robust error handling and dependency checking

Monitor Control Script:

New unified control script (monitor_control.sh)

Manages both producer (Docker) and uploader (host)

Commands: start, stop, status, restart

Interactive menu mode when no command specified

Docker compose integration (respects restart policies)

Graceful shutdown with timeout and fallback

Auto-detection of externally-started processes

PID file management for uploader

Advanced flags: --no-docker, --no-sync

Clear status output with emoji indicators

Previous Highlights (v1.0.1):

QR registration flow with optional passphrase embedding

prepare_build.sh shows LAN URL in QR; removes redundant prompts when SHOW_QR=1

Timer display unified to 00H 00M 00S

Repository cleanup and .gitignore hardening

1.11 Admin and Limits

Admin endpoints (invite creation, stats, user management) require x-admin-key

Usage guidance for Cloudflare free tier; polling and upload patterns documented

Simplified invite creation workflow for new users

1.12 Troubleshooting (selected)

Registration Issues:

"Passphrases do not match": Retype carefully during confirmation

"Passphrase must be at least 8 characters": Use longer passphrase

"Registration failed - config not created": Check Worker health, invite validity

Network errors: Verify BASE_URL and Worker accessibility

Monitor Control Issues:

"Error: .env file not found": Run register-user.sh first

"Error: BASE_URL not set in .env": Re-run registration or manually add

Producer not starting: Check Docker availability and permissions

Uploader stuck: Verify BASE_URL in .env matches Worker location

Container conflicts: Use ./scripts/monitor_control.sh restart

General Issues:

"Cannot decrypt": Check passphrase, ensure uploader running and first upload elapsed

QR issues: Ensure LAN binding or use QR script; consider incognito to avoid autofill collisions

2) Forward-Looking Roadmap

Goal: continue hardening, introduce self-reporting (volume-based reports), add Node Monitoring, per-watcher Statistics, and Alerts.

2.1 Registration Script Enhancements (Future)

Based on code review feedback, potential improvements for register-user.sh:

Priority: Medium (Quality of Life)

Passphrase Strength Checking (optional enhancement)

Add optional passphrase strength meter/validation

Check for: special characters, numbers, mixed case

Provide feedback: "Weak", "Moderate", "Strong"

Phase A.1 — Sidecar Security Commitments (Immediate)

These commitments ensure safe operation when Monitor is run as a sidecar alongside a Rosen Watcher.

Network Egress Allowlisting:

Commitment: Monitor will only connect to the configured Cloudflare Worker base URL. No other outbound network traffic.

Action: Implement a configuration option (ALLOWED_EGRESS_HOSTS) defaulting to the Worker domain. Document how operators can enforce this via container egress firewall/proxy.

Acceptance: At runtime, Monitor attempts no connections outside the allowlist. Startup logs confirm allowed hosts.

No Auto-Update, Telemetry, or Remote Code:

Commitment: No self-update logic, anonymous telemetry, or remote code/config fetching that alters behavior without explicit user action.

Action: Explicitly state this in documentation (e.g., SECURITY.md).

Acceptance: Code review confirms absence of such mechanisms.

Strict Logging Hygiene:

Commitment: No secrets or environment variables are logged. Error messages are summarized without dumping sensitive request/response bodies or headers.

Action: Implement a redaction utility for sensitive data in logs. Ensure cloudflare-sync.js and the Worker avoid logging sensitive payloads.

Acceptance: Unit tests cover redaction; manual review of logs under various error conditions.

Enforced Security Headers (UI/Content):

Commitment: Strict security headers are enforced by default in the Cloudflare Worker and the local static server.

Action: Implement the following headers:

Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'

X-Content-Type-Options: nosniff

X-Frame-Options: DENY

Referrer-Policy: no-referrer

Acceptance: Automated checks in CI for local server; manual verification for the Worker.

Hardened Container Runtime Defaults:

Commitment: Monitor containers will run as a non-root UID, with a read-only root filesystem, all capabilities dropped (cap_drop: ["ALL"]), no-new-privileges:true, and a tmpfs mount for /tmp with noexec,nosuid,nodev.

Action: Ensure docker-compose.yml and Dockerfile reflect these settings as defaults.

Acceptance: Documented as default; docker inspect output confirms settings. (References Section 1.8 for existing hardening).

Sanitized Status Interface Contract:

Commitment: The only data Monitor reads locally from a Watcher is via a sanitized /status endpoint or a read-only file, containing strictly non-sensitive fields.

Action: Define a clear "sanitized status schema" (e.g., version, network, lastObservationTs, height, syncLag, uptime, non-sensitive metrics). Explicitly list "never fields" (e.g., no keys, env vars, file paths, stack traces).

Acceptance: Schema documented; code validates outgoing status to prevent sensitive data leakage.

Dependency Transparency:

Commitment: Provide a Software Bill of Materials (SBOM) and use lockfiles. Dependencies will be kept up-to-date via automated tools.

Action: Generate SBOM (e.g., CycloneDX SPDX) in CI. Enable Dependabot/Renovate for npm and GitHub Actions.

Acceptance: SBOM attached to releases; automated dependency updates are active.

CI Enforcement Escalation:

Commitment: Merge requests will be blocked if security scans (npm audit, Trivy FS, Gitleaks, Semgrep) report High/Critical vulnerabilities.

Action: Configure CI to fail on these conditions.

Acceptance: CI pipeline blocks merges for specified security findings. (References Section 1.9 for existing scans).

Configuration Safeties (Passphrase):

Commitment: Passphrase storage will not be the default. If a user explicitly opts to store it in .env, strong security warnings will be displayed.

Action: Ensure the registration flow defaults to not storing the passphrase and provides clear warnings if chosen.

Acceptance: Registration flow defaults and warning messages are verified.

Operational Observability Signals:

Commitment: Provide minimal operational metrics (e.g., last successful upload timestamp, bytes sent, retry counts) without leaking sensitive data.

Action: Implement a /local-health endpoint or CLI status command to report these metrics.

Acceptance: Documentation includes how to check these signals and interpret "healthy" status.

Non-blocking (user can proceed with warning)

Acceptance: Strength indicator shown; users can override

Invite Code Format Validation (client-side)

Validate invite code format before sending to server

Expected format: INVITE-XXXX-XXXX (adjust to actual format)

Fail fast on obviously invalid codes

Reduces unnecessary server round-trips

Acceptance: Invalid formats rejected locally with helpful message

Network Retry Logic (reliability)

Add configurable retry logic for network operations

Retry registration API call on transient failures

Exponential backoff: 1s, 2s, 4s (max 3 attempts)

Distinguish between retryable (timeout, 5xx) vs non-retryable (401, 404) errors

Acceptance: Transient network failures auto-retry; permanent failures fail fast

Verbose/Debug Mode (troubleshooting)

Add --verbose or --debug flag

Show detailed HTTP requests/responses

Display credential generation steps

Helpful for debugging registration issues

Acceptance: --verbose flag shows detailed diagnostic output

Passphrase Generation Helper (security)

Add --generate-passphrase option

Generate cryptographically secure random passphrase

Format: 4-6 random words or 20+ character alphanumeric

Display generated passphrase and prompt to save it

Acceptance: Generated passphrases meet strength requirements

Implementation Sketch:

# Passphrase strength check (optional)
check_passphrase_strength() {
  local pass="$1"
  local strength=0
  
  [ ${#pass} -ge 12 ] && ((strength++))
  [[ "$pass" =~ [A-Z] ]] && ((strength++))
  [[ "$pass" =~ [a-z] ]] && ((strength++))
  [[ "$pass" =~ [0-9] ]] && ((strength++))
  [[ "$pass" =~ [^A-Za-z0-9] ]] && ((strength++))
  
  case $strength in
    0|1) echo "${RED}Weak${NC}" ;;
    2|3) echo "${YELLOW}Moderate${NC}" ;;
    *) echo "${GREEN}Strong${NC}" ;;
  esac
}

# Invite code validation
validate_invite_format() {
  local code="$1"
  if [[ ! "$code" =~ ^INVITE-[A-Z0-9]{6}-[A-Z0-9]{6}$ ]]; then
    die "Invalid invite code format. Expected: INVITE-XXXX-XXXX"
  fi
}

# Network retry with exponential backoff
retry_with_backoff() {
  local max_attempts=3
  local attempt=1
  local delay=1
  
  while [ $attempt -le $max_attempts ]; do
    if "$@"; then
    return 0
    fi
    
    local exit_code=$?
    if [ $attempt -lt $max_attempts ]; then
    warn "Attempt $attempt failed, retrying in ${delay}s..."
    sleep $delay
    delay=$((delay * 2))
    fi
    ((attempt++))
  done
  
  return $exit_code
}

# Verbose mode support
VERBOSE="${VERBOSE:-0}"
debug() {
  [ "$VERBOSE" = "1" ] && echo "${CYAN}[DEBUG]${NC} $*" >&2
}

# Passphrase generation
generate_passphrase() {
  # Option 1: Random words (requires word list)
  # shuf -n 4 /usr/share/dict/words | tr '\n' '-' | sed 's/-$//'
  
  # Option 2: Alphanumeric
  LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 24
  echo
}


Current Status (v1.0.2):

✅ Interactive passphrase prompting with confirmation

✅ Minimum length validation (8 characters)

✅ Automatic .env creation and formatting

✅ Timestamped config backups

✅ Proper error handling

✅ Dependency checking

✅ Cross-platform color support

⏳ Passphrase strength checking (future)

⏳ Invite code format validation (future)

⏳ Network retry logic (future)

⏳ Verbose/debug mode (future)

⏳ Passphrase generation helper (future)

2.2 Start-Monitoring Script Strategy (Decision Needed)

Context:
The project currently has two ways to start monitoring:

start-monitoring.sh - Auto-generated simple wrapper (uploader only, foreground)

scripts/monitor_control.sh - Full orchestration tool (producer + uploader, lifecycle management)

Current State:

register-user.sh generates start-monitoring.sh (lines 111-134)

Success message mentions "Created: start-monitoring.sh" (line 140)

But final instruction recommends: ./scripts/monitor_control.sh start (line 147)

This creates confusion: script generates one tool but recommends another

Priority: Low (Documentation/UX consistency)

Option 1: Keep Both Scripts (Backward Compatibility)

Continue generating start-monitoring.sh

Update success message to explain both options:

✓ Created: start-monitoring.sh (simple uploader wrapper)

Two ways to start monitoring:

Recommended: ./scripts/monitor_control.sh start
  - Full stack management (producer + uploader)
  - Background processes with lifecycle control
  
Alternative: ./start-monitoring.sh
  - Uploader only (assumes producer running)
  - Foreground process for debugging


Add note in README explaining the difference

Acceptance: Users understand when to use each script

Option 2: Stop Generating start-monitoring.sh (Simplification)

Remove lines 111-134 (script generation)

Remove line 140 (success message about script)

Only recommend monitor_control.sh

Add deprecation notice in README for existing users

Acceptance: New users only see one way to start; docs explain migration

Option 3: Make start-monitoring.sh a Wrapper (Hybrid)

Keep generating start-monitoring.sh

Change it to call monitor_control.sh instead:

#!/usr/bin/env bash
# start-monitoring.sh - Convenience wrapper
# Calls monitor_control.sh for full stack management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Pass DASH_PASSPHRASE from .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

exec ./scripts/monitor_control.sh start "$@"


Users can use either script (same result)

Acceptance: Both scripts work identically; no confusion

Option 4: Consolidate Credential Sources (Long-term Architecture)

Currently split between .cloudflare-config.json and .env

monitor_control.sh reads .cloudflare-config.json + DASH_PASSPHRASE env

start-monitoring.sh reads .env (everything in one place)

Decision needed: standardize on one approach

Approach A: Everything in .env, remove .cloudflare-config.json

Approach B: Everything in .cloudflare-config.json, deprecate .env

Approach C: Keep split but document clearly (status quo)

Update both scripts to use same credential source

Acceptance: Consistent credential management; clear documentation

Recommended Approach (Staged):

Phase 1 (Quick fix - v1.0.3):

Implement Option 1 (keep both, explain difference)

Update success message with clear guidance

Add comparison table to README

Timeline: 1-2 hours

Phase 2 (If we want simplification - v1.1.0):

Decide on Option 3 (wrapper) or Option 2 (remove)

If choosing wrapper, update generated script

Update all documentation

Timeline: 2-4 hours

Phase 3 (Long-term cleanup - v2.0.0):

Implement Option 4 (credential consolidation)

Breaking change, requires migration guide

Timeline: 1-2 weeks (includes testing)

Current Status:

⏸️ Paused for decision

📋 Documented options for future consideration

🎯 Recommendation: Phase 1 (explain both) for now

2.4 prepare_build.sh Script Improvements (Immediate Priority)

**Priority: High (Security & Code Quality)**  
**Target: Next development session**

Based on comprehensive script review (October 2024), several critical issues need addressing:

### Critical Security Issues (Must Fix)

**🚨 Privilege Escalation Without User Consent**
- Location: Lines 266-274 (auto-installation logic)
- Issue: Script runs `sudo apt-get install` without clear user consent
- Risk: Unexpected privilege escalation during automated setup
- Fix Required:
  ```bash
  warn_sudo_install() {
    echo "⚠️  Installing qrencode requires administrator privileges"
    read -p "Continue with sudo installation? [y/N] " consent
    [[ "$consent" =~ ^[yY]$ ]] || return 1
  }
  ```
- Acceptance: Clear warning displayed before any sudo operations

**🚨 Potential Command Injection in Network Names**
- Location: Network creation logic (lines 150-155)
- Issue: Docker network names not validated before use
- Risk: Special characters could cause command injection
- Fix Required:
  ```bash
  validate_network_name() {
    local net="$1"
    [[ "$net" =~ ^[a-zA-Z0-9_-]+$ ]] || die "Invalid network name: $net"
  }
  ```
- Acceptance: All network names validated against safe character set

**🟡 Port Parsing Without Bounds Checking**
- Location: Lines 115-120 (regex port extraction)
- Issue: No validation of extracted port numbers
- Risk: Invalid port numbers could cause failures
- Fix Required:
  ```bash
  validate_port() {
    local port="$1"
    [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]
  }
  ```
- Acceptance: Port numbers validated before use

### Code Organization Issues (Should Fix)

**🔧 Deeply Nested Interactive Logic**
- Location: Lines 245-350 (main function)
- Issue: 173-line main function with 4+ levels of nesting
- Impact: Hard to test, debug, and maintain
- Refactor Required:
  ```bash
  # Extract to separate functions:
  handle_qr_interaction() { ... }
  handle_clipboard_copy() { ... }  
  handle_monitor_startup() { ... }
  handle_cloudflare_setup() { ... }
  ```
- Acceptance: Each function < 30 lines, single responsibility

**🔧 Global Variable Dependencies**
- Issue: Functions modify globals without clear interfaces
- Impact: Hard to test components independently
- Fix: Pass parameters explicitly, return values clearly
- Acceptance: Functions testable in isolation

**🔧 Inconsistent Error Handling**
- Issue: Mix of `|| true`, `exit 1`, and unhandled errors
- Impact: Unpredictable failure behavior
- Fix Required:
  ```bash
  cleanup_on_error() {
    log "Cleaning up after error..."
    # Remove partial files, restore backups
  }
  trap cleanup_on_error ERR
  ```
- Acceptance: Consistent error handling throughout

### Implementation Plan (2-3 Hour Session)

**Phase 1: Security Fixes (30 minutes)** ✅ COMPLETED (Oct 26, 2025)

**Commit:** `aff0ed5` - All security validation functions implemented and tested
1. Add `validate_network_name()` function and integrate
2. Add `warn_sudo_install()` with user consent  
3. Add `validate_port()` for port number checking
4. Test with various input combinations

**Phase 2: Code Organization (90 minutes)**
1. Extract `handle_qr_interaction()` function
2. Extract `handle_monitor_startup()` function  
3. Extract `handle_cloudflare_setup()` function
4. Refactor main() to use extracted functions
5. Test interactive flows work correctly

**Phase 3: Error Handling (30 minutes)** ✅ COMPLETED (Oct 26, 2025)

**Commit:** `d550734` - Error cleanup trap, Docker validation, and standardized logging added
1. Add error cleanup trap
2. Standardize error reporting
3. Add validation for Docker command outputs
4. Test error scenarios and recovery

**Phase 4: Testing & Documentation (30 minutes)** ✅ COMPLETED (Oct 26, 2025)

**Testing:** All validation functions tested and verified working correctly
1. Test with multiple watcher containers
2. Test error conditions (missing tools, invalid inputs)
3. Update function documentation
4. Verify all interactive prompts work correctly

### Test Cases to Verify

```bash
# Security validation tests
./prepare_build.sh  # Should handle missing qrencode gracefully
# With malicious network name in docker output
# With invalid port numbers in container output

# Interaction tests  
./prepare_build.sh  # Should handle all prompts correctly
# User says 'no' to qrencode install
# User says 'yes' to monitor startup
# User cancels clipboard copy

# Error recovery tests
# Docker command failures
# Network creation failures
# Permission denied scenarios
```

### Current Status Assessment

✅ **Core functionality works well**  
✅ **Good user experience design**  
✅ **Comprehensive feature set**  
✅ **Security validation implemented**  
❌ **Code organization needs improvement**  
✅ **Error handling standardized**

### Files to Modify

- `scripts/prepare_build.sh` (primary target)
- Consider adding `scripts/prepare_build_test.sh` for validation

### Acceptance Criteria

- [x] All security warnings addressed
- [x] No sudo operations without explicit user consent  
- [x] All user inputs validated before system calls
- [ ] Functions extractable and testable independently
- [x] Consistent error handling with cleanup
- [ ] Interactive flows work on both Linux and macOS
- [ ] No regression in existing functionality

**Next Action**: Start with Phase 1 security fixes, as these are the highest risk items.

2.5 Security Hardening - Genuine Gaps Analysis (REVISED)

**Priority: High (Incremental improvements)**  
**Target: Immediate (focused on actual gaps)**  
**Status: Revised after README review - removed already-implemented items**

After comprehensive review, many security features are **already implemented and documented**. This section focuses only on genuine gaps and incremental improvements.

### Already Implemented ✅ (Last Updated: Oct 30, 2025):

- **✅ Rate Limiting:** Comprehensive implementation with 30 reads/hour per user, KV-based tracking
- **✅ PBKDF2 Iterations:** Correctly set to 100,000 iterations as documented
- **✅ Container Security (Partial):** Read-only filesystem, dropped capabilities, restart policies
- **✅ Passphrase Validation:** 8-character minimum enforced with confirmation
- **✅ HTTPS Enforcement:** Automatically enforced in production
- **✅ Network Isolation:** Automatic watcher network discovery and isolation
- **✅ Network Egress Security:** Hardcoded allowlist (worker + api.ergoplatform.com) prevents unauthorized connections (lib/egress-validator.js, lib/safe-fetch.js)

### Genuine Gaps Requiring Implementation ❌ (Verified Missing):

- **✅ Security Headers:** Comprehensive CSP (nonce-based), HSTS, X-Frame-Options, CORS policies (worker/mute-mouse-2cd2/src/security.ts, src/csp.ts)
- **❌ Container User Configuration:** Dockerfile has conflicting user statements (monitor vs node)
- **❌ Passphrase Storage Policy:** Currently prompts to save in .env by default

## Verified Implementation Gaps (Prioritized by Impact):


### Group 2: Container Configuration Cleanup 🟡

**🔧 Docker User Standardization**
- **Current State:** Dockerfile has conflicting USER statements (monitor and node users)
- **Required:** Single consistent non-root user configuration
- **Files:** `Dockerfile`, docker-compose configurations
- **Impact:** Medium - ensures consistent security posture
- **Time:** 2-2.5 hours (includes testing all components)

### Group 1: Security Policy Refinements (No Breaking Changes)

**🔐 PBKDF2 Iteration Enhancement**
- **Current State:** 100,000 iterations (documented in README)
- **Improvement:** Increase to 300,000 for new encryptions only
- **Files:** `cloudflare-sync.js`, `public/dashboard.js`
- **Implementation:** Add version field to ciphertext envelope, maintain backward compatibility
- **Time:** 2-3 hours

**🔑 Passphrase Policy Improvement**
- **Current State:** 8-character minimum (implemented and working)
- **Improvement:** Recommend 12+ characters in guidance (keep 8 minimum for compatibility)
- **Files:** `scripts/register-user.sh`, `public/dashboard.js`, `README.md`
- **Implementation:** Update recommendations and hints, no breaking changes
- **Time:** 1 hour

**🚫 Passphrase Storage Default**
- **Current State:** Prompts user to save passphrase in .env
- **Improvement:** Default to "no" for better security
- **Files:** `setup-cloudflare.js`, `scripts/register-user.sh`
- **Implementation:** Change default prompt behavior
- **Time:** 30 minutes

### Group 2: Worker Security Enhancements

**� Complete Security Headers Implementation**
- **Current State:** CSP headers implemented (documented)
- **Improvement:** Add full security header set
- **Headers Needed:** X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Files:** `worker/mute-mouse-2cd2/src/index.ts`
- **Time:** 1-2 hours

**⏱️ Rate Limiting Configuration Enhancement**
- **Current State:** Rate limiting enabled by default
- **Improvement:** Make thresholds explicit and conservative, add Retry-After headers
- **Files:** `worker/mute-mouse-2cd2/src/config.ts`
- **Implementation:** Document current thresholds, add response headers
- **Time:** 1-2 hours

**📝 Logging Hygiene Audit**
- **Current State:** Unknown - needs verification
- **Improvement:** Ensure no sensitive data in logs
- **Files:** `worker/mute-mouse-2cd2/src/` (all logging calls)
- **Implementation:** Audit and redact if needed
- **Time:** 1-2 hours

### Group 3: Error Handling and UX

**🛡️ Enhanced Decrypt Error Handling**
- **Current State:** Basic error handling
- **Improvement:** Fail closed with clear UI, no stack traces
- **Files:** `public/dashboard.js`
- **Implementation:** Improve error messages and UI feedback
- **Time:** 1 hour

**🤐 Script Output Hygiene**
- **Current State:** Needs audit
- **Improvement:** Ensure no secrets in script output/logs
- **Files:** `scripts/monitor_control.sh`, all scripts
- **Implementation:** Audit and mask sensitive output
- **Time:** 1 hour

### Implementation Priority (Revised):

**🚨 Day 1 (Immediate Security Gaps):**
1. Passphrase storage default (30 min)
2. Script output hygiene (1 hour)
3. Complete security headers (1-2 hours)

**📅 Day 2 (Enhancements):**
4. Rate limiting enhancement (1-2 hours)
5. Logging hygiene audit (1-2 hours)
6. Decrypt error handling (1 hour)

**📈 Day 3 (Crypto Improvements):**
7. PBKDF2 iteration increase (2-3 hours)
8. Passphrase policy updates (1 hour)

**Total Realistic Time:** 8.5-12.5 hours (substantial reduction from original estimate)

### Key Insight:

RBMonitor already has **excellent security foundations**. The focus should be on **incremental enhancements** rather than fundamental security implementations. Many items in the original security suggestions were already implemented but not explicitly documented in the security review context.

> **Quick Reference:** For a focused, actionable task list based on this analysis, see [`RBMonitor_Development_Roadmap_REVISED.md`](./RBMonitor_Development_Roadmap_REVISED.md)

2.3 Security Roadmap (Phased, with acceptance criteria)

Phase A — Immediate hardening (Weeks 1–2)

Self-Reporting Aggregation (volume-based)

Add /reports/<watcher>.json aggregator behind ENABLE_REPORTS=1

Sample reporter writes atomically (.tmp then rename)

PREFER_REPORTS=1 to prefer /reports over discovery

Acceptance: 24h parity with current discovery

Container hardening (compose)

Add security_opt: ["no-new-privileges:true"]

Add tmpfs: /tmp:rw,noexec,nosuid,nodev,size=32M

Acceptance: no regressions; writable paths confined to volumes/tmpfs

Local static server headers

Add minimal security headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)

Acceptance: headers verified locally

Phase B — Validation & Injection defenses (Weeks 2–3)

Input/config validation (strict regex, fail-fast)

API response validation (shape checks, counters for invalids)

Static path traversal protection for any computed paths

Acceptance: tests cover invalid cases; no shell interpolation of untrusted input

Phase C — CI/CD enforcement and image scanning (Week 3–4)

Fail on High/Critical: npm audit (prod only), Trivy FS, Semgrep, Gitleaks

Optional: build image and run Trivy image scan

Expand SECURITY.md; add on-prem reverse proxy overlay doc (TLS/auth/rate limit)

Acceptance: required checks block merges; docs updated

Phase D — Optional: deprecate discovery post-parity

Remove discovery after self-reporting stable; drop docker-cli from image

Acceptance: codebase no longer relies on discovery; image footprint reduced

2.4 Product/UX: Node Monitoring (Blockchain Nodes)

Scope:

Track each blockchain node used by watchers (local or public RPCs)

Dashboard summary with health dots; dedicated Nodes page with details

Collection and health:

Poll RPCs per chain (Ergo, Bitcoin-like, EVM-like)

Compare node height vs trusted tip to compute lag

Classify: healthy/degraded/down based on lag, latency, peers (thresholds configurable)

Acceptance:

Nodes appear with status dots on dashboard

Nodes page details height, tip, lag, peers, version, latency

Out-of-sync flagged within 2 intervals; public RPC outages handled gracefully

Minimal data model (example):

{
  "nodes": [
    {
    "id": "ergo-local",
    "network": "ergo",
    "rpcUrl": "http://ergo-node:9053",
    "public": false,
    "lastCheck": "2025-10-23T10:21:00Z",
    "metrics": {
    "height": 1234567,
    "tipHeight": 1234572,
    "lag": 5,
    "peers": 16,
    "version": "v5.0.14",
    "rpcLatencyMs": 120
    },
    "status": "degraded",
    "statusReason": "lag>3 blocks"
    }
  ]
}

2.5 Product/UX: Health Statistics (Watchers)

Scope:

"Statistics" page with per-watcher uptime %, error counts, latency (avg/p95), stale windows

Aggregated insights (sparklines, top unstable watchers)

JSON/CSV export

Collection:

Extend write_status.js to track counters and timings

Maintain rolling series in memory; persist summarized stats to public/stats.json

Optional /metrics for Prometheus later

Acceptance:

Stats page renders uptime, errors, latency

Staleness visible; stats persist or recompute on restart

2.6 Alerts and Notifications (Watchers and Nodes)

Triggers (configurable):

Watchers: consecutive failures, stale > X min, error rate > threshold

Nodes: lag > Y blocks for Z intervals, RPC timeouts, low peers sustained

Channels:

Webhooks (generic JSON POST), Slack, Discord, Email (optional)

Future: Telegram/Matrix

Multiple channels with per-rule routing

Payload example:

{
  "type": "watcher.down",
  "severity": "critical",
  "timestamp": "2025-10-23T10:45:00Z",
  "watcher": "watcher_ergo-ui-1",
  "details": {
    "last_success": "2025-10-23T10:41:00Z",
    "consecutive_failures": 4,
    "error_sample": "ECONNREFUSED"
  },
  "links": {
    "dashboard": "http://localhost:8080/#watcher=watcher_ergo-ui-1"
  }
}


Config sketch:

{
  "alerts": {
    "enabled": true,
    "debounceMinutes": 15,
    "channels": [
    { "type": "webhook", "name": "ops-webhook", "url": "https://example.com/hook" },
    { "type": "slack", "name": "slack-ops", "url": "https://hooks.slack.com/services/XXX/YYY/ZZZ" }
    ],
    "rules": [
    { "id": "watcher-down", "entity": "watcher", "event": "down", "severity": "critical", "threshold": { "failures": 3 }, "channels": ["ops-webhook","slack-ops"] },
    { "id": "node-lag", "entity": "node", "event": "lag", "severity": "warning", "threshold": { "blocks": 5, "intervals": 2 }, "channels": ["ops-webhook"] }
    ]
  }
}


Acceptance:

Alerts fire + debounce; recovery notifications sent

Multi-channel routing works; rate limits honored

2.7 Implementation Snippets (for later application)

Compose hardening:

services:
  rosen-monitor:
    security_opt:
    - no-new-privileges:true
    tmpfs:
    - /tmp:rw,noexec,nosuid,nodev,size=32M


CI security enforcement:

    - name: Security audit (prod deps)
    run: npm audit --omit=dev --audit-level=high

    - name: Run Trivy vulnerability scan (FS)
    run: trivy fs --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed --quiet .

    - name: Run Gitleaks secret scan
    run: gitleaks detect --source . --redact --exit-code 1

    - name: Run Semgrep static analysis
    run: semgrep --config p/ci --severity=ERROR --error --quiet .


Optional Trivy image scan:

    - name: Build Docker image
    run: docker build -t ghcr.io/${{ github.repository }}:ci-${{ github.sha }} --build-arg DOCKER_GID=999 .

    - name: Trivy image scan
    run: trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed ghcr.io/${{ github.repository }}:ci-${{ github.sha }}


Local static server headers (Phase A):

res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Referrer-Policy', 'no-referrer');
res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'");


Path traversal guard:

const safeBase = path.resolve(PUBLIC_DIR);
const safePath = path.resolve(safeBase, path.normalize(requestedPath));
if (!safePath.startsWith(safeBase)) {
  res.statusCode = 400;
  return res.end('Bad request');
}


Dockerfile simplification (question for future cleanup):

The Dockerfile creates a monitor user but runs as USER node with chown -R node:node /app. Either:

Remove monitor user creation and related chown, standardize on node:node; or

Switch to USER monitor and ensure volumes UID/GID match.

Also consider removing docker-cli when discovery is fully replaced by self-reporting.

2.8 Priorities and Timeline

Immediate (v1.0.2 - Completed):

✅ Interactive passphrase setup with confirmation

✅ Automatic .env management

✅ Unified monitor control script

✅ Docker compose integration

Quick Wins (v1.0.3 - Optional):

📋 start-monitoring.sh strategy (Phase 1: document both options)

Update success message with clear guidance

Add comparison table to README

Week 1–2:

Self-reporting aggregator

Compose hardening

Local headers

(Optional) Registration script enhancements: invite validation, verbose mode

(Optional) start-monitoring.sh decision implementation

Week 2–3:

Validation/defenses

Initial Node Monitoring

Permit/balance UX

(Optional) Registration script enhancements: retry logic, passphrase strength

Week 3–4:

CI enforcement

SECURITY.md expansion

Optional on-prem proxy overlay doc

(Optional) Registration script enhancements: passphrase generation

Post-4:

Flip PREFER_REPORTS=1

Consider removing discovery/docker-cli

Optional Prometheus metrics

Structured logs

Health statistics page

Alerts and notifications

Long-term (v2.0.0):

(Optional) start-monitoring.sh Phase 3: credential consolidation

Breaking changes with migration guide

3) Contribution Guidance

PRs must pass enforced security scans; no secrets in commits
Security fixes require tests and reference to roadmap items
UX contributions include a short mock and acceptance criteria

For registration script enhancements:

Maintain backward compatibility

Add tests for new validation logic

Document new flags in README

Follow existing error handling patterns

Ensure cross-platform compatibility (Linux, macOS)

---

## Future Enhancements (From TODO.md - Added Nov 6, 2025)

### UI/UX Improvements
- [ ] Show unreachable watcher status in UI (red indicator, error badge)
- [ ] Desktop shortcut/launcher for prepare_build.sh script
- [ ] Interactive watcher add/remove from UI
- [ ] Y/n prompts for building after discovery
- [x] Progress bars for permit utilization (IMPLEMENTED - see public/index.html)
- [ ] Mobile-responsive layout improvements
- [ ] Dark mode toggle

### Monitoring & Alerts
- [ ] Change registration to cloudflare service to self-serve
- [ ] Email/webhook alerts for watcher failures
- [ ] Historical status tracking and charts
- [ ] Performance metrics (response times, uptime %)
- [ ] Configurable alert thresholds
- [ ] Status change notifications

### Technical Enhancements
- [ ] TypeScript migration (Note: Partial - Prometheus mentioned in existing plans)
- [ ] Structured logging with log rotation
- [ ] Health check endpoint improvements
- [ ] Configuration validation
- [ ] Automated testing suite
- [ ] CI/CD pipeline improvements
- [ ] Load-balancing of cloudflare calls

### Operations
- [ ] Backup/restore procedures
- [ ] Multi-environment support (dev/staging/prod)
- [ ] Load balancing for multiple monitor instances
- [ ] Database persistence option
- [ ] Configuration management improvements

### Frontend Fixes (High Priority)
- [ ] **Frontend Robustness:** Patch index.html to safeguard against non-object or missing permitStatus
- [x] **Backend Normalization:** Always output permitStatus as an object in status.json (DONE)
- [ ] **Debug Watcher Down UI:** Re-test UI and status for down/unknown watchers
- [ ] **General Testing:** Verify overall system health and dashboard accuracy

