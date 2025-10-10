# Rosen Bridge Monitor - Complete System Documentation

> **Last Updated:** September 18, 2025  
> **Version:** 1.0  
> **Status:** Active Development

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Repository Structure](#repository-structure)
4. [Core Components](#core-components)
5. [Implementation Status](#implementation-status)
6. [Development Workflow](#development-workflow)
7. [Deployment Guide](#deployment-guide)
8. [Testing & Debugging](#testing--debugging)
9. [Security Model](#security-model)
10. [API Documentation](#api-documentation)
11. [Troubleshooting](#troubleshooting)
12. [Future Roadmap](#future-roadmap)

## Project Overview

### Purpose
A secure, zero-knowledge remote monitoring dashboard for Rosen Bridge watchers using Cloudflare Workers and end-to-end encryption. Users can monitor their bridge watcher nodes remotely without exposing sensitive data to the server.

### Key Features
- **Zero-Knowledge Architecture**: Server never sees decrypted data
- **End-to-End Encryption**: AES-GCM with per-user salt and PBKDF2-SHA256
- **Remote Dashboard**: Web-based monitoring interface
- **Automated Monitoring**: Background scripts that upload status updates
- **Invitation-Based Registration**: Admin-controlled user onboarding
- **Mobile-Responsive UI**: Works on all devices

### Technology Stack
- **Backend**: Cloudflare Workers + KV Storage
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Encryption**: Web Crypto API (AES-GCM, PBKDF2)
- **Infrastructure**: Docker, systemd, Node.js scripts

## System Architecture

### High-Level Flow
```
[Monitor Script] → [Encrypt Data] → [Cloudflare Worker] → [KV Storage]
                                          ↓
[Dashboard] ← [Decrypt Client-Side] ← [Serve HTML] ← [User Request]
```

### Components Interaction
1. **Admin** creates invitation codes
2. **User** registers with invitation, sets passphrase
3. **Monitor Script** encrypts and uploads watcher data
4. **Dashboard** fetches encrypted data and decrypts with user passphrase

## Repository Structure

### Current Directory Layout
```
secure-rb-monitor-public/
├── .env                          # Environment variables
├── .cloudflare-config.json       # User registration data
├── config.json                   # Local configuration
├── package.json                  # Node.js dependencies
├── cloudflare-sync.js            # Main data upload script (AES-GCM)
├── setup-cloudflare.js           # User registration script
├── cryptoHelpers.js              # Shared encryption utilities
├── upload-once.js                # One-time test upload
├── test_crypto.js                # Crypto function testing
├── write_status.js               # Status data generator
├── static-server.js              # Local development server
├── status-updater.js             # Legacy status updater
├── public/                       # Dashboard static files
│   ├── index.html               # Main dashboard page
│   ├── style.css                # Dashboard styling
│   ├── cryptoHelpers.js         # Client-side crypto
│   └── status.json              # Sample status data
├── scripts/                      # Helper scripts
│   ├── prepare_build.sh         # Build preparation
│   └── show_monitor_url.sh      # URL display helper
├── worker/                       # Cloudflare Worker code
│   └── mute-mouse-2cd2/         # Main worker implementation
├── worker-dev/                   # Development worker
├── config/                       # Configuration templates
├── data/                         # Runtime data storage
├── logs/                         # Application logs
├── docker-compose.yml            # Docker containerization
├── Dockerfile                    # Container build file
└── README.md                     # Project documentation
```

### File Status Classification

#### Core Production Files
- `cloudflare-sync.js` - Main upload script (CURRENT)
- `setup-cloudflare.js` - Registration script (CURRENT)
- `cryptoHelpers.js` - Crypto utilities (CURRENT)
- `worker/mute-mouse-2cd2/` - Production worker (CURRENT)
- `public/` - Dashboard files (CURRENT)

#### Development/Test Files
- `upload-once.js` - Test upload (KEEP for testing)
- `test_crypto.js` - Crypto testing (KEEP for validation)
- `static-server.js` - Dev server (KEEP for development)
- `worker-dev/` - Dev worker (KEEP for testing)

#### Legacy/Backup Files
- `cloudflare-sync.js.BAK.20250916T203338Z` - Backup (CAN DELETE)
- `status-updater.js` - Legacy updater (CAN DELETE after migration)
- `write_status.js` - Status generator (EVALUATE if still needed)
- `.env.bak` - Environment backup (CAN DELETE)
- `README.md.backup` - Documentation backup (CAN DELETE)

## Core Components

### 1. Cloudflare Worker (`worker/mute-mouse-2cd2/`)

**Purpose**: Central API server handling user management, data storage, and dashboard serving.

**Current Implementation**: Complete with all endpoints using Hono framework

**Key Endpoints**:
```
GET  /health                    - Health check
POST /api/create-user          - Legacy user creation (deprecated)
POST /api/update               - Data upload with writeToken auth  
GET  /api/blob/{publicId}      - Fetch encrypted data + user info
GET  /d/{publicId}             - Serve dashboard HTML
DELETE /api/user/{publicId}    - Admin user deletion
POST /api/admin/create-invite  - Generate invitation codes (requires x-admin-key header)
POST /api/register             - Register user with invitation code
GET  /api/admin/stats          - Admin statistics
POST /debug/fix-kdf/{publicId} - Fix KDF parameters (temporary debug)
GET  /debug/kv/{key}           - Read KV values (temporary debug)
```

**Authentication**:
- **Admin Endpoints**: Require `x-admin-key` header matching `ADMIN_API_KEY` environment variable
- **Data Updates**: Require `Authorization: Bearer <writeToken>` header
- **Dashboard**: Access via unguessable `publicId` URL + user passphrase

**Environment Variables Required**:
- `ADMIN_API_KEY` - Admin authentication key (not documented anywhere!)
- `USERS_KV` - KV namespace binding for user data storage
- `ENVIRONMENT` - "development" or "production"

### 2. Upload Script (`cloudflare-sync.js`)

**Purpose**: Monitors local data sources and uploads encrypted updates to Worker.

**Current Implementation**:
```javascript
#!/usr/bin/env node
// Uses PBKDF2-SHA256 + AES-GCM encryption
// Environment variables:
DASH_PASSPHRASE     // User passphrase (default: TestPassphrase123!)
DASH_SALT_B64       // Per-user salt (default: 1p7udJGXwrfk5IDzQUqSNw==)  
DASH_KDF_ITERS      // KDF iterations (default: 100000)
BASE_URL            // Worker URL (default: http://localhost:38472)
WRITE_TOKEN         // User's writeToken for authentication
```

**Encryption Flow**:
```
Data → JSON → PBKDF2-SHA256(passphrase, salt, 100k iters) → AES-GCM Key → Encrypt → Upload
```

**File Monitoring**: Watches `public/status.json` for changes, only uploads when content changes

### 3. Registration System (`setup-cloudflare.js`)

**Purpose**: User onboarding with invitation codes.

**Current Implementation**:
```javascript
#!/usr/bin/env node
// Environment variables:
BASE_URL            // Worker URL (default: https://your-worker-name.workers.dev)
```

**Registration Flow**:
1. User provides invitation code (from admin)
2. Script calls `/api/register` with invitation code
3. User sets passphrase (minimum requirements not enforced in script)
4. System generates user credentials and saves to `.cloudflare-config.json`
5. Returns dashboard URL for user access

### 4. Dashboard (`serveDashboard.ts` + Client-side JS)

**Purpose**: Web interface for viewing encrypted monitoring data.

**Current Implementation**:
- **Server-side**: Serves HTML with embedded JavaScript for client-side decryption
- **Client-side**: Fetches encrypted blob, decrypts with user passphrase, renders data
- **Crypto**: Uses PBKDF2-SHA256 + AES-GCM (matches upload script)
- **UI**: Responsive design with summary stats and individual watcher details

**Security Features**:
- All decryption happens client-side (zero-knowledge server)
- CSP headers to prevent XSS
- No passphrase transmitted to server

**Data Flow**:
```
User enters passphrase → Fetch /api/blob/{publicId} → Client-side PBKDF2+AES-GCM decrypt → Render UI
```

### 5. Invitation System (`createInvite.ts`)

**Purpose**: Admin-controlled user invitation generation.

**Implementation**:
- **Authentication**: Requires `x-admin-key` header
- **Invite Format**: `INVITE-ABC123-XYZ789` (readable, no confusing characters)
- **Storage**: Invitations stored in KV with expiration and usage tracking
- **Features**: Batch generation, expiration dates, usage notes

**API Request**:
```bash
curl -X POST http://localhost:38472/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 30, "note": "Test invitation"}'
```

## Implementation Status

### ✅ Completed Components
- Complete Worker with all endpoints (create-invite, register, update, dashboard, etc.)
- Upload script with AES-GCM encryption
- Dashboard with client-side AES-GCM decryption
- Registration system with invitation codes
- Admin endpoints with authentication
- Docker containerization setup

### 🔄 Critical Issues Requiring Immediate Fix
1. **KDF Algorithm Mismatch**: Config uses Argon2id, but scripts/dashboard use PBKDF2
2. **Port Configuration Mismatch**: Multiple different ports across files (38472, 38472, 8080)
3. **Environment Variables**: Missing complete Env type definition for Worker

### ❌ Blocking Issues
1. **Crypto Algorithm Inconsistency**: 
   - `.cloudflare-config.json`: `"algorithm": "argon2id"` 
   - `serveDashboard.ts`: Uses PBKDF2-SHA256
   - `cloudflare-sync.js`: Uses PBKDF2-SHA256
   - **Impact**: Dashboard cannot decrypt uploaded data
   
2. **Base URL Configuration Chaos**:
   - Config file: `http://localhost:38472`
   - Testing on: `http://localhost:38472` 
   - Setup script default: `https://your-worker-name.workers.dev`

3. **Missing Environment Variables**:
   - Worker expects `ADMIN_API_KEY` but it's not documented
   - Worker expects complete `Env` type but `types.ts` is incomplete

### ✅ Working Components (When Configured Correctly)
- **Invitation System**: Complete with admin authentication
- **Registration Flow**: `/api/register` endpoint implemented
- **Data Upload**: AES-GCM encryption working
- **Dashboard Serving**: HTML generation and client-side decryption ready
- **Admin Functions**: Stats, user management, invite creation

### 6. Dual Timer System (`cloudflare-sync.js` + Dashboard)

**Purpose**: Monitor system health and data freshness through two independent timers with visual status indicators.

**Architecture**: Backend heartbeat system synchronized with frontend display timers.

#### Backend Logic (cloudflare-sync.js)

**Timing Architecture**:
- **Heartbeat Interval**: 30 seconds (one heartbeat = 1HB)
- **Clock Synchronization**: Checks occur at UTC :02 and :32 seconds
- **Alive Signal**: Sent every 10 heartbeats (5 minutes) IF data source is active
- **Data Change Detection**: Immediate upload when actual data changes

**State Variables**:
```javascript
previousTimestamp = null      // Previous status.json lastUpdate value
currentTimestamp = null       // Current status.json lastUpdate value  
heartbeatCounter = 0          // Counts checks (0-9, resets after alive signal)
dataHash = null               // Hash of status.json (excluding timestamp)
prevDataHash = null           // Previous hash for change detection
monitorStartTime = null       // When system recovered from outage (>10.5 min)
lastDataChangeTime = null     // When actual data (not just timestamp) changed
lastUploadTime = null         // When last alive signal was sent
sequenceNumber = 0            // Monotonic upload counter (never resets)

Upload Decision Logic:
javascript

Every 30 seconds:
  1. Read status.json and extract timestamp
  2. Compare with previousTimestamp
  
  IF timestamp UNCHANGED:
     // write_status.js is down - DO NOT upload
     // Dashboard will naturally show orange → red
     
  IF timestamp CHANGED:
     previousTimestamp = currentTimestamp
     heartbeatCounter++
     
     Calculate dataHash (excluding timestamp field)
     
     IF dataHash ≠ prevDataHash:
        // Actual data changed - upload immediately
        uploadType = "data"
        lastDataChangeTime = NOW()
        heartbeatCounter = 0  // Reset counter
        
     ELSE IF heartbeatCounter >= 10:
        // Time for periodic alive signal
        uploadType = "alive"
        heartbeatCounter = 0  // Reset counter

Outage Recovery:
javascript

IF (NOW() - lastUploadTime) >= 360000:  // 6+ minutes
   // System recovering from outage
   monitorStartTime = NOW()  // Reset Timer A on dashboard

Upload Payload:
javascript

{
  nonce: "...",                                    // Encryption nonce
  ciphertext: "...",                               // Encrypted status data
  version: 4001,                                   // Increments with each upload
  issuedAt: "2025-10-10T10:30:00.000Z",           // Upload timestamp
  schemaVersion: 1,                                // Payload format version
  
  // Timer metadata
  monitorStartTime: "2025-10-10T08:00:00.000Z",   // System uptime anchor
  lastDataChangeTime: "2025-10-10T10:15:23.000Z", // Last data change
  uploadType: "alive" | "data",                   // Upload reason
  sequenceNumber: 1042                             // Monotonic counter
}

Frontend Display (dashboard_html.ts)

Timer Display Structure:
html

<div class="monitor-status-line">
  <span class="status-dot" id="statusDot"></span>
  <span id="monitorStatus">Monitor alive since:</span>
  <span id="timerA">00:00:00</span>
  <span class="separator">|</span>
  <span>Last data update:</span>
  <span id="timerB">00:00:00</span>
  <span>ago</span>
</div>

Timer Definitions:

Timer A (System Uptime):

    Shows: HH:MM:SS since last major outage recovery
    Calculation: NOW() - monitorStartTime
    Resets: When system recovers from 6+ minute silence
    Format: Always HH:MM:SS (e.g., 03:24:15)

Timer B (Data Freshness):

    Shows: HH:MM:SS since last data change
    Calculation: NOW() - lastDataChangeTime
    Resets: When actual watcher data changes (not just timestamp)
    Format: Always HH:MM:SS (e.g., 00:08:42)

Status Dot Colors:
javascript

const silenceMs = NOW() - lastUploadReceivedTime

IF silenceMs < 330000:       // 0-5.5 minutes
   dotColor = "green"
   statusText = "Monitor alive since:"
   
ELSE IF silenceMs < 360000:  // 5.5-6 minutes  
   dotColor = "orange"
   statusText = "Monitor unstable"
   
ELSE:                         // 6+ minutes
   dotColor = "red"
   statusText = "Monitor offline"

Update Loop:
javascript

setInterval(() => {
  const now = Date.now()
  
  // Update Timer A (System uptime)
  const uptimeMs = now - monitorStartTime
  document.getElementById('timerA').textContent = formatHMS(uptimeMs)
  
  // Update Timer B (Data freshness)
  const dataAgeMs = now - lastDataChangeTime
  document.getElementById('timerB').textContent = formatHMS(dataAgeMs)
  
  // Update status dot color based on communication health
  updateStatusDot()
  
}, 1000)  // Updates every second

Timer Formatting:
javascript

function formatHMS(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

System Behavior Scenarios

Scenario 1: Normal Operation

write_status.js updates every 30s
→ cloudflare-sync detects timestamp change
→ Every 5 minutes: alive signal uploaded
→ Dashboard: Green dot, timers running normally

Scenario 2: Data Source Down

write_status.js stops
→ cloudflare-sync sees unchanged timestamp
→ NO uploads sent (by design)
→ Dashboard: After 5.5 min → orange, after 6 min → red
→ Timers continue incrementing (showing staleness)

Scenario 3: Data Change

Watcher data actually changes (not just timestamp)
→ cloudflare-sync detects hash difference
→ Immediate "data" upload (resets heartbeat counter)
→ Timer B resets to 00:00:00
→ Dashboard: Refreshes with new data

Scenario 4: Recovery from Outage

System down for 6 minutes
→ write_status.js resumes
→ cloudflare-sync detects timestamp change after 10.5+ min silence
→ Sets monitorStartTime = NOW()
→ Immediate upload
→ Dashboard: Timer A resets to 00:00:00, dot returns to green

Key Design Principles

    Timestamp-Driven: Only upload when data source is actively updating
    Natural Failure Indication: No uploads → status dot naturally degrades
    Immediate Data Updates: Changes trigger instant uploads (don't wait for heartbeat)
    Visual Health Feedback: Three-color dot system provides instant status
    Persistent Monitoring: Timers show history even during communication gaps

Persistent State

Saved to .cf-sync-state.json:
json

{
  "prevDataHash": "a1b2c3d4...",
  "previousTimestamp": "2025-10-10T10:30:00.000Z",
  "heartbeatCounter": 3,
  "version": 4015,
  "sequenceNumber": 1042,
  "lastUploadTime": "2025-10-10T10:30:02.000Z",
  "monitorStartTime": "2025-10-10T08:00:02.000Z",
  "lastDataChangeTime": "2025-10-10T10:15:32.000Z",
  "timestamp": "2025-10-10T10:30:02.000Z"
}

Constants Reference
javascript

// Timing
CHECK_INTERVAL = 30000           // 30 seconds between heartbeats
ALIVE_SIGNAL_INTERVAL = 10       // Every 10 heartbeats = 5 minutes
UNSTABLE_TIMEOUT = 330000        // 5.5 minutes (just over 1 alive signal)
OFFLINE_TIMEOUT = 360000         // 6 minutes (just over 2 alive signals)

// UTC Synchronization
CHECK_TIMES = [2, 32]            // Seconds past minute for checks


## CRITICAL FIXES REQUIRED

### Priority 1: Fix KDF Algorithm Mismatch 

**Problem**: `.cloudflare-config.json` specifies Argon2id but all scripts use PBKDF2-SHA256, causing complete decryption failure.

**Current State**:
```json
// .cloudflare-config.json
{
  "kdfParams": {
    "algorithm": "argon2id",  // ← WRONG
    "iterations": 3,
    "memory": 65536, 
    "parallelism": 1
  }
}
```

**Fix Required**:
```json
// .cloudflare-config.json should be:
{
  "kdfParams": {
    "algorithm": "pbkdf2",    // ← CORRECT
    "iterations": 100000      // ← Match script default
  }
}
```

**Immediate Action**: Use Worker's debug endpoint to fix existing user records:
```bash
curl -X POST http://localhost:38472/debug/fix-kdf/YOUR_PUBLIC_ID
```

### Priority 2: Fix Port Configuration Chaos

**Problem**: Multiple inconsistent port configurations across files

**Current State**:
- Config file: `"baseUrl": "http://localhost:38472"`
- Worker default test: `http://localhost:38472`
- Upload script default: `BASE_URL=http://localhost:38472`

**Fix Required**:
1. **Choose ONE port for local development**: Recommend 38472 (matches wrangler dev default)
2. **Update .cloudflare-config.json**:
   ```json
   {"baseUrl": "http://localhost:38472"}
   ```
3. **Consistent environment variables** across all scripts

### Priority 3: Complete Environment Configuration

**Problem**: Missing critical environment variables and incomplete type definitions

**Required Environment Variables**:
```bash
# Required for Worker
ADMIN_API_KEY=your-secret-admin-key-here

# Required for upload script  
DASH_PASSPHRASE=your-secure-passphrase
DASH_SALT_B64=your-user-salt-from-config
WRITE_TOKEN=your-write-token-from-config
BASE_URL=http://localhost:38472

# Required for setup script
BASE_URL=http://localhost:38472
```

**Fix types.ts**:
```typescript
export interface Env {
  USERS_KV: KVNamespace;
  ADMIN_API_KEY: string;
  ENVIRONMENT: "development" | "production";
}
```

### Priority 4: Working Development Setup

**Complete Local Dev Setup (Corrected)**:

1. **Set Admin Key**:
   ```bash
   echo 'ADMIN_API_KEY=dev-admin-key-123' > ./worker/mute-mouse-2cd2/.dev.vars
   ```

2. **Start Worker**:
   ```bash
   cd ./worker/mute-mouse-2cd2
   wrangler dev --local --port 38472
   ```

3. **Create Invitation**:
   ```bash
   curl -X POST http://localhost:38472/api/admin/create-invite \
     -H "x-admin-key: dev-admin-key-123" \
     -H "Content-Type: application/json" \
     -d '{"count": 1, "expiresInDays": 30}'
   ```

4. **Register User**:
   ```bash
   BASE_URL=http://localhost:38472 node setup-cloudflare.js
   # Use invitation code from step 3
   ```

5. **Fix KDF Parameters**:
   ```bash
   curl -X POST http://localhost:38472/debug/fix-kdf/YOUR_PUBLIC_ID
   ```

6. **Upload Test Data**:
   ```bash
   BASE_URL=http://localhost:38472 \
   WRITE_TOKEN=your-token-from-config \
   DASH_PASSPHRASE=your-passphrase \
   DASH_SALT_B64=your-salt-from-config \
   node upload-once.js
   ```

7. **Access Dashboard**:
   ```
   http://localhost:38472/d/YOUR_PUBLIC_ID
   ```

## API Documentation

### Worker Endpoints (Based on Design Doc)

#### Admin Endpoints
```
POST /api/create-user
Headers: Authorization: Bearer <ADMIN_API_KEY>
Response: {publicId, writeToken, salt, kdfParams}
```

#### User Endpoints
```
POST /api/update
Headers: Authorization: Bearer <writeToken>
Body: {nonce, ciphertext, version, issuedAt, schemaVersion}

GET /api/blob/{publicId}
Response: {nonce, ciphertext, tag, rev, schemaVersion}

GET /d/{publicId}
Response: Dashboard HTML page
```

## Security Model

### Encryption Specifications
- **Algorithm**: AES-GCM (256-bit)
- **Key Derivation**: PBKDF2-SHA256 (100,000 iterations minimum)
- **Salt**: Per-user, stored in Worker KV
- **Nonce**: Random 12-byte IV per encryption
- **Passphrase**: Minimum 8 characters (digits/letters)

### Zero-Knowledge Design
- Server stores only encrypted blobs
- Passphrase never transmitted
- Decryption happens client-side only
- Salt and KDF parameters are public

### Authentication
- **Updates**: writeToken (Bearer auth)
- **Dashboard**: publicId in URL + passphrase
- **Admin**: API key for user creation/deletion

## Troubleshooting

### Common Issues

#### 1. Dashboard Shows "Not Found"
**Cause**: User record doesn't exist in Worker KV  
**Fix**: Create user with setup-cloudflare.js

#### 2. Decryption Fails
**Cause**: Passphrase incorrect or crypto mismatch  
**Fix**: Verify passphrase, check AES-GCM implementation

#### 3. Worker 404 on Endpoints
**Cause**: Wrong worker running or endpoint not implemented  
**Fix**: Verify correct worker directory, check route definitions

#### 4. Port Already in Use
**Fix**: `pkill -f "wrangler dev"` then restart

## Configuration Files

### .env Example
```
NODE_ENV=development
BASE_URL=http://localhost:38472
LOG_LEVEL=debug
```

### .cloudflare-config.json Structure
```json
{
  "publicId": "32-char-hex-string",
  "writeToken": "jwt-token-string",
  "salt": "base64-salt",
  "kdfParams": {"iterations": 100000},
  "dashboardUrl": "http://domain/d/{publicId}"
}
```

## Next Steps

### Immediate Priorities
1. **Fix User Registration**: Get invitation system working
2. **Test End-to-End Flow**: Upload → Dashboard → Decrypt
3. **Verify Worker Endpoints**: Document all available routes
4. **Clean Repository**: Remove unnecessary backup files

### Development Tasks
1. **Endpoint Discovery**: Map all Worker routes
2. **Error Handling**: Improve user experience for failures
3. **Documentation**: Complete API documentation
4. **Testing**: Automated test suite
5. **Production Deployment**: Move to live Cloudflare Worker

---

## Information Still Needed

To complete this documentation, I need:

1. **Worker Implementation Details**:
   - Contents of `worker/mute-mouse-2cd2/` directory
   - Available endpoints and their implementations
   - Environment variables and secrets required

2. **Configuration Details**:
   - Complete .env structure
   - Required API keys and how to obtain them
   - KV namespace configuration

3. **Current Issues Resolution**:
   - How invitation codes are created
   - Why dashboard shows 404 for existing publicId
   - Which endpoints are actually implemented

4. **Testing Data**:
   - Sample status.json structure
   - Expected data format for watchers
   - Error scenarios and handling

markdown




