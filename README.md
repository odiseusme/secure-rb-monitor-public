# Secure RB Monitor (Public Baseline)

A lightweight monitoring and status publishing component related to Rosen Bridge infrastructure (early public snapshot).  
Current focus:
- Minimal web status UI (`public/` assets + `static-server.js`)
- Periodic status updating (`status-updater.js`, `write_status.js`)
- Simple bootstrap scripts for local / container usage

> Status: Initial public baseline (v0.1.0). Expect rapid iteration; APIs & structure may evolve.

## Table of Contents
- [Purpose](#purpose)
- [Non-Goals (Now)](#non-goals-now)
- [Quick Start](#quick-start)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone](#2-clone)
  - [3. Create Runtime Config](#3-create-runtime-config)
  - [4. Select / Reserve a Host Port (Recommended)](#4-select--reserve-a-host-port-recommended)
  - [5. Install Dependencies (Local)](#5-install-dependencies-local)
  - [6. Run Locally (Two Processes)](#6-run-locally-two-processes)
  - [7. One-Off Manual Status Update](#7-one-off-manual-status-update)
  - [8. Run via Docker (Direct)](#8-run-via-docker-direct)
  - [9. Run via docker-compose](#9-run-via-docker-compose)
  - [10. Show URL Helper](#10-show-url-helper)
  - [11. Updating Status While Running](#11-updating-status-while-running)
  - [12. Next Steps](#12-next-steps)
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
- (Optional) `qrencode` if you want QR output when choosing a port

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
The helper script picks an available port (starts at 8080 by default), writes/updates `.env` (`HOST_PORT`, optional `HOST_IP`, `MONITOR_PORT` fallback, etc.), and prints accessible URLs.

```bash
./scripts/select_host_port.sh
# Re-run with FORCE=1 to force re-selection:
# FORCE=1 ./scripts/select_host_port.sh
```

Options:
- Bind all interfaces (instead of localhost):
  ```bash
  BIND_ALL=1 ./scripts/select_host_port.sh
  ```
- Auto-open browser (where supported):
  ```bash
  OPEN_BROWSER=1 ./scripts/select_host_port.sh
  ```
- Show QR (if `qrencode` installed):
  ```bash
  SHOW_QR=1 ./scripts/select_host_port.sh
  ```

If you skip this step:
- Defaults: exposed host port 8080 (unless already occupied).

### 5. Install Dependencies (Local)
```bash
npm install
```

### 6. Run Locally (Two Processes)
Terminal A (static file server):
```bash
node static-server.js
```
Terminal B (status updater / periodic writer):
```bash
node status-updater.js
```
Access: `http://localhost:8080` (or the `HOST_PORT` chosen by the selection script).

### 7. One-Off Manual Status Update
```bash
node write_status.js
```

### 8. Run via Docker (Direct)
If you already ran `./scripts/select_host_port.sh`, `.env` holds `HOST_PORT`. Otherwise expose 8080.

```bash
docker build -t rb-monitor .
# Use selected host port:
source .env
docker run -p ${HOST_PORT:-8080}:8080 --name rbm rb-monitor
```

### 9. Run via docker-compose
Reads `.env` for `HOST_PORT` / `HOST_IP`.

```bash
./scripts/select_host_port.sh   # ensure .env is populated
docker compose up --build
```

### 10. Show URL Helper
```bash
./scripts/show_monitor_url.sh
```

### 11. Updating Status While Running
(Triggers a fresh write outside the scheduled interval.)
```bash
node write_status.js
```

### 12. Next Steps
- Extend data sources in `status-updater.js` / `write_status.js`
- Adjust resource limits in `docker-compose.yml`
- Explore adding structured logs or metrics
- Open issues / PRs for enhancements

## Configuration
A canonical example is in `config.json.example`.  
You MUST create a runtime config (ignored by git):
```bash
mkdir -p config
cp config.json.example config/config.json
```
Environment overrides (see `.env.example`) can be supplied via:
- `docker-compose.yml` (env file)
- `docker run --env-file`
- Exported shell variables

We intentionally do **not** commit `config/config.json` to avoid stale / environment-specific values.

## Architecture Overview

### Core Data Flow
1. `status-updater.js` schedules or triggers state collection.
2. `write_status.js` performs balance / token / misc retrieval and writes structured outputs (JSON or text) to a served directory or stderr/stdout.
3. `static-server.js` exposes the `public/` directory (and generated artifacts) over HTTP.

### Scripts
- `scripts/bootstrap.sh`: environment sanity + dependency pre-run
- `scripts/serve_public.sh`: convenience wrapper for static server
- `scripts/select_host_port.sh`: chooses an available port or respects configured one (writes `.env`)
- `scripts/show_monitor_url.sh`: prints final accessible URL

### Docker
- `Dockerfile` constructs a minimal runtime
- `docker-compose.yml` local orchestration
- `.dockerignore` trims build context

### Potential Future Enhancements
- Plugin interface for data collectors
- Metrics exporter (Prometheus / OTEL)
- TypeScript migration
- Structured logging + rotation / remote shipping

## Project Layout
```
.
├── public/                # Static assets for UI
├── scripts/               # Operational helper scripts
├── status-updater.js      # Orchestrates periodic updates
├── write_status.js        # Logic for collecting & writing data
├── static-server.js       # Lightweight HTTP file server
├── config.json.example    # Config sample (copy into config/config.json)
├── config/                # Runtime config dir (ignored)
├── docker-compose.yml
└── (Dockerfile, etc.)
```

## Development Workflow
1. Install Node (or use Docker)
2. Copy config example -> working config
3. `npm install`
4. Start: `node static-server.js` + `node status-updater.js`
5. Modify code, re-run processes

CI: GitHub Actions (baseline lint / syntax; more later).

## Security
See `SECURITY.md` for reporting instructions and hardening roadmap.

## Contributing
Guidelines, branching, and commit conventions are in `CONTRIBUTING.md`.

## License
MIT – see `LICENSE`.

---
> Feedback (especially from Rosen Bridge core maintainers) is welcome—open focused issues or PRs.
