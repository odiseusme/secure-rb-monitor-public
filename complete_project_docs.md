# Rosen Bridge Monitor - Complete System Documentation

> **Last Updated:** October 11, 2025  
> **Version:** 1.0  
> **Status:** ✅ Ready for Public Release - All Critical Issues Resolved

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

### ✅ Previously Critical Issues - NOW RESOLVED

1. **Port Configuration**: ✅ **RESOLVED**
   - **Status**: Intentional design choice, now properly documented
   - **Solution**: Different ports by design:
     - Docker deployment: Port 8080 (configurable via `HOST_PORT`)
     - Cloudflare Worker/local development: Port 38472
   - **Documentation**: Clear explanation in README.md with configuration guidance

2. **Environment Variables**: ✅ **RESOLVED**
   - **Status**: ADMIN_API_KEY now properly documented
   - **Solution**: Complete environment variables section added to README.md
   - **Documentation**: 
     ```markdown
     **Cloudflare Worker:**
     - `ADMIN_API_KEY` (admin authentication)
     - `USERS_KV` (KV namespace binding)
     - `ENVIRONMENT` ("development" or "production")
     ```

3. **Base URL Configuration**: ✅ **RESOLVED**
   - **Status**: Configuration consistency achieved
   - **Solution**: Clear documentation of environment-specific URLs:
     - Cloudflare Worker/local development: `http://localhost:38472/`
     - Docker deployment: Uses `HOST_PORT` configuration
   - **Documentation**: README explains the intentional separation and configuration methods

4. **Development Setup**: ✅ **RESOLVED**
   - **Status**: Streamlined development workflow documented
   - **Solution**: Clear development workflow in README.md:
     1. Install Node.js (or use Docker)
     2. Run `./scripts/prepare_build.sh` for automatic setup
     3. Use `docker compose up -d --build` for testing
     4. Environment variables properly documented

### 🎯 Current Status: All Critical Issues Resolved

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


### CRITICAL FIXES - STATUS UPDATE

### ✅ Priority 1: Port Configuration - RESOLVED

**Background:**
The project intentionally uses different default ports for different environments:
- **Cloudflare Worker/local development:** Default port is `38472` (matches wrangler dev default and local testing scripts).
- **Docker deployment:** Default port is `8080` (configurable via `HOST_PORT` in `.env`).

**Resolution:**
This separation is now clearly documented in README.md as an intentional design choice. The documentation explains:
- How to configure each environment
- Which port to use for which deployment method
- Clear guidance on `HOST_PORT` (Docker) vs `BASE_URL` (Cloudflare/local dev) configuration

**Status:** ✅ **RESOLVED** - Properly documented as intentional design choice

### ✅ Priority 2: Environment Configuration - RESOLVED

**Problem**: Missing critical environment variables and incomplete type definitions

**Resolution:**
All required environment variables are now documented in README.md:

```markdown
**Cloudflare Worker:**
- `ADMIN_API_KEY` (admin authentication)
- `USERS_KV` (KV namespace binding)  
- `ENVIRONMENT` ("development" or "production")

**Upload Script:**
- `DASH_PASSPHRASE`, `DASH_SALT_B64`, `WRITE_TOKEN`, `BASE_URL`
```

**Status:** ✅ **RESOLVED** - Complete environment variable documentation provided

### ✅ Priority 3: Base URL Configuration - RESOLVED

**Problem**: Inconsistent BASE_URL configuration across different components

**Resolution:**
Clear documentation now explains the environment-specific approach:
- **Cloudflare Worker/local development**: `http://localhost:38472/`
- **Docker deployment**: Port configured via `HOST_PORT` environment variable
- **Production**: Uses actual Cloudflare Worker URL

**Status:** ✅ **RESOLVED** - Consistent configuration approach documented

### ✅ Priority 4: Development Setup - RESOLVED

**Problem**: Complex and unclear development setup process

**Resolution:**
Streamlined development workflow documented in README.md:

1. **Simple Setup Process:**
   ```bash
   git clone https://github.com/odiseusme/secure-rb-monitor-public.git
   cd secure-rb-monitor-public
   ./scripts/prepare_build.sh
   docker compose up -d --build
   ```

2. **Clear Development Workflow:**
   - Install Node.js (or rely on Docker)
   - Run preparation script for automatic setup
   - Use Docker Compose for testing
   - Environment variables properly documented

### ✅ Priority 4: TypeScript Types Completeness - RESOLVED

**Problem**: Missing `Env` interface definition in types.ts causing TypeScript compilation issues

