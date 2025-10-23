# Rosen Bridge Monitor — Complete Docs and Roadmap

Last updated: 2025-10-23

## 1) Complete Project Documentation (Updated)

### 1.1 Purpose and Overview
Rosen Bridge Monitor provides a secure, zero-knowledge remote monitoring dashboard for Rosen Bridge watchers. It supports local or remote operation. Sensitive data remains encrypted end-to-end; the server never sees decrypted content.

Key capabilities:
- Zero-knowledge architecture with client-side decryption (AES-GCM; keys derived via PBKDF2-SHA256)
- Remote dashboard served via Cloudflare Worker or local static server
- Invitation-based registration (admin-controlled)
- QR code registration for quick mobile onboarding (optional passphrase embedding)
- Automated status uploads via secure scripts
- Mobile-responsive UI, dual timers for uptime and data freshness

### 1.2 Architecture and Data Flow

High-level flow:
- Uploader encrypts status → sends to Worker (or serves locally)
- Dashboard fetches encrypted blob → decrypts in browser → renders

Components:
- Cloudflare Worker + KV Storage (production path, HTTPS, rate limit, invite flows)
- Static local server (development/local path)
- Upload/monitor scripts (Node + shell) handling encryption + transport
- Client web UI that decrypts and displays status

Security model:
- AES-GCM 256-bit encryption
- PBKDF2-SHA256 key derivation (iterations per policy)
- Salt stored in KV; passphrase never leaves client
- CSP and security headers enforced at proxy/Worker; local server to set minimal headers

### 1.3 Repository Structure (current)
- worker/mute-mouse-2cd2: Cloudflare Worker source and config
- scripts/: helper scripts (registration, QR, setup)
- public/: dashboard static assets
- write_status.js, status-updater.js, static-server.js: local operation
- docker-compose.yml, Dockerfile: containerization and runtime hardening
- README.md: user documentation
- .github/workflows: CI and security scans

### 1.4 Registration and Access

Standard registration:
- User obtains invite; runs `setup-cloudflare.js`
- Credentials written to `.env` and `.cloudflare-config.json` (not tracked)
- Dashboard URL returned; user enters passphrase in client to decrypt

QR registration:
- `scripts/register-with-qr.sh` generates QR codes for mobile
- Optional: embed passphrase in URL fragment for auto-login (trade-off: convenience vs shoulder-surf risk)
- Fragment stays client-side; server never receives passphrase

### 1.5 Monitoring and Timers

Dual timers:
- System uptime timer (resets after >6 min silence)
- Data freshness timer (resets when watcher data changes)
- Status dot: green <5.5 min silence; orange 5.5–6 min; red >6 min

Uploader and status:
- `start-monitoring.sh` reads credentials only from `.env`
- `cloudflare-sync.js` encrypts and uploads
- `write_status.js` and `status-updater.js` manage status generation/update cadence

### 1.6 Deployment

Production path (recommended):
- Cloudflare Worker deployed via Wrangler
- Admin key stored as secret
- KV namespace for user metadata and encrypted blobs
- HTTPS enforced, rate-limiting available, invite-based onboarding

Local path (development/local ops):
- Static server serves `public/` with minimal security headers
- Compose binds to localhost by default (`127.0.0.1`)
- Healthcheck exposed at `/health`

### 1.7 Container and Runtime Hardening (current state)
- Non-root runtime (`USER node`)
- Read-only root filesystem (`read_only: true`)
- Capabilities dropped (`cap_drop: ALL`); only `SETUID/SETGID` added
- Loopback bind by default for host port exposure
- Resource limits and healthchecks configured
- No docker.sock mount (no privileged socket access)

### 1.8 CI/CD
- Baseline CI (`ci.yml`) for install/build/syntax
- Security workflow (`security.yml`) runs npm audit, Trivy FS, Gitleaks, Semgrep on PR/push/weekly cron
- Current scans soft-fail; roadmap includes enforcement (fail-on-high/critical)

### 1.9 Recent Feature Highlights (v1.0.1)
- QR registration flow with optional passphrase embedding
- `prepare_build.sh` shows LAN URL in QR; removes redundant prompts when `SHOW_QR=1`
- `.env`-only credential sourcing for uploader; secrets removed from scripts
- Timer display unified to `00H 00M 00S`
- Repository cleanup and .gitignore hardening

### 1.10 Admin and Limits
- Admin endpoints (invite creation, stats, user management) require `x-admin-key`
- Usage guidance for Cloudflare free tier; polling and upload patterns documented

### 1.11 Troubleshooting (selected)
- “Cannot decrypt”: check passphrase, ensure uploader running and first upload elapsed
- QR issues: ensure LAN binding or use QR script; consider incognito to avoid autofill collisions

---

## 2) Forward-Looking Roadmap

Goal: continue hardening, introduce self-reporting (volume-based reports), add Node Monitoring, per-watcher Statistics, and Alerts.

### 2.1 Security Roadmap (Phased, with acceptance criteria)

Phase A — Immediate hardening (Weeks 1–2)
- Self‑Reporting Aggregation (volume-based)
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
- Expand SECURITY.md; add on‑prem reverse proxy overlay doc (TLS/auth/rate limit)
- Acceptance: required checks block merges; docs updated

Phase D — Optional: deprecate discovery post-parity
- Remove discovery after self-reporting stable; drop `docker-cli` from image
- Acceptance: codebase no longer relies on discovery; image footprint reduced

### 2.2 Product/UX: Node Monitoring (Blockchain Nodes)

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

2.3 Product/UX: Health Statistics (Watchers)

Scope:

“Statistics” page with per-watcher uptime %, error counts, latency (avg/p95), stale windows
Aggregated insights (sparklines, top unstable watchers)
JSON/CSV export

Collection:

Extend write_status.js to track counters and timings
Maintain rolling series in memory; persist summarized stats to public/stats.json
Optional /metrics for Prometheus later

Acceptance:

Stats page renders uptime, errors, latency
Staleness visible; stats persist or recompute on restart
2.4 Alerts and Notifications (Watchers and Nodes)

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
2.5 Implementation Snippets (for later application)

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


Local static server headers (Path A):

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
2.6 Priorities and Timeline
Week 1–2: Self-reporting aggregator; compose hardening; local headers
Week 2–3: Validation/defenses; initial Node Monitoring; permit/balance UX
Week 3–4: CI enforcement; SECURITY.md; optional on‑prem proxy overlay doc
Post‑4: Flip PREFER_REPORTS=1; consider removing discovery/docker-cli; optional Prometheus metrics, structured logs
3) Contribution Guidance
PRs must pass enforced security scans; no secrets in commits
Security fixes require tests and reference to roadmap items
UX contributions include a short mock and acceptance criteria



