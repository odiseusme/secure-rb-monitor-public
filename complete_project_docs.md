# Rosen Bridge Monitor - Complete System Documentation

> **Last Updated:** October 20, 2025  
> **Version:** 1.0.1  
> **Status:** ✅ Production Ready - QR Features Added, All Issues Resolved

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Repository Structure](#repository-structure)
4. [Core Components](#core-components)
5. [New Features (v1.0.1)](#new-features-v101)
6. [Implementation Status](#implementation-status)
7. [Development Workflow](#development-workflow)
8. [Deployment Guide](#deployment-guide)
9. [Testing & Debugging](#testing--debugging)
10. [Security Model](#security-model)
11. [API Documentation](#api-documentation)
12. [Admin Guide](#admin-guide)
13. [Troubleshooting](#troubleshooting)
14. [Recent Updates](#recent-updates)

## Project Overview

### Purpose
A secure, zero-knowledge remote monitoring dashboard for Rosen Bridge watchers using Cloudflare Workers and end-to-end encryption. Users can monitor their bridge watcher nodes locally or remotely without exposing sensitive data to the server.

### Key Features
- **Zero-Knowledge Architecture**: Server never sees decrypted data
- **End-to-End Encryption**: AES-GCM with per-user salt and PBKDF2-SHA256
- **Remote Dashboard**: Web-based monitoring interface
- **QR Code Registration**: Mobile-friendly setup with optional passphrase embedding (NEW in v1.0.1)
- **Automated Monitoring**: Background scripts that upload status updates
- **Invitation-Based Registration**: Admin-controlled user onboarding
- **Mobile-Responsive UI**: Works on all devices
- **Dual Timer System**: Monitor uptime and data freshness independently

### Technology Stack
- **Backend**: Cloudflare Workers + KV Storage
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Encryption**: Web Crypto API (AES-GCM, PBKDF2)
- **Infrastructure**: Docker, Node.js scripts
- **QR Generation**: qrencode (for mobile access)

## New Features (v1.0.1)

### 1. QR Code Registration System

**Feature**: `register-with-qr.sh` - Mobile-friendly registration with QR codes

**Benefits**:
- Quick mobile dashboard access
- Optional passphrase embedding for auto-login
- PNG and terminal QR code generation
- Same security as standard registration

**Usage**:
```bash
# Basic registration (passphrase required on login)
BASE_URL="https://your-worker.workers.dev" ./scripts/register-with-qr.sh --invite INVITE-CODE

# With embedded passphrase (auto-login)
BASE_URL="https://your-worker.workers.dev" ./scripts/register-with-qr.sh \
  --invite INVITE-CODE \
  --embed-passphrase \
  --passphrase "YourStrongPass123"
```

**Security Considerations**:
- Passphrase embedding uses URL fragment (`#p=...`) - not sent to server
- Anyone with QR can read passphrase if embedded
- Browser autofill may conflict with fragment passphrase
- Use incognito mode if experiencing autofill issues

**Options**:
- `--embed-passphrase` - Include passphrase in URL (convenient but less secure)
- `--passphrase VALUE` - Specify passphrase (or prompted if omitted)
- `--fragment-key KEY` - Custom fragment key (default: `p`)
- `--qr-out FILE.png` - Custom output filename
- `--base-url URL` - Override Worker URL

### 2. Improved Setup Script

**Feature**: `prepare_build.sh` enhancements

**Improvements**:
- QR codes now show LAN URL instead of localhost
- Eliminated redundant QR prompts when `SHOW_QR=1`
- Better mobile device accessibility
- Interactive prompts for QR display

**Usage**:
```bash
# Show QR automatically for LAN access
SHOW_QR=1 ./scripts/prepare_build.sh

# Other options remain the same
BIND_ALL=1 ./scripts/prepare_build.sh   # LAN access
OPEN_BROWSER=1 ./scripts/prepare_build.sh
```

### 3. Enhanced Security

**Feature**: Improved credential management

**Changes**:
- `start-monitoring.sh` now reads from `.env` (no hardcoded secrets)
- `.cloudflare-config.json` removed from git tracking
- Auto-generated files properly ignored
- Complete `.gitignore` coverage

### 4. UI Improvements

**Feature**: Consistent timer formatting

**Changes**:
- Timer display format standardized to `00H 00M 00S`
- Fixed initial display inconsistency
- Better visual consistency across dashboard

## System Architecture

### High-Level Flow
```
[Monitor Script] → [Encrypt Data] → [Cloudflare Worker] → [KV Storage]
                                          ↓
[Dashboard] ← [Decrypt Client-Side] ← [Serve HTML] ← [User Request]
```

### Components Interaction
1. **Admin** creates invitation codes
2. **User** registers with invitation (standard or QR method)
3. **Monitor Script** encrypts and uploads watcher data
4. **Dashboard** fetches encrypted data and decrypts with user passphrase

### Registration Flow (Updated)

**Method 1: Standard Registration**
```
User runs setup-cloudflare.js
→ Enters invitation code
→ Sets passphrase
→ Credentials saved to .env
→ Dashboard URL provided
```

**Method 2: QR Registration (NEW)**
```
User runs register-with-qr.sh
→ Enters invitation code  
→ Optional: embed passphrase
→ QR code generated (PNG + terminal)
→ Scan on mobile → instant access
```

## Repository Structure

### Updated Directory Layout (v1.0.1)

secure-rb-monitor-public/
├── .env                          # Environment variables (not in git)
├── .cloudflare-config.json       # User registration data (not in git)
├── .gitignore                    # Updated with new exclusions
├── config.json                   # Auto-generated watcher config
├── package.json                  # Node.js dependencies
├── cloudflare-sync.js            # Main data upload script (AES-GCM)
├── setup-cloudflare.js           # User registration script
├── start-monitoring.sh           # Monitoring startup (reads from .env)
├── cryptoHelpers.js              # Shared encryption utilities
├── write_status.js               # Status data generator
├── public/                       # Dashboard static files
│   ├── index.html               # Local dashboard
│   ├── style.css                # Dashboard styling
│   └── status.json              # Sample status data
├── scripts/                      # Helper scripts
│   ├── prepare_build.sh         # Setup with QR support
│   ├── register-user.sh         # Registration helper
│   └── register-with-qr.sh      # QR registration (NEW)
├── worker/                       # Cloudflare Worker code
│   └── mute-mouse-2cd2/         # Production worker
│       ├── src/
│       │   ├── dashboard_html.ts # Dashboard template (updated timers)
│       │   └── ...              # Other worker files
│       └── wrangler.toml        # Worker configuration
├── docker-compose.yml            # Docker orchestration
├── Dockerfile                    # Container build file
└── README.md                     # User documentation

### Files Added/Modified in v1.0.1

**New Files**:
- `scripts/register-with-qr.sh` - QR code registration script

**Modified Files**:
- `scripts/prepare_build.sh` - QR URL fixes, redundant prompt removal
- `start-monitoring.sh` - Now reads from .env instead of hardcoded values
- `worker/mute-mouse-2cd2/src/dashboard_html.ts` - Timer format consistency
- `.gitignore` - Added auto-generated and personal files
- `README.md` - Complete QR documentation added

**Removed from Tracking**:
- `.cloudflare-config.json` - Now properly ignored (contains user credentials)
- All `.BAK`, `.bak`, `.NEW` backup files cleaned up
- `worker-configuration.d.ts` - Auto-generated, now ignored
- `create_new_user_register_and_run.md` - Personal notes, now ignored

### .gitignore Updates

**New exclusions added**:
```gitignore
# User credentials
.cloudflare-config.json
.cloudflare-config.json.*

# Auto-generated files
worker/mute-mouse-2cd2/worker-configuration.d.ts
worker/mute-mouse-2cd2/create_new_user_register_and_run.md

# Temporary files
.fuse_hidden*
Claude.md

# Already excluded (maintained)
.env
.env.local
node_modules/
.wrangler/
*.log
```

## Core Components

### 1. Cloudflare Worker (`worker/mute-mouse-2cd2/`)

**Purpose**: Central API server handling user management, data storage, and dashboard serving.

**Key Endpoints**:
```
GET  /health                    - Health check
POST /api/update               - Data upload with writeToken auth  
GET  /api/blob/{publicId}      - Fetch encrypted data + user info
GET  /d/{publicId}             - Serve dashboard HTML
POST /api/admin/create-invite  - Generate invitation codes
POST /api/register             - Register user with invitation code
GET  /api/admin/stats          - Admin statistics
DELETE /api/user/{publicId}    - Admin user deletion
```

**Authentication**:
- **Admin Endpoints**: Require `x-admin-key` header
- **Data Updates**: Require `Authorization: Bearer <writeToken>` header
- **Dashboard**: Access via publicId URL + user passphrase

**Environment Variables**:
- `ADMIN_API_KEY` - Admin authentication key
- `USERS_KV` - KV namespace binding
- `ENVIRONMENT` - "development" or "production"

### 2. Upload Script (`cloudflare-sync.js`)

**Purpose**: Monitors local data sources and uploads encrypted updates.

**Current Implementation**: Uses PBKDF2-SHA256 + AES-GCM encryption

**Environment Variables**:
```bash
DASH_PASSPHRASE     # User passphrase
DASH_SALT_B64       # Per-user salt
BASE_URL            # Worker URL
WRITE_TOKEN         # User's authentication token
```

**Encryption Flow**:
```
Data → JSON → PBKDF2-SHA256(passphrase, salt, 100k iters) → AES-GCM Key → Encrypt → Upload
```

### 3. Registration Systems

#### Standard Registration (`setup-cloudflare.js`)

**Features**:
- Interactive invitation code entry
- Passphrase creation with optional save
- Auto-writes credentials to `.env`
- Saves full config to `.cloudflare-config.json`

**Usage**:
```bash
BASE_URL="https://your-worker.workers.dev" node setup-cloudflare.js
```

#### QR Registration (`register-with-qr.sh`) - NEW

**Features**:
- Generates QR codes for mobile access
- Optional passphrase embedding in URL fragment
- PNG and terminal QR output
- Same credential management as standard registration

**Security Model**:
- URL fragment (`#p=passphrase`) not sent to server
- Client-side only passphrase handling
- Warning displayed when embedding passphrase

**Usage**:
```bash
# Without embedded passphrase (more secure)
BASE_URL="https://your-worker.workers.dev" \
  ./scripts/register-with-qr.sh --invite INVITE-CODE

# With embedded passphrase (convenient)
BASE_URL="https://your-worker.workers.dev" \
  ./scripts/register-with-qr.sh \
  --invite INVITE-CODE \
  --embed-passphrase \
  --passphrase "StrongPass123"
```

**Known Issues**:
- Browser autofill may conflict with fragment passphrase
- Solution: Use incognito/private mode or clear saved passwords

### 4. Dashboard (`dashboard_html.ts` + Client JS)

**Purpose**: Web interface for viewing encrypted monitoring data.

**Recent Updates (v1.0.1)**:
- Timer format standardized to `00H 00M 00S`
- Fixed initial display inconsistency
- Better visual consistency

**Security Features**:
- All decryption happens client-side
- CSP headers prevent XSS
- No passphrase transmitted to server

**Data Flow**:
```
User enters passphrase → Fetch /api/blob/{publicId} → 
Client-side PBKDF2+AES-GCM decrypt → Render UI
```

### 5. Setup Script (`prepare_build.sh`) - UPDATED

**Purpose**: Automated watcher discovery and configuration.

**Recent Improvements (v1.0.1)**:
- QR codes now show LAN URL (not localhost)
- No redundant prompts when `SHOW_QR=1` is set
- Better mobile device accessibility

**Usage**:
```bash
# Show QR for LAN access automatically
SHOW_QR=1 ./scripts/prepare_build.sh

# Combine options
BIND_ALL=1 SHOW_QR=1 ./scripts/prepare_build.sh
```

**How it works**:
- Detects running watcher containers
- Generates `config.json` automatically
- Creates `docker-compose.override.yml`
- Optionally displays QR code for mobile access

### 6. Startup Script (`start-monitoring.sh`) - UPDATED

**Purpose**: Starts the cloudflare-sync upload process.

**Recent Changes (v1.0.1)**:
- Now reads all credentials from `.env`
- No hardcoded secrets in the script
- Better security (nothing committed to git)

**Old behavior (v1.0)**:
```bash
# Hardcoded credentials - BAD
BASE_URL="https://..." WRITE_TOKEN="..." ./start-monitoring.sh
```

**New behavior (v1.0.1)**:
```bash
# Reads from .env - GOOD
./start-monitoring.sh
```

**Requirements**:
- `.env` file must contain: `BASE_URL`, `WRITE_TOKEN`, `DASH_SALT_B64`, `DASH_PASSPHRASE`
- Created automatically by registration scripts

### 7. Dual Timer System

**Purpose**: Monitor system health and data freshness independently.

**Implementation**: Backend heartbeat system + frontend display timers

**Timer Definitions**:

**Timer A (System Uptime)**:
- Shows: HH:MM:SS since last major outage recovery
- Calculation: NOW() - monitorStartTime
- Resets: When system recovers from 6+ minute silence
- Format: `00H 00M 00S` (updated in v1.0.1)

**Timer B (Data Freshness)**:
- Shows: HH:MM:SS since last data change
- Calculation: NOW() - lastDataChangeTime  
- Resets: When actual watcher data changes
- Format: `00H 00M 00S` (updated in v1.0.1)

**Status Dot Colors**:
```javascript
IF silenceMs < 330000:       // 0-5.5 minutes
   dotColor = "green"
   statusText = "Monitor alive since:"
   
ELSE IF silenceMs < 360000:  // 5.5-6 minutes  
   dotColor = "orange"
   statusText = "Monitor unstable"
   
ELSE:                         // 6+ minutes
   dotColor = "red"
   statusText = "Monitor down since:"
```

## Implementation Status

### ✅ Completed Components (v1.0.1)

**Core Features**:
- Complete Worker with all endpoints
- Upload script with AES-GCM encryption
- Dashboard with client-side decryption
- Registration system with invitation codes
- Admin endpoints with authentication
- Docker containerization

**New in v1.0.1**:
- ✅ QR code registration system
- ✅ Improved setup script (QR URL fixes)
- ✅ Enhanced security (credential management)
- ✅ Timer format consistency
- ✅ Repository cleanup (backup files removed)
- ✅ Complete .gitignore coverage

### ✅ All Critical Issues Resolved

1. **Port Configuration**: ✅ Documented as intentional design
2. **Environment Variables**: ✅ Complete documentation in README
3. **Base URL Configuration**: ✅ Consistent approach established
4. **TypeScript Types**: ✅ Complete Env interface implemented
5. **Development Setup**: ✅ Streamlined workflow documented
6. **QR Code Features**: ✅ Fully implemented and tested
7. **Security Hardening**: ✅ No secrets in git

### Recent Fixes (October 20, 2025)

**Scripts Fixed**:
- `prepare_build.sh` - QR shows LAN URL, no redundant prompts
- `register-with-qr.sh` - ANSI color codes stripped from URLs
- `start-monitoring.sh` - Reads from .env (no hardcoded secrets)

**Dashboard Fixed**:
- Timer format: `00H 00M 00S` (was `00:00:00`)
- Initial display consistency improved

**Repository Cleaned**:
- All `.BAK`, `.bak`, `.NEW` files removed
- `.cloudflare-config.json` removed from tracking
- Auto-generated files properly ignored

## Development Workflow

### Local Development Setup

**1. Install dependencies:**
```bash
npm install
cd worker/mute-mouse-2cd2 && npm install
```

**2. Start components:**
```bash
# Terminal 1 – Worker
cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local

# Terminal 2 – Docker monitor
cd ../..
docker compose up -d --build

# Terminal 3 – Cloudflare sync
DASH_PASSPHRASE='test' ./start-monitoring.sh &
```

### Testing QR Registration (NEW)

**1. Create test invitation:**
```bash
curl -X POST http://localhost:38472/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 7}'
```

**2. Test QR registration:**
```bash
BASE_URL="http://localhost:38472" \
  ./scripts/register-with-qr.sh \
  --invite INVITE-CODE \
  --embed-passphrase \
  --passphrase "TestPass123"
```

**3. Verify QR code:**
- Scan with phone
- Dashboard should open
- If passphrase embedded, auto-decrypt should work

### Making Changes

**Worker changes:**
- Auto-reloads with wrangler dev
- No restart needed

**Script changes:**
- Restart the affected process
- Test with actual credentials

**Dashboard changes:**
- Redeploy worker: `wrangler deploy`
- Or restart wrangler dev

## Deployment Guide

### Production Deployment

**1. Deploy Cloudflare Worker:**
```bash
cd worker/mute-mouse-2cd2
wrangler login
wrangler deploy
```

**2. Set admin key:**
```bash
wrangler secret put ADMIN_API_KEY
# Enter strong random key when prompted
```

**3. Create KV namespace:**
```bash
wrangler kv:namespace create USERS_KV
# Update wrangler.toml with namespace ID
```

**4. Verify deployment:**
```bash
curl https://your-worker.workers.dev/health
# Should return: {"status":"ok"}
```

### User Registration (Production)

**Method 1: Standard**
```bash
BASE_URL="https://your-worker.workers.dev" node setup-cloudflare.js
```

**Method 2: QR (Recommended for mobile users)**
```bash
BASE_URL="https://your-worker.workers.dev" \
  ./scripts/register-with-qr.sh --invite INVITE-CODE
```

## Security Model

### Encryption Specifications
- **Algorithm**: AES-GCM (256-bit)
- **Key Derivation**: PBKDF2-SHA256 (100,000 iterations)
- **Salt**: Per-user, stored in Worker KV
- **Nonce**: Random 12-byte IV per encryption
- **Passphrase**: Minimum 8 characters

### Zero-Knowledge Design
- Server stores only encrypted blobs
- Passphrase never transmitted to server
- Decryption happens client-side only
- Salt and KDF parameters are public (not secret)

### Security Enhancements (v1.0.1)

**Credential Management**:
- `.cloudflare-config.json` removed from git tracking
- `start-monitoring.sh` reads from `.env` only
- No secrets committed to repository

**QR Code Security**:
- Passphrase embedding optional
- URL fragment not sent to server
- Security warnings displayed
- Incognito mode recommended for testing

## Admin Guide

### Creating Invitations

**Standard invitations:**
```bash
curl -X POST https://your-worker.workers.dev/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 5, "expiresInDays": 30}'
```

### Monitoring Usage

**View statistics:**
```bash
curl https://your-worker.workers.dev/api/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Key metrics:**
- Total users and activity
- Request counts per user
- Rate-limit violations
- Suspicious activity detection

### Cloudflare Free Tier Limits

**Current usage (v1.0)**:
- Dashboard polling: 60 requests/hour/user
- Upload frequency: ~12 requests/hour/user
- **Total per user**: ~1,728 requests/day

**Limits:**
- 100,000 requests/day free tier
- ~57 users maximum before limit
- ~45 users recommended (with 80% buffer)

## Troubleshooting

### QR Code Issues (NEW)

**Problem**: QR shows localhost URL  
**Solution**: Use `BIND_ALL=1` with prepare_build.sh or use register-with-qr.sh

**Problem**: Browser autofill conflicts with embedded passphrase  
**Solution**: Use incognito/private mode or clear saved passwords

**Problem**: QR code has color codes in URL  
**Status**: ✅ FIXED in v1.0.1 (ANSI codes now stripped)

### Common Issues

**Dashboard shows "Cannot decrypt"**:
- Verify passphrase is correct
- Check `DASH_PASSPHRASE` is set when starting uploader
- Wait 60 seconds for first upload

**Uploader not starting**:
- Check `.env` file exists and has all required variables
- Verify `start-monitoring.sh` is executable
- Check logs for error messages

**Timer shows wrong format**:
- Status: ✅ FIXED in v1.0.1
- Timers now consistently show `00H 00M 00S`

## Recent Updates

### Version 1.0.1 (October 20, 2025)

**New Features**:
- QR code registration system with optional passphrase embedding
- Mobile-friendly dashboard access via QR codes

**Improvements**:
- prepare_build.sh: QR codes show LAN URL instead of localhost
- prepare_build.sh: Eliminated redundant QR prompts  
- start-monitoring.sh: Now reads all credentials from .env
- Dashboard: Consistent timer format (`00H 00M 00S`)

**Security**:
- Removed .cloudflare-config.json from git tracking
- No hardcoded secrets in scripts
- Complete .gitignore coverage

**Cleanup**:
- Removed all backup files (.BAK, .bak, .NEW)
- Auto-generated files properly ignored
- Repository fully cleaned

**Documentation**:
- Complete QR registration guide in README
- Security warnings for passphrase embedding
- Browser autofill conflict documentation

### Version 1.0 (October 11, 2025)

**Initial Release**:
- Complete Worker implementation
- Standard registration system
- Dual timer system
- Docker containerization
- All critical issues resolved

## Project Status

### 🎉 Current Status: Production Ready (v1.0.1)

**Fully Implemented**:
- ✅ Core monitoring functionality
- ✅ Zero-knowledge encryption
- ✅ Invitation-based registration (2 methods)
- ✅ QR code mobile access
- ✅ Admin management tools
- ✅ Complete documentation
- ✅ Security hardened

**Tested and Verified**:
- ✅ Local monitoring (Path A)
- ✅ Remote monitoring (Path B)
- ✅ QR registration flow
- ✅ Passphrase embedding
- ✅ Auto-decrypt functionality
- ✅ End-to-end encryption

**Ready For**:
- ✅ Public release
- ✅ Community use
- ✅ Production deployments
- ✅ Mobile users

---

**Last Updated:** October 20, 2025  
**Maintainer:** @odiseus_me (Independent project for Rosen Bridge ecosystem)
**Status:** ✅ Production Ready with QR Features
