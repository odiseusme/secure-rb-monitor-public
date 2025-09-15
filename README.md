# Secure RB Monitor (Public Baseline)

A lightweight monitoring and status publishing component for the Watchers of the Rosen Bridge infrastructure.

_Current focus:_
- Minimal web status UI (`public/` assets + `static-server.js`)
- Secure API-based monitoring (no privileged Docker access required)
- Automatic watcher discovery and network configuration
- Simple bootstrap scripts for local/container usage

> Status: v0.4 (Security-hardened API-only architecture). Expect rapid iteration; APIs & structure may evolve.

## Table of Contents
- [Purpose](#purpose)
- [Security Architecture](#security-architecture)
- [Non-Goals (Now)](#non-goals-now)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Normal Workflow (3 Steps)](#normal-workflow-3-steps)
  - [Advanced Setup Options](#advanced-setup-options)
  - [Alternative Deployment Methods](#alternative-deployment-methods)
  - [Maintenance Commands](#maintenance-commands)
  - [Optional: Persistence & Custom Directories](#optional-persistence--custom-directories)
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

### Prerequisites
- Node.js (LTS) OR Docker
- Docker Compose (for container deployment)
- Running Rosen Bridge watcher containers
- (Optional) `qrencode` for QR code output

### Normal Workflow (3 Steps)

**For most users - this is all you need:**

```bash
# 1. Clone
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public

# 2. Auto-discover and configure
./scripts/prepare_build.sh

# 3. Build and run (background)
docker compose up -d --build
```

**Access:** normally (unless 8080 is taken) `http://localhost:${HOST_PORT:-8080}/`

The setup script automatically:
- Discovers all running watcher containers
- Generates `config.json` with watcher API endpoints  
- Creates `docker-compose.override.yml` for network access
- Selects an available port and updates `.env`
- Displays access URLs

---

### Advanced Setup Options

You can customize the setup script with environment variables:

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

### Alternative Deployment Methods

If you can't use Docker Compose, here are other options:

#### Option A: Direct Docker Run
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

#### Option B: Local Node.js (Development)
Terminal A:
```bash
node static-server.js
```
Terminal B:  
```bash
node status-updater.js
```
Access: `http://localhost:8080`

---

### Maintenance Commands

#### Adding/Removing Watchers
When you add or remove watcher containers, regenerate the configuration:

```bash
./scripts/prepare_build.sh
docker compose up -d --build
```

The script will automatically discover new watchers and update network configurations.

#### Manual Status Update
```bash
node write_status.js
```

#### View Logs
```bash
# Live logs
docker compose logs -f

# Recent logs
docker compose logs --tail=50
```

#### Stop/Restart
```bash
# Stop
docker compose down

# Restart
docker compose up -d --build
```

---

### Optional: Persistence & Custom Directories

```bash
mkdir -p data logs config public
```

These directories will be mounted as volumes for persistent data storage.

**Next Steps:**
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

### 7. Running as Non-Root User

The monitor container runs as a non-root user (UID 1000).  
This improves security by preventing escalated permissions inside the container.

**Implications:**
- Any mounted volumes (e.g., for persistent data) should be writable by UID 1000.
- Files created by the container will be owned by UID 1000 on the host.
- If you encounter permission errors, check host directory ownership with:
  ```sh
  sudo chown -R 1000:1000 <your-folder>
  ```
No changes to application usage are required.- Clear error reporting in status output


### Troubleshooting
- **Watchers not discovered**: Check container naming (must end with '-service-1')
- **Network connection issues**: Re-run `./scripts/prepare_build.sh` to regenerate network config
- **Permission errors**: Container runs as non-root with minimal capabilities

---

## Contributing
See `CONTRIBUTING.md` for branching, commit style, and review expectations.

## License
MIT — see `LICENSE`.

---

> Feedback from Rosen Bridge core maintainers and security reviewers is welcome—open focused issues or PRs.
