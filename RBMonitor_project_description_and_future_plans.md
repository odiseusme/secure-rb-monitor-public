# Rosen Bridge Monitor — Complete Docs and Roadmap

Last updated: 2025-10-23 (Updated with v1.0.2 improvements)

## 1) Complete Project Documentation (Updated)

### 1.1 Purpose and Overview
Rosen Bridge Monitor provides a secure, zero-knowledge remote monitoring dashboard for Rosen Bridge watchers. It supports local or remote operation. Sensitive data remains encrypted end-to-end; the server never sees decrypted content.

Key capabilities:
- Zero-knowledge architecture with client-side decryption (AES-GCM; keys derived via PBKDF2-SHA256)
- Remote dashboard served via Cloudflare Worker or local static server
- Invitation-based registration (admin-controlled)
- **Interactive passphrase setup with confirmation and validation** (v1.0.2)
- QR code registration for quick mobile onboarding (optional passphrase embedding)
- **Unified monitoring control via monitor_control.sh** (v1.0.2)
- Automated status uploads via secure scripts
- Mobile-responsive UI, dual timers for uptime and data freshness

### 1.2 Architecture and Data Flow

High-level flow:
- Producer (Docker) collects watcher status → writes to `status.json`
- Uploader (host) encrypts status → sends to Worker (or serves locally)
- Dashboard fetches encrypted blob → decrypts in browser → renders

Components:
- Cloudflare Worker + KV Storage (production path, HTTPS, rate limit, invite flows)
- Static local server (development/local path)
- **Producer container** (`write_status.js`) - dockerized data collection
- **Uploader process** (`cloudflare-sync.js`) - host-based encryption/upload
- **Monitor control script** (`monitor_control.sh`) - unified orchestration
- Upload/monitor scripts (Node + shell) handling encryption + transport
- Client web UI that decrypts and displays status

Security model:
- AES-GCM 256-bit encryption
- PBKDF2-SHA256 key derivation (100,000 iterations)
- Salt stored in KV; passphrase never leaves client
- **Minimum 8-character passphrase enforced** (v1.0.2)
- **Passphrase confirmation to prevent typos** (v1.0.2)
- CSP and security headers enforced at proxy/Worker; local server to set minimal headers

### 1.3 Repository Structure (current)
- `worker/mute-mouse-2cd2/`: Cloudflare Worker source and config
- `scripts/`: helper scripts (registration, QR, setup, monitoring control)
  - **`register-user.sh`**: Interactive registration with passphrase validation (v1.0.2)
  - **`monitor_control.sh`**: Unified producer/uploader control (v1.0.2)
  - `register-with-qr.sh`: QR code registration
  - `prepare_build.sh`: Auto-setup and watcher discovery
- `public/`: dashboard static assets
- `write_status.js`: Producer - watcher data collection
- `cloudflare-sync.js`: Uploader - encryption and sync
- `status-updater.js`, `static-server.js`: local operation support
- `docker-compose.yml`, `Dockerfile`: containerization and runtime hardening
- `.env`: Auto-generated credentials (created by `register-user.sh`, gitignored)
- `.cloudflare-config.json`: Registration metadata (auto-generated, gitignored)
- `README.md`: user documentation
- `.github/workflows`: CI and security scans

### 1.4 Registration and Access

Standard registration (v1.0.2 improvements):
- User obtains invite from admin
- Runs `BASE_URL="..." ./scripts/register-user.sh --invite CODE`
- **Interactive passphrase prompting**:
  - Enter passphrase (hidden input, minimum 8 characters)
  - Confirm passphrase (must match exactly)
  - Validation enforced before registration proceeds
- **Automatic credential management**:
  - Credentials written to `.env` with proper formatting
  - Timestamped backups of existing config files
  - `start-monitoring.sh` script auto-generated with credential loading
- **Security warnings displayed** about keeping `.env` secure
- Dashboard URL returned; user enters passphrase in client to decrypt
- **Ready to start monitoring** with `./scripts/monitor_control.sh start`

QR registration:
- `scripts/register-with-qr.sh` generates QR codes for mobile
- Optional: embed passphrase in URL fragment for auto-login (trade-off: convenience vs shoulder-surf risk)
- Fragment stays client-side; server never receives passphrase

Registration workflow robustness (v1.0.2):
- Temporary input file cleanup even on errors
- Config backup before overwrite (timestamped)
- Proper shell quoting throughout
- Cross-platform color support with fallbacks
- Health check before registration
- Dependency checking (curl, jq, node)

