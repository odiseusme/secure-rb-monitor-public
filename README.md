# Secure RB Monitor (Public Baseline)

A lightweight monitoring and status publishing component related to Rosen Bridge infrastructure (early public snapshot).  
Current focus:
- Minimal web status UI (`public/` assets + `static-server.js`)
- Periodic status updating (`status-updater.js`, `write_status.js`)
- Simple bootstrap scripts for local / container usage

> Status: v0.1.1 (docs + Docker hardening updates). Expect rapid iteration; APIs & structure may evolve.

## Table of Contents
- [Purpose](#purpose)
- [Non-Goals (Now)](#non-goals-now)
- [Quick Start](#quick-start)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone](#2-clone)
  - [3. Create Runtime Config](#3-create-runtime-config)
  - [4. Select / Reserve a Host Port (Recommended)](#4-select--reserve-a-host-port-recommended)
  - [5. Run via docker-compose (Preferred)](#5-run-via-docker-compose-preferred)
    - [5.1 Optional: Persistence & Logs](#51-optional-persistence--logs)
    - [5.2 Restart Policy](#52-restart-policy)
  - [6. Run via Docker (Direct Alternative)](#6-run-via-docker-direct-alternative)
    - [6.1 Reviewer-Friendly Automated Port Selection](#61-reviewer-friendly-automated-port-selection)
    - [6.2 Persistence (Optional)](#62-persistence-optional)
    - [6.3 Troubleshooting](#63-troubleshooting)
  - [7. Run Locally (Two Processes)](#7-run-locally-two-processes)
  - [8. One-Off Manual Status Update](#8-one-off-manual-status-update)
  - [9. Show URL Helper](#9-show-url-helper)
  - [10. Updating Status While Running](#10-updating-status-while-running)
  - [11. Next Steps](#11-next-steps)
- [Configuration](#configuration)
- [Architecture Overview](#architecture-overview)
  - [Core Data Flow](#core-data-flow)
  - [Scripts](#scripts)
  - [Docker](#docker)
  - [Potential Future Enhancements](#potential-future-enhancements)
- [Project Layout](#project-layout)
- [Development Workflow](#development-workflow)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Purpose
Provide an openly reviewable starting point for the Rosen Bridge ecosystem monitor. Enables:
- Local or containerized deployment
- Periodic retrieval / formatting of token / balance / status data
- Basic static hosting of status artifacts or UI

## Non-Goals (Now)
- Production-hardening (HA, clustering)
- Advanced auth / RBAC
- Observability (structured metrics / log shipping)
- Comprehensive test suite (placeholder only)

## Quick Start

### 1. Prerequisites
- Node.js (LTS) OR Docker
- Bash (for helper scripts)
- (Optional) `qrencode` if you want a QR code for the chosen URL
- (Optional) `curl` (already present inside container image for healthcheck)

### 2. Clone
```bash
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public
```

### 3. Create Runtime Config
```bash
mkdir -p config
cp config.json.example config/config.json
# Edit values if needed
```

### 4. Select / Reserve a Host Port (Recommended)
The helper script picks an available port (starts at 8080 by default), writes/updates `.env` (`HOST_PORT`, `HOST_IP`, fallback `MONITOR_PORT`), and prints accessible URLs.

```bash
./scripts/select_host_port.sh
# Re-run with force:
FORCE=1 ./scripts/select_host_port.sh
```

Options:
- Bind all interfaces (instead of only localhost):
  ```bash
  BIND_ALL=1 ./scripts/select_host_port.sh
  ```
- Auto-open browser:
  ```bash
  OPEN_BROWSER=1 ./scripts/select_host_port.sh
  ```
- Show QR code (needs `qrencode`):
  ```bash
  SHOW_QR=1 ./scripts/select_host_port.sh
  ```

If you skip this step:
- Default attempt: host port 8080 (fails if already in use).

---

### 5. Run via docker-compose (Preferred)
Reproducible and sets restart policy + volume mounts.

```bash
./scripts/select_host_port.sh   # optional but recommended
docker compose up -d --build
```

Access:
```
http://localhost:${HOST_PORT:-8080}/
```

Your `docker-compose.yml` (excerpt):
```yaml
services:
  rosen-monitor:
    build: .
    restart: always
    ports:
      - "${HOST_IP:-127.0.0.1}:${HOST_PORT:-8080}:8080"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./config:/app/config
```

#### 5.1 Optional: Persistence & Logs
(If not already created)
```bash
mkdir -p data logs config
cp config.json.example config/config.json  # if not done
```

#### 5.2 Restart Policy
- `always`: restarts container even after manual `docker stop` if daemon restarts.
- `unless-stopped`: similar, but respects a manual stop across daemon restarts.

Change (if desired):
```yaml
restart: unless-stopped
```
Recreate:
```bash
docker compose up -d
```

---

### 6. Run via Docker (Direct Alternative)
If you prefer not to use Compose.

Build:
```bash
docker build -t rb-monitor .
```

Simple run (assumes 8080 free):
```bash
docker run -d \
  --name rb-monitor \
  --restart unless-stopped \
  -p 8080:8080 \
  rb-monitor
```

#### 6.1 Reviewer-Friendly Automated Port Selection
```bash
./scripts/select_host_port.sh
export $(grep HOST_PORT .env | xargs)
docker run -d \
  --name rb-monitor \
  --restart unless-stopped \
  -p ${HOST_PORT:-8080}:8080 \
  rb-monitor
```

#### 6.2 Persistence (Optional)
```bash
mkdir -p monitor-data monitor-logs config
cp config.json.example config/config.json  # if not done yet

./scripts/select_host_port.sh
export $(grep HOST_PORT .env | xargs)

docker run -d \
  --name rb-monitor \
  --restart unless-stopped \
  -p ${HOST_PORT:-8080}:8080 \
  -v "$(pwd)/monitor-data":/app/data \
  -v "$(pwd)/monitor-logs":/app/logs \
  -v "$(pwd)/config":/app/config \
  rb-monitor
```

#### 6.3 Troubleshooting
- Port already in use → rerun `./scripts/select_host_port.sh`.
- Not reachable after reboot → check Docker daemon & restart policy.
- Inspect container:
  ```bash
  docker ps -a --filter name=rb-monitor
  docker logs rb-monitor --tail 50
  ```

---

### 7. Run Locally (Two Processes)
Terminal A:
```bash
node static-server.js
```
Terminal B:
```bash
node status-updater.js
```
Access:
```
http://localhost:8080
```

### 8. One-Off Manual Status Update
```bash
node write_status.js
```

### 9. Show URL Helper
```bash
./scripts/show_monitor_url.sh
```

### 10. Updating Status While Running
Triggers immediate refresh:
```bash
node write_status.js
```

### 11. Next Steps
- Extend data sources (`status-updater.js`, `write_status.js`)
- Add metrics / structured logging
- Harden security (see notes below)
- Open focused issues / PRs

---

## Configuration
Example:
```bash
mkdir -p config
cp config.json.example config/config.json
```
Environment overrides (see `.env.example`) via:
- `.env` (auto used by docker-compose)
- `docker run --env-file <file>`
- Shell exports

`config/config.json` is environment-specific and not committed.

---

## Architecture Overview

### Core Data Flow
1. `status-updater.js` schedules/triggers collection.
2. `write_status.js` gathers data → writes artifacts.
3. `static-server.js` serves `public/` + generated artifacts.

### Scripts
- `scripts/bootstrap.sh`: environment sanity
- `scripts/serve_public.sh`: wrapper for static server
- `scripts/select_host_port.sh`: dynamic port selection + `.env` management
- `scripts/show_monitor_url.sh`: prints URLs

### Docker
Container image:
- Based on `node:20-alpine`
- Non-root user `monitor` (UID 1001)
- `docker-entrypoint.sh` adjusts group perms to allow non-root access to `docker.sock` if mounted; then drops privileges with `su-exec`.
- HEALTHCHECK hits `/health`.
- Volumes recommended for `data`, `logs`, `config`.

Security note: Mounting the Docker socket grants broad host introspection. Only do this in trusted, controlled environments.

### Potential Future Enhancements
- Pluggable collector framework
- Metrics exporter (Prometheus / OTEL)
- TypeScript migration
- Structured logging + rotation / remote sink

---

## Project Layout
```
.
├── public/                # Static assets
├── scripts/               # Helper scripts
├── status-updater.js      # Periodic orchestration
├── write_status.js        # Data collection & artifact writing
├── static-server.js       # Lightweight HTTP server
├── docker-entrypoint.sh   # Runtime privilege drop + socket group alignment
├── config.json.example    # Sample runtime config
├── config/                # Actual runtime config (ignored)
├── docker-compose.yml
└── Dockerfile
```

---

## Development Workflow
1. Install Node (or rely on Docker)
2. Copy config example → working config
3. `npm install`
4. Run server + updater (or Compose)
5. Edit code, re-run processes
6. (Optional) Add tests / linting

CI: GitHub Actions (baseline soon).

---

## Security
See `SECURITY.md` for reporting and hardening roadmap.  
Non-root container + dynamic docker group join reduces friction but does not remove risks of a mounted `docker.sock`.

---

## Contributing
See `CONTRIBUTING.md` for branching, commit style, and review expectations.

## License
MIT – see `LICENSE`.

---
> Feedback (especially from Rosen Bridge core maintainers) is welcome—open focused issues or PRs.
