# Secure RB Monitor (Public Baseline)

A lightweight monitoring and status publishing component for the Watchers of the Rosen Bridge infrastructure.

_Current focus:_
- Minimal web status UI (`public/` assets + `static-server.js`)
- Secure API-based monitoring (no privileged Docker access required)
- Automatic watcher discovery and network configuration
- Simple bootstrap scripts for local/container usage

> Status: v0.3 (Security-hardened API-only architecture). Expect rapid iteration; APIs & structure may evolve.

## Table of Contents
- [Purpose](#purpose)
- [Security Architecture](#security-architecture)
- [Non-Goals (Now)](#non-goals-now)
- [Quick Start](#quick-start)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone](#2-clone)
  - [3. Automatic Setup (Recommended)](#3-automatic-setup-recommended)
  - [4. Run via docker-compose (Preferred)](#4-run-via-docker-compose-preferred)
    - [4.1 Optional: Persistence & Logs](#41-optional-persistence--logs)
    - [4.2 Restart Policy](#42-restart-policy)
  - [5. Run via Docker (Direct Alternative)](#5-run-via-docker-direct-alternative)
  - [6. Run Locally (Two Processes)](#6-run-locally-two-processes)
  - [7. Manual Status Update](#7-manual-status-update)
  - [8. Adding/Removing Watchers](#8-addingremoving-watchers)
  - [9. Next Steps](#9-next-steps)
- [Configuration](#configuration)
- [Architecture Overview](#architecture-overview)
  - [Core Data Flow](#core-data-flow)
  - [Scripts](#scripts)
  - [Docker](#docker)
  - [Network Architecture](#network-architecture)
- [Project Layout](#project-layout)
- [Development Workflow](#development-workflow)
- [🛡️ Security Features](#🛡️-security-features)
- [Contributing](#contributing)
- [License](#license)

## Purpose
Openly reviewable, security-hardened monitoring solution for Rosen Bridge ecosystem. Enables:
- Local or containerized deployment without privileged access
- Automatic discovery and monitoring of watcher services
- Secure API-based data collection (no Docker socket required)
- Basic static hosting of status artifacts and UI

## Security Architecture

**Key security improvements:**
- **No Docker socket access required** - Eliminates privileged container access
- **API-only monitoring** - Direct HTTP polling of watcher endpoints
- **Automatic network discovery** - Safe attachment to watcher networks only
- **Read-only container filesystem** - Immutable runtime environment
- **Minimal capabilities** - Drops all unnecessary Linux capabilities

The monitor operates entirely through network API calls, requiring no host system access or privileged Docker operations.

## Non-Goals (Now)
- Production-hardening (HA, clustering)
- Advanced auth / RBAC
- Observability (structured metrics/log shipping)
- Comprehensive test suite (placeholder only)

## Quick Start

### 1. Prerequisites
- Node.js (LTS) OR Docker
- Docker Compose (for container deployment)
- Running Rosen Bridge watcher containers
- (Optional) `qrencode` for QR code output

### 2. Clone
```bash
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public
```

### 3. Automatic Setup (Recommended)
The setup script automatically discovers running watcher containers, configures networking, and selects an available port:

```bash
./scripts/prepare_build.sh
```

This script:
- Discovers all running watcher containers (names containing 'watcher' ending in '-service-1')
- Generates `config.json` with watcher API endpoints
- Creates `docker-compose.override.yml` for network access
- Selects an available port and updates `.env`
- Displays access URLs

Options:
```bash
# Bind to all interfaces (accessible from LAN)
BIND_ALL=1 ./scripts/prepare_build.sh

# Auto-open browser after setup
OPEN_BROWSER=1 ./scripts/prepare_build.sh

# Show QR code for mobile access (requires qrencode)
SHOW_QR=1 ./scripts/prepare_build.sh

# Force regeneration of config/networks
FORCE=1 ./scripts/prepare_build.sh
```

---

### 4. Run via docker-compose (Preferred)

```bash
./scripts/prepare_build.sh
docker compose up -d --build
```

Access:
```
http://localhost:${HOST_PORT:-8080}/
```

The setup automatically configures network access to your watcher containers.

#### 4.1 Optional: Persistence & Logs
```bash
mkdir -p data logs config public
```

#### 4.2 Restart Policy
```yaml
# In docker-compose.yml - change if desired:
restart: unless-stopped  # Default: always
```

---

### 5. Run via Docker (Direct Alternative)

```bash
./scripts/prepare_build.sh
export $(grep HOST_PORT .env | xargs)

docker build -t rb-monitor .
docker run -d \
  --name rb-monitor \
  --restart unless-stopped \
  -p ${HOST_PORT:-8080}:8080 \
  --network watcher_network \
  rb-monitor
```

---

### 6. Run Locally (Two Processes)
Terminal A:
```bash
node static-server.js
```
Terminal B:
```bash
node status-updater.js
```
Access: `http://localhost:8080`

### 7. Manual Status Update
```bash
node write_status.js
```

### 8. Adding/Removing Watchers
When you add or remove watcher containers, regenerate the configuration:

```bash
./scripts/prepare_build.sh
docker compose up -d --build
```

The script will automatically discover new watchers and update network configurations.

### 9. Next Steps
- Monitor watcher health and performance
- Set up alerts for failed watchers (see TODO.md)
- Customize UI for your specific needs
- Add metrics/structured logging

---

## Configuration

The system uses automatic configuration discovery, but manual override is possible:

```json
{
  "watchers": [
    {"name": "watcher_3030-service-1", "url": "http://watcher_3030-service-1:3000/info"},
    {"name": "watcher_3042-service-1", "url": "http://watcher_3042-service-1:3000/info"}
  ]
}
```

Generated automatically by `prepare_build.sh` based on running containers.

---

## Architecture Overview

### Core Data Flow
1. `prepare_build.sh` discovers watchers and configures networks
2. `status-updater.js` schedules periodic collection
3. `write_status.js` polls watcher APIs → writes `status.json`
4. `static-server.js` serves UI and status data

### Scripts
- `scripts/prepare_build.sh`: Auto-discovery, port selection, network setup
- `scripts/serve_public.sh`: Static server wrapper
- `scripts/show_monitor_url.sh`: Display access URLs

### Docker
Container features:
- Based on `node:20-alpine`
- Non-root user `monitor`
- Read-only filesystem
- No privileged access required
- Automatic network attachment to watcher networks

### Network Architecture
The monitor attaches to watcher Docker networks automatically:
- Discovers watcher containers by name pattern
- Identifies their Docker networks
- Generates `docker-compose.override.yml` for network access
- Polls watcher `/info` endpoints directly over network

**Security benefit:** No Docker socket access required - only network-level API communication.

---

## Project Layout
```
.
├── public/                # Static assets and generated status.json
├── scripts/               # Helper scripts (discovery, setup)
├── museum/                # Reference examples (preserved configs)
├── status-updater.js      # Periodic orchestration
├── write_status.js        # API-based data collection
├── static-server.js       # Lightweight HTTP server
├── docker-entrypoint.sh   # Simplified privilege management
├── config.json            # Auto-generated watcher configuration
├── docker-compose.override.yml  # Auto-generated network config
├── docker-compose.yml
├── Dockerfile
└── TODO.md               # Future enhancements
```

---

## Development Workflow
1. Install Node.js (or rely on Docker)
2. Run `./scripts/prepare_build.sh` for automatic setup
3. Use `docker compose up -d --build` for testing
4. Edit code, rebuild/restart containers
5. Re-run setup script when adding/removing watchers

CI: GitHub Actions (baseline).

---

## 🛡️ Security Features

This monitor is designed with security-first principles:

### 1. No Privileged Access Required
- **No Docker socket mounting** - Eliminates host system access
- **API-only communication** - Polls watcher HTTP endpoints
- **Network-level isolation** - Only accesses watcher networks

### 2. Minimal Container Privileges
```yaml
cap_drop:
  - ALL
cap_add:
  - SETGID
  - SETUID
read_only: true
```

### 3. Secure Network Access
- Automatically discovers and joins only watcher networks
- No host network access required
- Isolated from other Docker networks

### 4. Writable Volumes Only Where Needed
```yaml
volumes:
  - ./data:/app/data
  - ./logs:/app/logs
  - ./config:/app/config
  - ./public:/app/public
```

### 5. Automatic Configuration
- No manual network configuration required
- Reduces configuration errors and security gaps
- Dynamic discovery of watcher services

### 6. Error Handling
- Gracefully handles unreachable watchers
- Continues monitoring available services
- Clear error reporting in status output

### Troubleshooting
- **Watchers not discovered**: Check container naming (must contain 'watcher' and end with '-service-1')
- **Network connection issues**: Re-run `./scripts/prepare_build.sh` to regenerate network config
- **Permission errors**: Container runs as non-root with minimal capabilities

---

## Contributing
See `CONTRIBUTING.md` for branching, commit style, and review expectations.

## License
MIT – see `LICENSE`.

---
> Feedback from Rosen Bridge core maintainers and security reviewers is welcome—open focused issues or PRs.