### 1.5 Monitoring Control (v1.0.2)

Unified monitoring via `monitor_control.sh`:

**Commands:**
- `start`: Start both producer (Docker) and uploader (host)
- `stop`: Gracefully stop both components with cleanup
- `status`: Show current state of producer and uploader
- `restart`: Stop and start both components
- (no args): Interactive menu for user-friendly operation

**Producer Management:**
- Uses `docker compose up -d` for proper restart policies
- Auto-removes stopped containers before starting
- Detects externally-started containers
- Supports custom container names via `CONTAINER_NAME` env var

**Uploader Management:**
- Runs as background host process
- PID tracking in `.run/uploader.pid`
- Graceful shutdown with 5-second timeout
- SIGKILL fallback for hung processes
- Reads credentials from `.env` (no secrets in command line)
- Health check of Worker before starting

**Advanced Options:**
- `--no-docker`: Skip producer, only manage uploader
- `--no-sync`: Skip uploader, only manage producer
- Custom `BASE_URL` via environment variable

**Integration:**
- Validates `.env` file exists and contains required variables
- Adopts externally-managed processes where possible
- Clear diagnostic output with status indicators
- CI-friendly with proper exit codes

### 1.6 Monitoring and Timers

Dual timers:
- System uptime timer (resets after >6 min silence)
- Data freshness timer (resets when watcher data changes)
- Status dot: green <5.5 min silence; orange 5.5–6 min; red >6 min

Uploader and status:
- `start-monitoring.sh` (auto-generated) reads credentials only from `.env`
- `cloudflare-sync.js` encrypts and uploads
- `write_status.js` manages status generation
- **`monitor_control.sh`** orchestrates the full stack (v1.0.2)

### 1.7 Deployment

Production path (recommended):
- Cloudflare Worker deployed via Wrangler
- Admin key stored as secret
- KV namespace for user metadata and encrypted blobs
- HTTPS enforced, rate-limiting available, invite-based onboarding
- **Users register with production Worker URL**
- **Monitor control manages local producer and uploader**

Local path (development/local ops):
- Static server serves `public/` with minimal security headers
- Compose binds to localhost by default (`127.0.0.1`)
- Healthcheck exposed at `/health`
- Wrangler dev on port 38472 for local Worker testing

### 1.8 Container and Runtime Hardening (current state)
- Non-root runtime (`USER node`)
- Read-only root filesystem (`read_only: true`)
- Capabilities dropped (`cap_drop: ALL`); only `SETUID/SETGID` added
- Loopback bind by default for host port exposure
- Resource limits and healthchecks configured
- No docker.sock mount (no privileged socket access)
- **Docker compose restart policies** respected (v1.0.2)

### 1.9 CI/CD
- Baseline CI (`ci.yml`) for install/build/syntax
- Security workflow (`security.yml`) runs npm audit, Trivy FS, Gitleaks, Semgrep on PR/push/weekly cron
- Current scans soft-fail; roadmap includes enforcement (fail-on-high/critical)

### 1.10 Recent Feature Highlights (v1.0.2)

**Registration Script Improvements:**
- Interactive passphrase prompting with hidden input
- Passphrase confirmation to prevent typos
- Minimum 8-character validation enforced
- Automatic `.env` file creation with proper formatting
- No more merged lines in `.env` (proper newline handling)
- Timestamped backups of existing config files
- Security warnings about `.env` file
- Auto-generation of `start-monitoring.sh` wrapper script
- Robust error handling and dependency checking

**Monitor Control Script:**
- New unified control script (`monitor_control.sh`)
- Manages both producer (Docker) and uploader (host)
- Commands: start, stop, status, restart
- Interactive menu mode when no command specified
- Docker compose integration (respects restart policies)
- Graceful shutdown with timeout and fallback
- Auto-detection of externally-started processes
- PID file management for uploader
- Advanced flags: `--no-docker`, `--no-sync`
- Clear status output with emoji indicators

**Previous Highlights (v1.0.1):**
- QR registration flow with optional passphrase embedding
- `prepare_build.sh` shows LAN URL in QR; removes redundant prompts when `SHOW_QR=1`
- Timer display unified to `00H 00M 00S`
- Repository cleanup and .gitignore hardening

### 1.11 Admin and Limits
- Admin endpoints (invite creation, stats, user management) require `x-admin-key`
- Usage guidance for Cloudflare free tier; polling and upload patterns documented
- **Simplified invite creation workflow** for new users

### 1.12 Troubleshooting (selected)

