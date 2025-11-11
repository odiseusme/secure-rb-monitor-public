# Essential Files for Rosen Bridge Monitor

This document lists all files essential for running the project. Use this as a reference when cleaning up or deploying.

## Core Application Files

### Main Entry Points
- `static-server.js` - Main web server for dashboard
- `start-monitoring.sh` - Legacy startup script (kept for compatibility)
- `cloudflare-sync.js` - Upload monitoring data to Cloudflare
- `status-updater.js` - Update local monitoring status
- `write_status.js` - Write status to public/status.json
- `upload-once.js` - Manual upload utility

### Configuration & Setup
- `setup-cloudflare.js` - Interactive Cloudflare setup wizard
- `passphrase-guard.js` - Passphrase validation logic
- `cryptoHelpers.js` - Encryption/decryption utilities

### Docker Files
- `Dockerfile` - Container build definition
- `docker-compose.yml` - Multi-container orchestration
- `docker-entrypoint.sh` - Container initialization script
- `.dockerignore` - Docker build exclusions

### Configuration Templates
- `.env.example` - Environment variables template
- `config.json.example` - Monitor configuration template
- `.cloudflare-config.json.example` - Cloudflare setup template

## Scripts Directory (`scripts/`)

### User Management
- `scripts/register-user.sh` - User registration and setup wizard
- `scripts/monitor_control.sh` - Start/stop/status monitoring services

### Setup & Configuration
- `scripts/prepare_build.sh` - Pre-build configuration (port selection, network discovery)
- `scripts/discover_network.sh` - Auto-detect Docker networks for watchers

### Utilities
- `scripts/invite-codes.sh` - Generate invite codes
- `scripts/create-admin-hash.sh` - Generate admin password hash

## Library Files (`lib/`)

- `lib/passphraseGuard.mjs` - ES module wrapper for passphrase guard
- `lib/simpleEncryption.mjs` - Encryption utilities module

## Documentation

### User Documentation
- `README.md` - Main project documentation
- `INSTALLATION_CHECKLIST.md` - Setup verification checklist
- `UPGRADE_FROM_OLD_VERSION.md` - Migration guide
- `QUICK_UPGRADE_UBUNTU.sh` - Ubuntu quick upgrade script

### Development Documentation
- `CHANGELOG.md` - Version history
- `CONTRIBUTING.md` - Contribution guidelines
- `SECURITY.md` - Security policies
- `LICENSE` - Project license

### Project Planning
- `RBMonitor_project_description_and_future_plans.md` - Project roadmap and future plans

### Issue Tracking (Can be moved to archive)
- `UBUNTU_TEST_ISSUES.md` - Ubuntu testing issues log
- `UBUNTU_TRIAL_FIXES.md` - Ubuntu fixes documentation
- `UBUNTU_RETEST_INSTRUCTIONS.md` - Retest procedures
- `MULTI_INSTANCE_SOLUTIONS.md` - Multi-instance patterns

## Configuration Files

- `.editorconfig` - Editor configuration
- `.gitignore` - Git exclusions
- `jest.config.js` - Test framework configuration
- `package.json` - Node.js dependencies and scripts
- `package-lock.json` - Locked dependency versions

## Directories

### Essential Directories
- `config/` - Configuration storage (auto-generated)
- `public/` - Static web assets and dashboard
- `worker/` - Cloudflare Worker code
- `tests/` - Test suite
- `.github/` - GitHub workflows and templates

### Runtime Directories (auto-created, gitignored)
- `logs/` - Application logs (gitignored)
- `data/` - Runtime data storage (gitignored)
- `.run/` - Process state and uploader logs (gitignored)
- `node_modules/` - Installed dependencies (gitignored)
- `.wrangler/` - Wrangler cache (gitignored)

## Generated/Runtime Files (Not Essential, Safe to Delete)

### Backup Files
- `.env.bak*` - Environment backup files
- `.cloudflare-config.json.bak.*` - Config backup files
- `*.bak` - Any other backup files

### Generated Configuration
- `config.json` - Auto-generated from watchers (gitignored)
- `docker-compose.override.yml` - Auto-generated network config (gitignored)
- `.cloudflare-config.json` - User credentials (gitignored, secret)
- `.last-sync-hash` - Upload state (gitignored)

### Generated Artifacts
- `dashboard-*.png` - QR code images (gitignored)
- `start-monitoring-*.sh` - Generated scripts (gitignored)

### Log Files
- `logs/*.log` - Application logs (gitignored)
- `logs/*.pid` - Process ID files (gitignored)
- `.register-user.log` - Registration log (gitignored)
- `.run/uploader.log` - Uploader log (gitignored)

### Development/Testing Files
- `cloudflare-sync.js.bak` - Code backup (safe to delete)

## Files to Archive (Not Needed for Running)

These are valuable for reference but not needed for operation:

1. **Issue Documentation:**
   - `UBUNTU_TEST_ISSUES.md`
   - `UBUNTU_TRIAL_FIXES.md`
   - `UBUNTU_RETEST_INSTRUCTIONS.md`
   - `MULTI_INSTANCE_SOLUTIONS.md`

2. **Stop Script:**
   - `stop-all-services.sh` - Can use `monitor_control.sh stop` instead

## Minimum Files for Fresh Deployment

For a minimal deployment, you only need:

```
Core Files:
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── static-server.js
├── cloudflare-sync.js
├── status-updater.js
├── write_status.js
├── setup-cloudflare.js
├── passphrase-guard.js
├── cryptoHelpers.js
├── package.json
└── package-lock.json

Templates:
├── .env.example
├── config.json.example
└── .cloudflare-config.json.example

Scripts:
├── scripts/register-user.sh
├── scripts/monitor_control.sh
├── scripts/prepare_build.sh
└── scripts/discover_network.sh

Library:
├── lib/passphraseGuard.mjs
└── lib/simpleEncryption.mjs

Public:
└── public/ (entire directory)

Worker:
└── worker/ (entire directory)

Documentation:
├── README.md
└── INSTALLATION_CHECKLIST.md
```

## How to Use This List

### When Cleaning:
1. Keep all files listed under "Essential" sections
2. Delete all backup files (*.bak*)
3. Delete old log files
4. Move issue documentation to archive
5. Keep generated files only if system is running

### When Deploying:
1. Use "Minimum Files" list above
2. Copy `.example` files and configure
3. Run `npm install` to restore node_modules
4. Run `scripts/prepare_build.sh` to generate configs

### When Archiving:
1. Save issue documentation to `Monitor Junk/`
2. Keep one recent backup of `.env` and `.cloudflare-config.json`
3. Archive old log files if needed for debugging

---

**Last Updated:** November 11, 2025
**Version:** 1.0.0
