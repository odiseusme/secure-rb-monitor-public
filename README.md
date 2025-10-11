
# Secure RB Monitor (Public Baseline)

Monitor Rosen Bridge Watchers securely with a simple, mobile-friendly web UI and no privileged access. Features zero-knowledge, end-to-end encrypted remote monitoring via Cloudflare Worker or local Docker deployment.

A lightweight monitoring and status publishing component for the Watchers of the Rosen Bridge infrastructure.


_Current focus:_
- Zero-knowledge, end-to-end encrypted monitoring (AES-GCM, PBKDF2)
- Minimal web status UI (`public/` assets + `static-server.js`)
- Secure API-based monitoring (no privileged Docker access required)
- Cloudflare Worker backend for remote dashboard access
- Invitation-based user registration and onboarding
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
Openly reviewable, security-hardened, zero-knowledge monitoring solution for the Rosen Bridge ecosystem. Enables:
- Local or containerized deployment without privileged access
- Remote dashboard access via Cloudflare Worker (end-to-end encrypted)
- Invitation-based user onboarding (admin-controlled)
- Automatic discovery and monitoring of watcher services
- Secure API-based data collection (no Docker socket required)
- Hosts a simple, mobile-responsive web dashboard for status viewing

## Security & Privacy Architecture

**Zero-Knowledge, End-to-End Encryption:**
- All monitoring data is encrypted client-side (AES-GCM, PBKDF2-SHA256)
- Server (Cloudflare Worker or local) never sees decrypted data or user passphrases
- Decryption happens only in your browser

**Key security improvements:**
- No Docker socket access required (eliminates privileged container access)
- API-only monitoring (direct HTTP polling of watcher endpoints)
- Automatic network discovery (safe attachment to watcher networks only)
- Read-only container filesystem (immutable runtime environment)
- Minimal container capabilities (drops all unnecessary Linux capabilities)

The monitor operates entirely through network API calls, requiring no host system access or privileged Docker operations. For remote deployments, all data is encrypted before upload and decrypted only in the browser.

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
- (Optional) Cloudflare account for remote dashboard (see below)


### Normal Workflow (3 Steps)

**For most users (local or Docker):**

```bash
# 1. Clone
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public

# 2. Auto-discover and configure
./scripts/prepare_build.sh

# 3. Build and run (background)
docker compose up -d --build
```



**Access:**
- For Docker deployment, the script auto-selects an available port and prints the access URL (normally `http://localhost:${HOST_PORT:-8080}/`).
- For Cloudflare Worker/local development, the default port is `38472` (e.g., `http://localhost:38472/`).

**Note:** The two environments use different default ports by design. You can change these via the `HOST_PORT` variable (Docker) or `BASE_URL` (Cloudflare/local dev) as needed. Be aware of which environment you are using when accessing the dashboard or configuring scripts.

The setup script automatically:
- Discovers all running watcher containers
- Generates `config.json` with watcher API endpoints  
- Creates `docker-compose.override.yml` for network access
- Selects an available port and updates `.env`
- Displays access URLs

---


### Remote Cloudflare Worker Deployment

For secure remote monitoring, deploy the Cloudflare Worker backend and use the invitation-based registration system. See `cloudflare-sync.js` and `setup-cloudflare.js` for details. All data is encrypted before upload; only you can decrypt it in your browser.

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


#### Manual Status Update & Encrypted Upload
```bash
# Update status.json
node write_status.js
# Encrypt and upload to Cloudflare Worker
node cloudflare-sync.js
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
- Register users and manage invitations (Cloudflare Worker)

---


## User Registration & Access (Cloudflare Worker)

For remote dashboards, users register via invitation codes generated by the admin. Registration and access are managed by the Cloudflare Worker backend. See `setup-cloudflare.js` and project docs for details.

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
2. `write_status.js` polls watcher APIs → writes `status.json`
3. `cloudflare-sync.js` encrypts and uploads status to Cloudflare Worker
4. `static-server.js` or Cloudflare Worker serves UI and status data


### Scripts
- `scripts/prepare_build.sh`: Auto-discovery, port selection, network setup
- `scripts/serve_public.sh`: Static server wrapper
- `scripts/show_monitor_url.sh`: Display access URLs
- `cloudflare-sync.js`: Encrypts and uploads status to Cloudflare Worker
- `setup-cloudflare.js`: Registers users via invitation codes


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

- **Watchers not discovered:** Check container naming (must end with `-service-1`).
- **Network connection issues:** Re-run `./scripts/prepare_build.sh` to regenerate network config.
- **Permission errors:** Container runs as non-root with minimal capabilities.

---


## Environment Variables

**Local/Docker:**
- `HOST_PORT`, `NODE_ENV`, etc. (see `.env`)

**Cloudflare Worker:**
- `ADMIN_API_KEY` (admin authentication)
- `USERS_KV` (KV namespace binding)
- `ENVIRONMENT` ("development" or "production")

**Upload Script:**
- `DASH_PASSPHRASE`, `DASH_SALT_B64`, `WRITE_TOKEN`, `BASE_URL`

See project docs for full details and examples.

## Contributing
See `CONTRIBUTING.md` for branching, commit style, and review expectations.

## License
MIT — see `LICENSE`.

---

> Feedback from Rosen Bridge core maintainers and security reviewers is welcome—open focused issues or PRs.