**Registration Issues:**
- "Passphrases do not match": Retype carefully during confirmation
- "Passphrase must be at least 8 characters": Use longer passphrase
- "Registration failed - config not created": Check Worker health, invite validity
- Network errors: Verify BASE_URL and Worker accessibility

**Monitor Control Issues:**
- "Error: .env file not found": Run `register-user.sh` first
- "Error: BASE_URL not set in .env": Re-run registration or manually add
- Producer not starting: Check Docker availability and permissions
- Uploader stuck: Verify BASE_URL in `.env` matches Worker location
- Container conflicts: Use `./scripts/monitor_control.sh restart`

**General Issues:**
- "Cannot decrypt": Check passphrase, ensure uploader running and first upload elapsed
- QR issues: Ensure LAN binding or use QR script; consider incognito to avoid autofill collisions

---

## 2) Forward-Looking Roadmap

Goal: continue hardening, introduce self-reporting (volume-based reports), add Node Monitoring, per-watcher Statistics, and Alerts.

### 2.1 Registration Script Enhancements (Future)

Based on code review feedback, potential improvements for `register-user.sh`:

**Priority: Medium (Quality of Life)**

1. **Passphrase Strength Checking** (optional enhancement)
   - Add optional passphrase strength meter/validation
   - Check for: special characters, numbers, mixed case
   - Provide feedback: "Weak", "Moderate", "Strong"
   - Non-blocking (user can proceed with warning)
   - Acceptance: Strength indicator shown; users can override

2. **Invite Code Format Validation** (client-side)
   - Validate invite code format before sending to server
   - Expected format: `INVITE-XXXXXX-XXXXXX` (adjust to actual format)
   - Fail fast on obviously invalid codes
   - Reduces unnecessary server round-trips
   - Acceptance: Invalid formats rejected locally with helpful message

3. **Network Retry Logic** (reliability)
   - Add configurable retry logic for network operations
   - Retry registration API call on transient failures
   - Exponential backoff: 1s, 2s, 4s (max 3 attempts)
   - Distinguish between retryable (timeout, 5xx) vs non-retryable (401, 404) errors
   - Acceptance: Transient network failures auto-retry; permanent failures fail fast

4. **Verbose/Debug Mode** (troubleshooting)
   - Add `--verbose` or `--debug` flag
   - Show detailed HTTP requests/responses
   - Display credential generation steps
   - Helpful for debugging registration issues
   - Acceptance: `--verbose` flag shows detailed diagnostic output

5. **Passphrase Generation Helper** (security)
   - Add `--generate-passphrase` option
   - Generate cryptographically secure random passphrase
   - Format: 4-6 random words or 20+ character alphanumeric
   - Display generated passphrase and prompt to save it
   - Acceptance: Generated passphrases meet strength requirements

**Implementation Sketch:**

```bash
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
    die "Invalid invite code format. Expected: INVITE-XXXXXX-XXXXXX"
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
```

**Current Status (v1.0.2):**
- ✅ Interactive passphrase prompting with confirmation
- ✅ Minimum length validation (8 characters)
- ✅ Automatic .env creation and formatting
- ✅ Timestamped config backups
- ✅ Proper error handling
- ✅ Dependency checking
- ✅ Cross-platform color support
- ⏳ Passphrase strength checking (future)
- ⏳ Invite code format validation (future)
- ⏳ Network retry logic (future)
- ⏳ Verbose/debug mode (future)
- ⏳ Passphrase generation helper (future)

### 2.2 Start-Monitoring Script Strategy (Decision Needed)

**Context:**
The project currently has two ways to start monitoring:
1. `start-monitoring.sh` - Auto-generated simple wrapper (uploader only, foreground)
2. `scripts/monitor_control.sh` - Full orchestration tool (producer + uploader, lifecycle management)

**Current State:**
- `register-user.sh` generates `start-monitoring.sh` (lines 111-134)
- Success message mentions "Created: start-monitoring.sh" (line 140)
- But final instruction recommends: `./scripts/monitor_control.sh start` (line 147)
- This creates confusion: script generates one tool but recommends another

**Priority: Low (Documentation/UX consistency)**

**Option 1: Keep Both Scripts (Backward Compatibility)**
- Continue generating `start-monitoring.sh`
- Update success message to explain both options:
  ```
  ✓ Created: start-monitoring.sh (simple uploader wrapper)
  
  Two ways to start monitoring:
  
  Recommended: ./scripts/monitor_control.sh start
    - Full stack management (producer + uploader)
    - Background processes with lifecycle control
    
  Alternative: ./start-monitoring.sh
    - Uploader only (assumes producer running)
    - Foreground process for debugging
  ```