**Resolution:**
Added complete `Env` interface to `worker/mute-mouse-2cd2/src/types.ts`:

```typescript
// Environment bindings interface for Cloudflare Worker
export interface Env {
  USERS_KV: KVNamespace;
  ADMIN_API_KEY: string;
  ENVIRONMENT: "development" | "production";
}
```

**Benefits:**
- ✅ Proper TypeScript type safety for Cloudflare Worker bindings
- ✅ IntelliSense and autocomplete for environment variables
- ✅ Compile-time error checking for environment variable access
- ✅ Self-documenting code for required environment variables

**Status:** ✅ **RESOLVED** - Complete TypeScript interface implemented

---

## 🎉 **ALL CRITICAL ISSUES SUCCESSFULLY RESOLVED**

**Summary:**
- ✅ Port Configuration - Documented as intentional design
- ✅ Environment Variables - Complete documentation in README.md  
- ✅ Base URL Configuration - Consistent approach established
- ✅ TypeScript Types - Complete Env interface implemented
- ✅ Development Setup - Streamlined workflow documented

**Project Status:** 🚀 **Ready for Public Release**

## API Documentation

## Admin Guide

### Overview
As an admin, you have full control over user registration, monitoring system usage, and adjusting rate limits. Admin operations require the `ADMIN_API_KEY` which must be kept secure.

### Admin Privileges

**What you can do:**
- Create invitation codes for user registration
- View detailed usage statistics for all users
- Monitor Cloudflare Worker request usage
- Delete users
- Re-enable rate limiting if approaching Cloudflare limits
- Access diagnostic endpoints

**What you cannot do (by design):**
- View user passphrases (zero-knowledge architecture)
- Decrypt user data (end-to-end encrypted)
- Access user's monitoring data without their passphrase

---

### Setting Up Admin Access

**1. Configure Admin API Key**

Create `.dev.vars` file in `worker/mute-mouse-2cd2/`:

```bash
echo 'ADMIN_API_KEY=your-secure-random-key-here' > worker/mute-mouse-2cd2/.dev.vars
```

**Generate a secure key:**
```bash
# Linux/Mac
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**2. For Production Deployment**

Add to your Cloudflare Worker environment variables:
```bash
wrangler secret put ADMIN_API_KEY
# Enter your secure key when prompted
```

---

### Admin Endpoints

#### 1. Create Invitation Codes

**Endpoint:** `POST /api/admin/create-invite`

**Request:**
```bash
curl -X POST http://localhost:38472/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 5,
    "expiresInDays": 30,
    "note": "Team onboarding batch"
  }'
```

**Response:**
```json
{
  "success": true,
  "invitations": [
    {
      "code": "INVITE-ABC123-XYZ789",
      "expiresAt": "2025-11-12T10:30:00.000Z"
    }
  ]
}
```

**Options:**
- `count`: Number of invites to generate (1-100)
- `expiresInDays`: Days until expiration (1-365)
- `note`: Optional description for tracking

---

#### 2. View Usage Statistics

**Endpoint:** `GET /api/admin/stats`

**Request:**
```bash
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalUsers": 12,
    "activeUsers": 8,
    "inactiveUsers": 4,
    "suspiciousUsers": 1,
    "totalInvitesSent": 15,
    "unusedInvites": 3
  },
  "users": [
    {
      "publicId": "abc123...",
      "inviteCode": "INVITE-XXX-YYY",
      "registeredAt": "2025-10-01T10:00:00.000Z",
      "lastActivity": "2025-10-12T13:15:00.000Z",
      "daysSinceActivity": 0,
      "totalRequests": 450,
      "rateLimitViolations": 0,
      "avgRequestsPerDay": 45,
      "suspiciousActivity": false,
      "suspiciousReasons": []
    }
  ]
}
```

**Suspicious Activity Detection:**
- Excessive rate limit violations (>10)
- Unusually high request rate (>200/day)
- High request count with no recent activity

**Query Parameters:**
```bash
# Show only suspicious users
curl "http://localhost:38472/api/admin/stats?suspiciousOnly=true" \
  -H "x-admin-key: YOUR_ADMIN_KEY"

# Include inactive users (>30 days)
curl "http://localhost:38472/api/admin/stats?includeInactive=true" \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

---

#### 3. Delete User

**Endpoint:** `DELETE /api/user/{publicId}`

