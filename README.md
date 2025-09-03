# Secure RB Monitor (Public Baseline)

A lightweight monitoring and status publishing component for the Watchers of the Rosen Bridge infrastructure (early public snapshot).

_Current focus:_
- Minimal web status UI (`public/` assets + `static-server.js`)
- Periodic status updating (`status-updater.js`, `write_status.js`)
- Simple bootstrap scripts for local/container usage

> Status: v0.2 (docs + Docker hardening updates). Expect rapid iteration; APIs & structure may evolve.

## Table of Contents
- [Purpose](#purpose)
- [Non-Goals (Now)](#non-goals-now)
- [Quick Start](#quick-start)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone](#2-clone)
  - [3. Create Runtime Config](#3-create-runtime-config)
  - [4. Prepare Build Setup (Recommended)](#4-prepare-build-setup-recommended)
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
- [🛡️ Docker Security Hardening (Best Practice)](#docker-security-hardening-best-practice)
- [Contributing](#contributing)
- [License](#license)

## Purpose
Openly reviewable starting point for Rosen Bridge ecosystem monitor. Enables:
- Local or containerized deployment
- Periodic retrieval/formatting of token/balance/status data
- Basic static hosting of status artifacts or UI

## Non-Goals (Now)
- Production-hardening (HA, clustering)
- Advanced auth / RBAC
- Observability (structured metrics/log shipping)
- Comprehensive test suite (placeholder only)

## Quick Start

### 1. Prerequisites
- Node.js (LTS) OR Docker
- Bash (for helper scripts)
- (Optional) `qrencode` for QR code output
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

### 4. Prepare Build Setup (Recommended)
The helper script (`prepare-build.sh`) selects an available port (starting at 8080 by default), updates `.env` (`HOST_PORT`, `HOST_IP`, fallback `MONITOR_PORT`), and prints accessible URLs.

```bash
./scripts/prepare-build.sh
# Force rerun:
FORCE=1 ./scripts/prepare-build.sh
```

Options:
- Bind all interfaces:  
  ```bash
  BIND_ALL=1 ./scripts/prepare-build.sh
  ```
- Auto-open browser:  
  ```bash
  OPEN_BROWSER=1 ./scripts/prepare-build.sh
  ```
- Show QR code (needs `qrencode`):  
  ```bash
  SHOW_QR=1 ./scripts/prepare-build.sh
  ```

If you skip this step:
- Default attempt: host port 8080 (fails if already in use).

---

### 5. Run via docker-compose (Preferred)
Reproducible and sets restart policy + volume mounts.

```bash
./scripts/prepare-build.sh
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
      - ./public:/app/public
```

#### 5.1 Optional: Persistence & Logs
(If not already created)
```bash
mkdir -p data logs config public
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
./scripts/prepare-build.sh
export $(grep HOST_PORT .env | xargs)
docker run -d \
  --name rb-monitor \
  --restart unless-stopped \
  -p ${HOST_PORT:-8080}:8080 \
  rb-monitor
```

#### 6.2 Persistence (Optional)
```bash
mkdir -p monitor-data monitor-logs config public
cp config.json.example config/config.json

./scripts/prepare-build.sh
export $(grep HOST_PORT .env | xargs)

docker run -d \
  --name rb-monitor \
  --restart unless-stopped \
  -p ${HOST_PORT:-8080}:8080 \
  -v "$(pwd)/monitor-data":/app/data \
  -v "$(pwd)/monitor-logs":/app/logs \
  -v "$(pwd)/config":/app/config \
  -v "$(pwd)/public":/app/public \
  rb-monitor
```

#### 6.3 Troubleshooting
- Port already in use → rerun `./scripts/prepare-build.sh`.
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
- Add metrics/structured logging
- Harden security (see Hardening section below)
- Open focused issues/PRs

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
- `scripts/prepare-build.sh`: selects port, sets up `.env`
- `scripts/bootstrap.sh`: environment sanity
- `scripts/serve_public.sh`: wrapper for static server
- `scripts/show_monitor_url.sh`: prints URLs

### Docker
Container image:
- Based on `node:20-alpine`
- Non-root user `monitor` (UID 100)
- Docker socket access securely configured (see Hardening section below)
- HEALTHCHECK hits `/health`
- Volumes for `data`, `logs`, `config`, `public`

> **Security note:**  
> Mounting the Docker socket grants host introspection. Only do this in trusted, controlled environments.

### Potential Future Enhancements
- Pluggable collector framework
- Metrics exporter (Prometheus / OTEL)
- TypeScript migration
- Structured logging + rotation/remote sink

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
6. (Optional) Add tests/linting

CI: GitHub Actions (baseline soon).

---

## 🛡️ Docker Security Hardening (Best Practice)

This project is hardened for production and defense-in-depth.

**Key steps:**
- Minimize container privileges
- Protect host/data from container compromise
- Only required files are writable

### 1. Minimal Container Capabilities

`docker-compose.yml`:
```yaml
cap_drop:
  - ALL
cap_add:
  - SETGID
  - SETUID
```
Drops all Linux capabilities except those needed for privilege changes.

---

### 2. Read-Only Root Filesystem

```yaml
read_only: true
```
Makes the container filesystem immutable except for explicitly mounted volumes.

---

### 3. Writable Volumes for App Output

Mount all directories your app writes to:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro   # Docker API access
  - ./data:/app/data
  - ./logs:/app/logs
  - ./config:/app/config
  - ./public:/app/public       # For status.json and UI updates!
```

---

### 4. Least-Privilege User With Docker Socket Access

Create `monitor` user and add to both its own group and the host’s `docker` group (pass `DOCKER_GID` build arg):

```dockerfile
ARG DOCKER_GID
RUN addgroup -g ${DOCKER_GID} docker || true
RUN addgroup -S monitor && adduser -S monitor -G monitor && addgroup monitor docker
```
Monitor runs as non-root but can read the Docker socket.

---

### 5. Entrypoint and Permissions

- Copy entrypoint and Node app files
- Set ownership
- Run entrypoint as root (to allow privilege drop)

```dockerfile
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN chown -R monitor:monitor /app
USER root
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "static-server.js"]
```

---

### 6. Build Instructions

Pass host’s docker group GID:
```bash
DOCKER_GID=$(getent group docker | cut -d: -f3)
docker compose build --build-arg DOCKER_GID=$DOCKER_GID
```

---

### 7. Quick Checklist

- [x] UI, logs, and status output work after hardening
- [x] Only necessary directories are writable
- [x] Docker socket access works for non-root monitor user
- [x] No container privilege escalation risk

---

### 8. Troubleshooting

- `EROFS: read-only file system`? Check writable volumes.
- Docker socket permission errors? Check monitor user’s group membership and socket GID.

_For more info:_  
See [Docker security best practices](https://docs.docker.com/engine/security/security/) and [least privilege containers](https://docs.docker.com/develop/security/).

---

## Contributing
See `CONTRIBUTING.md` for branching, commit style, and review expectations.

## License
MIT – see `LICENSE`.

---
> Feedback (especially from Rosen Bridge core maintainers) is welcome—open focused issues or PRs.