- Add note in README explaining the difference
- Acceptance: Users understand when to use each script

**Option 2: Stop Generating start-monitoring.sh (Simplification)**
- Remove lines 111-134 (script generation)
- Remove line 140 (success message about script)
- Only recommend `monitor_control.sh`
- Add deprecation notice in README for existing users
- Acceptance: New users only see one way to start; docs explain migration

**Option 3: Make start-monitoring.sh a Wrapper (Hybrid)**
- Keep generating `start-monitoring.sh`
- Change it to call `monitor_control.sh` instead:
  ```bash
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
  ```
- Users can use either script (same result)
- Acceptance: Both scripts work identically; no confusion

**Option 4: Consolidate Credential Sources (Long-term Architecture)**
- Currently split between `.cloudflare-config.json` and `.env`
- `monitor_control.sh` reads `.cloudflare-config.json` + `DASH_PASSPHRASE` env
- `start-monitoring.sh` reads `.env` (everything in one place)
- Decision needed: standardize on one approach
  - **Approach A:** Everything in `.env`, remove `.cloudflare-config.json`
  - **Approach B:** Everything in `.cloudflare-config.json`, deprecate `.env`
  - **Approach C:** Keep split but document clearly (status quo)
- Update both scripts to use same credential source
- Acceptance: Consistent credential management; clear documentation

**Recommended Approach (Staged):**

**Phase 1 (Quick fix - v1.0.3):**
- Implement Option 1 (keep both, explain difference)
- Update success message with clear guidance
- Add comparison table to README
- Timeline: 1-2 hours

**Phase 2 (If we want simplification - v1.1.0):**
- Decide on Option 3 (wrapper) or Option 2 (remove)
- If choosing wrapper, update generated script
- Update all documentation
- Timeline: 2-4 hours

**Phase 3 (Long-term cleanup - v2.0.0):**
- Implement Option 4 (credential consolidation)
- Breaking change, requires migration guide
- Timeline: 1-2 weeks (includes testing)

**Current Status:**
- ⏸️ Paused for decision
- 📋 Documented options for future consideration
- 🎯 Recommendation: Phase 1 (explain both) for now

### 2.3 Security Roadmap (Phased, with acceptance criteria)

Phase A — Immediate hardening (Weeks 1–2)
- Self-Reporting Aggregation (volume-based)
  - Add `/reports/<watcher>.json` aggregator behind `ENABLE_REPORTS=1`
  - Sample reporter writes atomically (`.tmp` then rename)
  - `PREFER_REPORTS=1` to prefer `/reports` over discovery
  - Acceptance: 24h parity with current discovery

- Container hardening (compose)
  - Add `security_opt: ["no-new-privileges:true"]`
  - Add `tmpfs: /tmp:rw,noexec,nosuid,nodev,size=32M`
  - Acceptance: no regressions; writable paths confined to volumes/tmpfs

- Local static server headers
  - Add minimal security headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
  - Acceptance: headers verified locally

Phase B — Validation & Injection defenses (Weeks 2–3)
- Input/config validation (strict regex, fail-fast)
- API response validation (shape checks, counters for invalids)
- Static path traversal protection for any computed paths
- Acceptance: tests cover invalid cases; no shell interpolation of untrusted input

Phase C — CI/CD enforcement and image scanning (Week 3–4)
- Fail on High/Critical: npm audit (prod only), Trivy FS, Semgrep, Gitleaks
- Optional: build image and run Trivy image scan
- Expand SECURITY.md; add on-prem reverse proxy overlay doc (TLS/auth/rate limit)
- Acceptance: required checks block merges; docs updated

Phase D — Optional: deprecate discovery post-parity
- Remove discovery after self-reporting stable; drop `docker-cli` from image
- Acceptance: codebase no longer relies on discovery; image footprint reduced

### 2.4 Product/UX: Node Monitoring (Blockchain Nodes)

Scope:
- Track each blockchain node used by watchers (local or public RPCs)
- Dashboard summary with health dots; dedicated Nodes page with details

Collection and health:
- Poll RPCs per chain (Ergo, Bitcoin-like, EVM-like)
- Compare node height vs trusted tip to compute lag
- Classify: healthy/degraded/down based on lag, latency, peers (thresholds configurable)

Acceptance:
- Nodes appear with status dots on dashboard
- Nodes page details height, tip, lag, peers, version, latency
- Out-of-sync flagged within 2 intervals; public RPC outages handled gracefully