**Request:**
```bash
curl -X DELETE http://localhost:38472/api/user/abc123xyz \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Warning:** This permanently deletes:
- User credentials
- All uploaded monitoring data
- Rate limit counters

---

### Monitoring Cloudflare Usage

#### Current Request Patterns (v1.0 with rate limiting disabled)

**Per User:**
- Dashboard polling: 60 requests/hour (1 per minute)
- Upload frequency: ~12 requests/hour (every 5 minutes)
- **Total per user:** ~72 requests/hour = ~1,728 requests/day

**Cloudflare Free Tier:**
- **Limit:** 100,000 requests/day
- **Maximum users before limit:** ~57 users
- **Recommended max (80% buffer):** ~45 users

#### Calculating Your Usage

**Formula:**
```
Daily Requests = (Number of Active Users) × 1,728
```

**Examples:**
- 10 users = 17,280 requests/day (17% of limit) âœ… Safe
- 25 users = 43,200 requests/day (43% of limit) âœ… Safe
- 50 users = 86,400 requests/day (86% of limit) âš ï¸ Approaching limit
- 60 users = 103,680 requests/day (104% of limit) ❌ Over limit

#### Viewing Actual Usage

**Cloudflare Dashboard:**
1. Log in to Cloudflare dashboard
2. Go to Workers & Pages
3. Select your worker
4. View "Requests" metrics

**Check via API:**
```bash
# Get user stats to see total requests
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY" | jq '.users[].totalRequests'
```

---

### Re-Enabling Rate Limiting

**When to enable:** If you're approaching 80,000 requests/day (80% of Cloudflare free tier)

#### Step 1: Uncomment Rate Limiting Code

Edit `worker/mute-mouse-2cd2/src/endpoints/getBlob.ts`:

**Find this section (~line 68):**
```typescript
/* RATE LIMITING DISABLED FOR PUBLIC RELEASE v1.0
 * Can be re-enabled post-release if needed
 * See complete_project_docs.md for instructions
 * 
// Rate limiting for reads
const rateLimitKey = `rate:${publicId}`;
... (commented code)
*/
```

**Change to:**
```typescript
// Rate limiting for reads - ENABLED
const rateLimitKey = `rate:${publicId}`;
const rateLimitData = await c.env.USERS_KV.get(rateLimitKey);

let rateLimit;
if (rateLimitData) {
  rateLimit = JSON.parse(rateLimitData);
} else {
  rateLimit = {
    reads: 0,
    lastReset: new Date().toISOString()
  };
}

const now = new Date();
const lastReset = new Date(rateLimit.lastReset);
const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

// Reset counters if more than an hour has passed
if (hoursSinceReset >= 1) {
  rateLimit.reads = 0;
  rateLimit.lastReset = now.toISOString();
  await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
}

// Check if rate limit exceeded
if (rateLimit.reads >= 120) {  // 120 reads per hour = 2 hours at 60s polling
  userData.rateLimitViolations = (userData.rateLimitViolations || 0) + 1;
  await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData));
  return c.json({ error: "Rate limit exceeded" }, 429);
}

// Increment counter after checking limit
rateLimit.reads++;
await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
```

#### Step 2: Adjust Rate Limit Value

**Current setting:** `>= 120` (allows 2 hours of continuous dashboard use)

**Options:**
```typescript
if (rateLimit.reads >= 60)   // 1 hour at 60s polling
if (rateLimit.reads >= 120)  // 2 hours (recommended)
if (rateLimit.reads >= 240)  // 4 hours (generous)
```

**Choose based on your usage patterns and Cloudflare limits.**

#### Step 3: Deploy Changes

**For local development:**
```bash
# Restart wrangler - changes are auto-reloaded
# Ctrl+C, then restart
cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local
```

**For production:**
```bash
cd worker/mute-mouse-2cd2
wrangler deploy
```

#### Step 4: Monitor Impact

**After enabling, check:**
1. User complaints about 429 errors
2. Whether usage drops to acceptable levels
3. Adjust limit if needed (increase/decrease)

**View violations:**
```bash
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY" | jq '.users[] | {publicId, rateLimitViolations}'
```

---

### User Registration Workflow (Admin Perspective)

#### Automated Registration (Recommended)

Use the helper script:

```bash
./scripts/register-user.sh
```

This will:
1. Auto-detect admin key from `.dev.vars`
2. Generate invitation code
3. Register user interactively
4. Create monitoring startup script

#### Manual Registration (Advanced)

**Step 1: Create invitation**
```bash
curl -X POST http://localhost:38472/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 30}'
```

**Step 2: Share code with user**

Send the invitation code securely (email, secure chat, etc.)

**Step 3: User registers**

User runs:
```bash
BASE_URL=http://localhost:38472 node setup-cloudflare.js
```

And enters the invitation code.

**Step 4: Verify registration**

Check admin stats:
```bash
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

