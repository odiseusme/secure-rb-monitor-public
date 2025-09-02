# Secure RB Monitor (Public Baseline)

A lightweight monitoring and status publishing component related to Rosen Bridge infrastructure (early public snapshot).  
This repository currently focuses on:
- Serving a minimal web status UI (`public/` assets + `static-server.js`)
- Periodic status updating (`status-updater.js`, `write_status.js`)
- Simple bootstrap scripts for local / container usage

> Status: Initial public baseline (v0.1.0). Expect rapid iteration; APIs & structure may evolve.

## Table of Contents
- [Purpose](#purpose)
- [Non-Goals (Now)](#non-goals-now)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture Overview](#architecture-overview)
- [Project Layout](#project-layout)
- [Development Workflow](#development-workflow)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Purpose
Provide an openly reviewable starting point for the Rosen Bridge ecosystem monitor. Enables:
- Local or containerized deployment
- Periodic retrieval/formatting of token / balance / status data
- Basic static hosting of status artifacts or UI

## Non-Goals (Now)
- Production-hardening (HA, clustering)
- Advanced auth / RBAC
- Observability (structured metrics/log shipping)
- Comprehensive test suite (placeholder only)

## Quick Start
See [QUICKSTART.md](QUICKSTART.md) for copy/paste run instructions (Docker & local node).

## Configuration
A canonical example is in `config.json.example`.  
You MUST create an actual runtime config (ignored by git):

```bash
mkdir -p config
cp config.json.example config/config.json
# Edit as needed
```

Environment overrides (see `.env.example`) can be supplied via:
- `docker-compose.yml` (env file)
- Direct `docker run --env-file`
- Exporting variables before `node ...`

We intentionally do **not** commit `config/config.json` to:
- Avoid stale or environment-specific values in history
- Force explicit operator awareness

## Architecture Overview

### Core Data Flow
1. `status-updater.js` schedules or triggers state collection.
2. `write_status.js` performs balance / token / misc retrieval and writes structured outputs (JSON or text) to a served directory or stdout/log.
3. `static-server.js` exposes the `public/` directory (and possibly generated artifacts) over HTTP.

### Scripts
- `scripts/bootstrap.sh`: environment sanity + dependency pre-run
- `scripts/serve_public.sh`: convenience wrapper to launch the static server
- `scripts/select_host_port.sh`: chooses an available port or respects configured one
- `scripts/show_monitor_url.sh`: prints final accessible URL (DX improvement)

### Docker
- `Dockerfile` constructs a minimal runtime
- `docker-compose.yml` provides local orchestration
- `.dockerignore` reduces build context size

### Potential Future Enhancements
- Introduce a standardized plugin interface for data collectors
- Add metrics exporter (Prometheus or OTEL)
- TypeScript migration for stronger contracts
- Structured logging (JSON) + log rotation or remote shipping

## Project Layout
```
.
├── public/                # Static assets for UI
├── scripts/               # Operational helper scripts
├── status-updater.js      # Orchestrates periodic updates
├── write_status.js        # Logic for collecting & writing data
├── static-server.js       # Lightweight HTTP file server
├── config.json.example    # Config sample (copy into config/config.json)
├── config/                # (Generated at runtime by user; ignored)
└── docker-compose.yml
```

## Development Workflow
1. Install Node (see `scripts/bootstrap.sh` or use Docker)
2. Copy config example -> working config
3. Run: `npm install`
4. Start: `npm start` (if defined) or `node static-server.js`
5. Update logic: modify scripts / updaters, then re-run

CI: GitHub Actions runs basic lint / syntax (expand later into tests / security scans).

## Security
See [SECURITY.md](SECURITY.md) for reporting instructions and hardening roadmap.

## Contributing
Guidelines, branching, and commit conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT – see [LICENSE](LICENSE).

---
> Feedback from reviewers (especially Rosen Bridge core maintainers) is welcome—open issues or PRs with focused scope.