Minimal data model (example):
```json
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
```

### 2.5 Product/UX: Health Statistics (Watchers)

Scope:
- "Statistics" page with per-watcher uptime %, error counts, latency (avg/p95), stale windows
- Aggregated insights (sparklines, top unstable watchers)
- JSON/CSV export

Collection:
- Extend write_status.js to track counters and timings
- Maintain rolling series in memory; persist summarized stats to public/stats.json
- Optional /metrics for Prometheus later

Acceptance:
- Stats page renders uptime, errors, latency
- Staleness visible; stats persist or recompute on restart

### 2.6 Alerts and Notifications (Watchers and Nodes)

Triggers (configurable):
- Watchers: consecutive failures, stale > X min, error rate > threshold
- Nodes: lag > Y blocks for Z intervals, RPC timeouts, low peers sustained

Channels:
- Webhooks (generic JSON POST), Slack, Discord, Email (optional)
- Future: Telegram/Matrix
- Multiple channels with per-rule routing

Payload example:
```json
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
```

Config sketch:
```json
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
```

Acceptance:
- Alerts fire + debounce; recovery notifications sent
- Multi-channel routing works; rate limits honored

### 2.7 Implementation Snippets (for later application)

Compose hardening:
```yaml
services:
  rosen-monitor:
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=32M
```

CI security enforcement:
```yaml
    - name: Security audit (prod deps)
      run: npm audit --omit=dev --audit-level=high

    - name: Run Trivy vulnerability scan (FS)
      run: trivy fs --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed --quiet .

    - name: Run Gitleaks secret scan
      run: gitleaks detect --source . --redact --exit-code 1

    - name: Run Semgrep static analysis
      run: semgrep --config p/ci --severity=ERROR --error --quiet .
```

Optional Trivy image scan:
```yaml
    - name: Build Docker image
      run: docker build -t ghcr.io/${{ github.repository }}:ci-${{ github.sha }} --build-arg DOCKER_GID=999 .

    - name: Trivy image scan
      run: trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed ghcr.io/${{ github.repository }}:ci-${{ github.sha }}
```

Local static server headers (Phase A):
```javascript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Referrer-Policy', 'no-referrer');
res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'");
```

Path traversal guard:
```javascript
const safeBase = path.resolve(PUBLIC_DIR);
const safePath = path.resolve(safeBase, path.normalize(requestedPath));
if (!safePath.startsWith(safeBase)) {
  res.statusCode = 400;
  return res.end('Bad request');
}
```

Dockerfile simplification (question for future cleanup):
- The Dockerfile creates a monitor user but runs as USER node with chown -R node:node /app. Either:
  - Remove monitor user creation and related chown, standardize on node:node; or
  - Switch to USER monitor and ensure volumes UID/GID match.
- Also consider removing docker-cli when discovery is fully replaced by self-reporting.

### 2.8 Priorities and Timeline

**Immediate (v1.0.2 - Completed):**
- ✅ Interactive passphrase setup with confirmation
- ✅ Automatic .env management
- ✅ Unified monitor control script
- ✅ Docker compose integration

**Quick Wins (v1.0.3 - Optional):**
- 📋 start-monitoring.sh strategy (Phase 1: document both options)
- Update success message with clear guidance
- Add comparison table to README

**Week 1–2:**
- Self-reporting aggregator
- Compose hardening
- Local headers
- (Optional) Registration script enhancements: invite validation, verbose mode
- (Optional) start-monitoring.sh decision implementation

**Week 2–3:**
- Validation/defenses
- Initial Node Monitoring
- Permit/balance UX
- (Optional) Registration script enhancements: retry logic, passphrase strength

**Week 3–4:**
- CI enforcement
- SECURITY.md expansion
- Optional on-prem proxy overlay doc
- (Optional) Registration script enhancements: passphrase generation

**Post-4:**
- Flip PREFER_REPORTS=1
- Consider removing discovery/docker-cli
- Optional Prometheus metrics
- Structured logs
- Health statistics page
- Alerts and notifications

**Long-term (v2.0.0):**
- (Optional) start-monitoring.sh Phase 3: credential consolidation
- Breaking changes with migration guide

---

## 3) Contribution Guidance

PRs must pass enforced security scans; no secrets in commits
Security fixes require tests and reference to roadmap items
UX contributions include a short mock and acceptance criteria

**For registration script enhancements:**
- Maintain backward compatibility
- Add tests for new validation logic
- Document new flags in README
- Follow existing error handling patterns
- Ensure cross-platform compatibility (Linux, macOS)
