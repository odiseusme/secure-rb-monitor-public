#!/usr/bin/env node
/**
 * Cloudflare Sync Service for Rosen Bridge Monitor
 * Watches public/status.json and uploads to Cloudflare only when content changes
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// Crypto helper functions (AES-CBC/GCM via WebCrypto)
const { encryptGCM, encryptCBC, b64encode } = require('./cryptoHelpers');

// KDF/passphrase inputs (env-configurable)
const PASS_PHRASE = process.env.DASH_PASSPHRASE || 'TestPassphrase123!';           // TODO: set real passphrase via env
const SALT_B64    = process.env.DASH_SALT_B64   || '1p7udJGXwrfk5IDzQUqSNw==';     // Will be overridden by config.salt
const KDF_ITERS   = Number(process.env.DASH_KDF_ITERS || 100000);

// Worker endpoint & auth (env-configurable)
const BASE_URL    = process.env.BASE_URL || 'http://localhost:38472';
const WRITE_TOKEN = process.env.WRITE_TOKEN || '';

// Safe fetch fallback
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) throw new Error('No built-in fetch');
} catch {
  try {
    fetch = require('node-fetch');
  } catch (err) {
    console.error('ERROR: No fetch implementation available');
    console.error('Install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

const CONFIG_FILE = path.join(__dirname, '.cloudflare-config.json');
const STATUS_FILE = path.join(__dirname, 'public', 'status.json');
const LAST_HASH_FILE = path.join(__dirname, '.last-sync-hash');

class CloudflareSync {
  constructor() {
    this.config = null;
    this.version = 1;
    this.lastUploadTime = null;    
    this.monitorStartTime = null;
    this.lastDataChangeTime = null;
    this.sequenceNumber = 0;
    this.dataHash = null;
    this.prevDataHash = null;    
    this.HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.NORMAL_CHECK_INTERVAL = 30 * 1000;  // 30 seconds
    this.CHECK_TIMES = [2, 32]; // Seconds past minute for UTC-synchronized checks
    this.checkTimeoutId = null; // For managing scheduled checks
    // New v2 timestamp tracking
    this.previousTimestamp = null;  // Previous lastUpdate value from status.json
    this.currentTimestamp = null;   // Current lastUpdate value from status.json
    this.heartbeatCounter = 0;      // Counts 30-second checks (0-9)
    this.ALIVE_SIGNAL_INTERVAL = 10; // Send alive signal every 10 heartbeats
    this.loadConfig();
    this.loadLastHash();
  }

  loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.error('Configuration file not found. Run setup-cloudflare.js first.');
      process.exit(1);
    }

    this.config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    // Using passphrase-based encryption, no pre-derived key needed
    console.log(`[INIT] Using passphrase-based encryption`);
    console.log(`[INIT] Loaded configuration for user: ${this.config.publicId}`);
  }

loadLastHash() {
    if (fs.existsSync(LAST_HASH_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(LAST_HASH_FILE, 'utf8'));
        this.prevDataHash = data.prevDataHash || null;
        this.version = data.version || 1;
        this.sequenceNumber = data.sequenceNumber || 0;
        this.lastUploadTime = data.lastUploadTime ? new Date(data.lastUploadTime).getTime() : null;
        this.monitorStartTime = data.monitorStartTime ? new Date(data.monitorStartTime).getTime() : null;
        this.lastDataChangeTime = data.lastDataChangeTime ? new Date(data.lastDataChangeTime).getTime() : null;
        this.previousTimestamp = data.previousTimestamp || null;
        this.heartbeatCounter = data.heartbeatCounter || 0;
        console.log(`[INIT] Sequence number: ${this.sequenceNumber}`);
      } catch (err) {
        console.warn('[INIT] Could not load last sync hash, treating as first run');
      }
    }
  }
  
  scheduleNextCheck() {
    const now = new Date();
    const currentSeconds = now.getUTCSeconds();
    
    // Find next check time (either :02 or :32)
    let nextCheckSeconds;
    if (currentSeconds < 2) {
      nextCheckSeconds = 2;
    } else if (currentSeconds < 32) {
      nextCheckSeconds = 32;
    } else {
      nextCheckSeconds = 62; // Next minute's :02
    }
    
    const secondsUntilNext = (nextCheckSeconds - currentSeconds + 60) % 60;
    const msUntilNext = secondsUntilNext * 1000 - now.getUTCMilliseconds();
    
    // Clear any existing timeout
    if (this.checkTimeoutId) {
      clearTimeout(this.checkTimeoutId);
    }
    
    // Schedule the next check
    this.checkTimeoutId = setTimeout(() => {
      this.performHeartbeat().then(() => {
        this.scheduleNextCheck(); // Schedule the next check after this one completes
      });
    }, msUntilNext);
    
    console.log(`[SCHEDULE] Next check in ${Math.round(msUntilNext/1000)}s at :${nextCheckSeconds < 60 ? String(nextCheckSeconds).padStart(2,'0') : '02'}`);
  }
  
saveLastHash(version = null) {
  const data = {
    prevDataHash: this.prevDataHash,
    version: version || this.version,
    sequenceNumber: this.sequenceNumber,
    lastUploadTime: this.lastUploadTime ? new Date(this.lastUploadTime).toISOString() : null,
    monitorStartTime: this.monitorStartTime ? new Date(this.monitorStartTime).toISOString() : null,
    lastDataChangeTime: this.lastDataChangeTime ? new Date(this.lastDataChangeTime).toISOString() : null,
    previousTimestamp: this.previousTimestamp || null,
    heartbeatCounter: this.heartbeatCounter || 0,
    timestamp: new Date().toISOString() 
  };
  fs.writeFileSync(LAST_HASH_FILE, JSON.stringify(data, null, 2));
}

  calculateHash(data) {
    // Create a copy without the lastUpdate field to avoid false changes
    const dataForHash = { ...data };
    delete dataForHash.lastUpdate;
    return crypto.createHash('sha256').update(normalizeJsonString(dataForHash)).digest('hex');
  }

  async uploadToCloudflare(uploadType) {
    const workerUrl = process.env.BASE_URL || (this.config.baseUrl || this.config.dashboardUrl.split('/d/')[0]);
    console.log('[DEBUG] workerUrl =', workerUrl);

    // NEW: build encrypted payload (GCM) from the current status.json
    const raw = fs.readFileSync(STATUS_FILE, 'utf8');
    const data = JSON.parse(raw);
    
    // Data is being encrypted successfully

    // Increment version BEFORE upload attempt
    // Start with a high version number to avoid conflicts with existing Worker data
    const nextVersion = Math.max((this.version ?? 1) + 1, 4800);
const { payload, thisHash } = await buildEncryptedPayloadGCM(
  data,
  { 
    version: nextVersion, 
    prevHash: this.prevDataHash,
    passphrase: PASS_PHRASE,
    saltB64: this.config.salt,
    writeToken: this.config.writeToken,
    iterations: KDF_ITERS,
    lastDataChangeTime: this.lastDataChangeTime,
    monitorStartTime: this.monitorStartTime,
    uploadType: uploadType,
    sequenceNumber: this.sequenceNumber
  }
);

    // POST the encrypted payload to the Worker
    const response = await fetch(`${workerUrl}/api/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.writeToken || WRITE_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    // Handle result
    if (!response.ok) {
      const body = await response.text();
      console.error(`Upload failed: ${response.status}`, body);
      return false;
    }

// Success: bump version
this.version = nextVersion;
console.log('Upload OK, version:', nextVersion, 'bytes:', payload.ciphertext.length);
return true;
  }

async syncIfChanged() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      console.log('[SYNC] Status file not found, skipping sync');
      return false;
    }

    const statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    this.dataHash = this.calculateHash(statusData);

    // Compare with previous hash
    if (this.dataHash === this.prevDataHash) {
      return false; // No changes
    }

    console.log(`[SYNC] Data changed (${this.prevDataHash ? this.prevDataHash.substring(0, 8) : 'none'}... → ${this.dataHash.substring(0, 8)}...)`);
    return true; // Data changed

  } catch (err) {
    console.error('[SYNC] Error checking for changes:', err.message);
    return false;
  }
}


async performHeartbeat() {
  try {
    // 1. Read status.json
    if (!fs.existsSync(STATUS_FILE)) {
      console.log('[HB] Status file not found');
      return false;
    }
    
    const statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    this.currentTimestamp = statusData.lastUpdate;
    
    // 2. Check if timestamp changed
    const timestampChanged = (this.currentTimestamp !== this.previousTimestamp);
    
    // 3. Calculate data hash (excluding lastUpdate)
    const dataForHash = { ...statusData };
    delete dataForHash.lastUpdate;
    this.dataHash = this.calculateHash(dataForHash);
    const dataChanged = (this.dataHash !== this.prevDataHash);
    
    // 4. Determine if upload needed
    let shouldUpload = false;
    let uploadType = null;
    
    if (!timestampChanged) {
      // write_status.js is not updating - DO NOT upload anything
      console.log('[HB] Timestamp unchanged - write_status.js appears down');
      shouldUpload = false;
    } else {
      // write_status.js is alive
      this.previousTimestamp = this.currentTimestamp;
      this.heartbeatCounter++;
      
      if (dataChanged) {
        // Data changed - upload immediately
        uploadType = "data";
        shouldUpload = true;
        this.lastDataChangeTime = Date.now();
        this.heartbeatCounter = 0; // Reset counter
        console.log('[HB] Data changed - uploading immediately');
      } else if (this.heartbeatCounter >= this.ALIVE_SIGNAL_INTERVAL) {
        // Time for alive signal (every 10HB)
        uploadType = "alive";
        shouldUpload = true;
        this.heartbeatCounter = 0; // Reset counter
        console.log(`[HB] Sending alive signal after ${this.ALIVE_SIGNAL_INTERVAL} heartbeats`);
      } else {
        console.log(`[HB] Heartbeat ${this.heartbeatCounter}/${this.ALIVE_SIGNAL_INTERVAL} - no upload needed`);
      }
    }
    
    // 5. Handle outage recovery
    const now = Date.now();
    if (shouldUpload && this.lastUploadTime) {
      const timeSinceLastUpload = now - this.lastUploadTime;
      if (timeSinceLastUpload >= 630000) { // 630+ seconds
        // System recovering from outage
        this.monitorStartTime = now;
        console.log('[RECOVERY] System back online after outage');
      }
    }
    
    // 6. Execute upload if needed
    if (shouldUpload) {
      console.log(`[UPLOAD] Type: ${uploadType}, Sequence: ${this.sequenceNumber + 1}`);
      
      // Increment sequence number BEFORE upload
      this.sequenceNumber++;
      
      const result = await this.uploadToCloudflare(uploadType);
      
      if (result) {
        // Success: update state
        this.prevDataHash = this.dataHash;
        this.lastUploadTime = now;
        this.saveLastHash();
        console.log(`[UPLOAD] Success - ${uploadType} upload completed`);
        return true;
      } else {
        // Failed: rollback sequence number
        this.sequenceNumber--;
        this.heartbeatCounter = 10; // Force retry on next heartbeat
        console.log('[UPLOAD] Failed - will retry');
        return false;
      }
    }
    
    return false; // No upload needed
    
  } catch (err) {
    console.error('[HB] Error in performHeartbeat:', err.message);
    return false;
  }
}

async start() {
  console.log('[START] CloudflareSync started with UTC-synchronized timing');
  console.log(`[START] Monitoring: ${STATUS_FILE}`);
  console.log(`[START] Dashboard: ${this.config.dashboardUrl}`);
  console.log(`[START] Check times: :02 and :32 seconds past each minute (UTC)`);
  
  // Initial sync
  await this.performHeartbeat();

  // Initialize previousTimestamp from current status.json if not loaded
  if (this.previousTimestamp === null && fs.existsSync(STATUS_FILE)) {
    try {
      const statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      this.previousTimestamp = statusData.lastUpdate;
      console.log('[START] Initialized previousTimestamp:', this.previousTimestamp);
    } catch (err) {
      console.log('[START] Could not initialize previousTimestamp');
    }
  }

  // Start UTC-synchronized checking
  this.scheduleNextCheck();
}

async syncOnce() {
  console.log('[ONCE] Running one-time sync...');
  const synced = await this.performHeartbeat();
  if (synced) {
    console.log('[ONCE] Sync completed successfully');
  } else {
    console.log('[ONCE] No sync needed');
  }
  return synced;
}

}

async function main() {
  const args = process.argv.slice(2);
  const sync = new CloudflareSync();

  if (args.includes('--once')) {
    await sync.syncOnce();
    process.exit(0);
  }

  const interval = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 30;
  await sync.start(interval);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CloudflareSync;

// === added: stable JSON stringify and hash helpers (append-only) ===
let __nodeCrypto;
try { __nodeCrypto = require('crypto'); } catch {}

function normalizeJsonString(objOrString) {
  if (typeof objOrString === 'string') return objOrString;
  if (!objOrString || typeof objOrString !== 'object') return JSON.stringify(objOrString);
  // stable: sort top-level keys (good enough for change detection)
  const sortedKeys = Object.keys(objOrString).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = objOrString[key];
  }
  return JSON.stringify(sortedObj);
}

function sha256b64(s) {
  if (!__nodeCrypto) return null;
  return __nodeCrypto.createHash('sha256').update(s).digest('base64');
}

async function buildEncryptedPayloadGCM(data, opts = {}) {
  // opts: { version?: number, prevHash?: string }
  const schemaVersion = 1;
  const issuedAt = new Date().toISOString();

  // 1) prepare plaintext (stable JSON text for consistent hashing)
  const jsonText = normalizeJsonString(data);
  
  // Data is being processed correctly

  // 2) encrypt using PBKDF2-SHA256 -> AES-GCM (helpers handle WebCrypto)
  const enc = await encryptGCM({
    passphrase: opts.passphrase || PASS_PHRASE,   // use passed passphrase or fallback
    saltB64:   opts.saltB64 || SALT_B64,          // use passed salt or fallback
    plaintext: jsonText,
    iterations: opts.iterations || KDF_ITERS      // use passed iterations or fallback
  });

// 3) envelope to send to Worker
  const payload = {
    nonce: enc.nonceB64,
    ciphertext: enc.ctB64,
    version: (opts.version ?? 1),
    issuedAt,
    schemaVersion,
    lastDataChangeTime: opts.lastDataChangeTime || null,
    monitorStartTime: opts.monitorStartTime || null,
    uploadType: opts.uploadType || null,
    sequenceNumber: opts.sequenceNumber || 0
  };
if (opts.prevHash) payload.prevHash = opts.prevHash;

  // 4) compute current hash for caller to store/compare (helps skip unchanged)
  const thisHash = sha256b64(jsonText);

  return { payload, thisHash };
}
module.exports.buildEncryptedPayloadGCM = buildEncryptedPayloadGCM;

// === added: dry-run builder (only runs if DRY_RUN_BUILD=1) ===============
if (require.main === module && process.env.DRY_RUN_BUILD === '1') {
  (async () => {
    try {
      const statusPath = path.join(process.cwd(), 'public', 'status.json');
      const raw = fs.readFileSync(statusPath, 'utf8');
      const data = JSON.parse(raw);

      const prevHash = null;    // set to your stored last hash if you have one
      const version  = 1;       // set to your current version counter if you track one

      const { payload, thisHash } = await buildEncryptedPayloadGCM(data, { version, prevHash });

      console.log('DRY-RUN: payload keys =', Object.keys(payload));
      console.log('DRY-RUN: nonce length (b64 chars) =', payload.nonce.length);
      console.log('DRY-RUN: ciphertext length (b64 chars) =', payload.ciphertext.length);
      console.log('DRY-RUN: issuedAt =', payload.issuedAt, 'schemaVersion =', payload.schemaVersion);
      console.log('DRY-RUN: thisHash =', thisHash);
      process.exit(0);
    } catch (e) {
      console.error('DRY-RUN BUILD FAILED:', e);
      process.exit(1);
    }
  })();
}