---

### Best Practices

#### Security

1. **Never commit `.dev.vars` to git** (already in .gitignore)
2. **Use strong, unique admin keys** (32+ random characters)
3. **Rotate admin keys periodically** (every 90 days)
4. **Share invitation codes securely** (not in public channels)
5. **Monitor suspicious activity regularly**

#### Maintenance

1. **Check usage weekly** via `/api/admin/stats`
2. **Clean up inactive users** after 90 days
3. **Monitor Cloudflare dashboard** for approaching limits
4. **Keep backups** of user data if needed
5. **Document user onboarding** for your team

#### Scaling

**If approaching Cloudflare limits:**
1. Enable rate limiting (see section above)
2. Consider reducing dashboard polling interval
3. Upgrade to Cloudflare paid plan ($5/month for 10M requests)
4. Implement request caching strategies

---

### Troubleshooting Admin Issues

#### "Unauthorized" Error

**Cause:** Wrong admin key or missing `.dev.vars`

**Fix:**
```bash
# Check if .dev.vars exists
cat worker/mute-mouse-2cd2/.dev.vars

# Recreate if missing
echo 'ADMIN_API_KEY=your-key' > worker/mute-mouse-2cd2/.dev.vars

# Restart wrangler
```

#### Cannot See User Data

**Cause:** Zero-knowledge architecture - this is by design

**Explanation:** You can see:
- User statistics (requests, activity)
- Rate limit violations
- Registration dates

You CANNOT see:
- User passphrases
- Decrypted monitoring data
- Dashboard contents

#### High Rate Limit Violations

**Investigation steps:**
1. Check user's request patterns
2. Verify they're not running multiple dashboard instances
3. Ask if they experienced connection issues
4. Consider if rate limit is too aggressive

**Solution:**
Either increase rate limit or ask user to reduce polling frequency.

---

### Admin Command Reference

**Quick commands for common tasks:**

```bash
# Create 10 invitations
curl -X POST http://localhost:38472/api/admin/create-invite \
  -H "x-admin-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 10, "expiresInDays": 7}'

# View all active users
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_KEY" | jq '.users[] | select(.daysSinceActivity <= 7)'

# Find users with high violations
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_KEY" | jq '.users[] | select(.rateLimitViolations > 10)'

# Count total daily requests
curl http://localhost:38472/api/admin/stats \
  -H "x-admin-key: YOUR_KEY" | jq '[.users[].avgRequestsPerDay] | add'

# Delete inactive user
curl -X DELETE http://localhost:38472/api/user/USERID \
  -H "x-admin-key: YOUR_KEY"
```

---

### Need Help?

For admin-specific questions or issues:
1. Check this documentation first
2. Review the troubleshooting section
3. Open an issue on GitHub (for public questions)
4. Check Cloudflare Workers logs for errors

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

## 🎯 Final Project Status Summary

### ✅ All Critical Issues Successfully Resolved (October 11, 2025)

**Previously identified blocking issues:**
1. **✅ Port Configuration Mismatch** → Documented as intentional design choice
2. **✅ Missing ADMIN_API_KEY Documentation** → Complete environment variables section added
3. **✅ Base URL Configuration Chaos** → Consistent approach documented  
4. **✅ Incomplete TypeScript Types** → Complete Env interface implemented
5. **✅ Complex Development Setup** → Streamlined workflow established

### 📋 Current Implementation Status

**✅ Documentation Excellence:**
- Comprehensive README.md with clear setup instructions
- All environment variables properly documented
- Development workflow clearly defined
- TypeScript interfaces complete and type-safe

**✅ Multiple Deployment Options:**
- Docker deployment with automatic setup script
- Cloudflare Worker deployment fully documented
- Local development environment established

**✅ Security-First Architecture:**
- Zero-knowledge, end-to-end encryption implemented
- No privileged access requirements
- Security features comprehensively documented

### 🚀 **FINAL STATUS: PROJECT READY FOR PUBLIC RELEASE**

All critical issues identified in the original documentation have been resolved. The project now provides:

- ✅ **Clear documentation** for all deployment scenarios
- ✅ **Resolved configuration inconsistencies** with proper documentation
- ✅ **Complete environment variable documentation** 
- ✅ **TypeScript type safety** with proper interfaces
- ✅ **Streamlined development workflow** 
- ✅ **Production-ready security architecture**

**Date Completed:** October 11, 2025  
**Status:** Ready for public release and community use

markdown




