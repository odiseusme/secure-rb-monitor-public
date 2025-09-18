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
const SALT_B64    = process.env.DASH_SALT_B64   || '1p7udJGXwrfk5IDzQUqSNw==';     // TODO: set real per-user salt via env
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

async function promptPassphrase() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    // Hide input for password
    const originalWrite = process.stdout.write;
    let hidden = false;
    
    process.stdout.write = function(chunk, encoding, fd) {
      if (hidden) return true;
      return originalWrite.apply(process.stdout, arguments);
    };
    
    readline.question('Enter your dashboard passphrase: ', (answer) => {
      hidden = false;
      process.stdout.write = originalWrite;
      console.log(); // New line after hidden input
      readline.close();
      resolve(answer.trim());
    });
    
    hidden = true;
  });
}

class CloudflareSync {
  constructor() {
    this.config = null;
    this.encryptionKey = null;
    this.lastHash = null;
    this.version = 1;
    this.passphrase = null; // Store securely in memory
    
    this.loadConfig();
    this.loadLastHash();
  }

  loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.error('Configuration file not found. Run setup-cloudflare.js first.');
      process.exit(1);
    }

    this.config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    if (!this.config._encryptionKey) {
      console.error('Encryption key not found in configuration.');
      process.exit(1);
    }

    // Convert Buffer to Uint8Array for Web Crypto compatibility
    const keyBuffer = Buffer.from(this.config._encryptionKey, 'base64');
    this.encryptionKey = new Uint8Array(keyBuffer);
    console.log(`[INIT] Loaded configuration for user: ${this.config.publicId}`);
  }

  async initialize() {
    // Prompt for passphrase at startup
    this.passphrase = await promptPassphrase();
    if (!this.passphrase || this.passphrase.length < 8) {
      console.error('Invalid passphrase. Must be at least 8 characters.');
      process.exit(1);
    }
    console.log('[INIT] Passphrase accepted - ready to sync');
  }

  loadLastHash() {
    if (fs.existsSync(LAST_HASH_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(LAST_HASH_FILE, 'utf8'));
        this.lastHash = data.hash;
        this.version = data.version || 1;
        console.log(`[INIT] Last sync hash loaded: ${this.lastHash.substring(0, 8)}...`);
      } catch (err) {
        console.warn('[INIT] Could not load last sync hash, treating as first run');
      }
    }
  }

  saveLastHash(hash) {
    const data = {
      hash,
      version: this.version,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(LAST_HASH_FILE, JSON.stringify(data, null, 2));
  }

calculateHash(data) {
  return crypto.createHash('sha256').update(normalizeJsonString(data)).digest('hex');
}

  async uploadToCloudflare(encryptedData) {
const workerUrl = process.env.BASE_URL || (this.config.baseUrl || this.config.dashboardUrl.split('/d/')[0]);
console.log('[DEBUG] workerUrl =', workerUrl);


// NEW: build encrypted payload (GCM) from the current status.json
const raw = fs.readFileSync(STATUS_FILE, 'utf8');
const data = JSON.parse(raw);

const { payload, thisHash } = await buildEncryptedPayloadGCM(
  data,
  { version: (this.version ?? 1), prevHash: this.lastHash }
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

// Success: store hash & bump version
this.saveLastHash(thisHash);
this.version = (this.version ?? 1) + 1;
console.log('Upload OK, version:', this.version - 1, 'bytes:', payload.ciphertext.length);
return true;
}

  async syncIfChanged() {
    try {
      if (!fs.existsSync(STATUS_FILE)) {
        console.log('[SYNC] Status file not found, skipping sync');
        return false;
      }

      const statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      const currentHash = this.calculateHash(statusData);

      if (currentHash === this.lastHash) {
        console.log('[SYNC] No changes detected, skipping upload');
        return false;
      }

      console.log(`[SYNC] Changes detected (${this.lastHash ? this.lastHash.substring(0, 8) : 'none'}... → ${currentHash.substring(0, 8)}...)`);

const result = await this.uploadToCloudflare();   // now builds & uploads inside
if (result) {
  this.lastHash = currentHash;                   // keep in sync with our precomputed hash
  return true;
}
return false;


      this.version = result.revision || (this.version + 1);
      this.lastHash = currentHash;
      this.saveLastHash(currentHash);

      console.log(`[SYNC] Successfully uploaded to Cloudflare (revision: ${this.version})`);
      return true;

    } catch (err) {
      console.error('[SYNC] Sync failed:', err.message);
      return false;
    }
  }

  async start(intervalSeconds = 30) {
    console.log(`[START] CloudflareSync started, checking every ${intervalSeconds} seconds`);
    console.log(`[START] Monitoring: ${STATUS_FILE}`);
    console.log(`[START] Dashboard: ${this.config.dashboardUrl}`);

    await this.syncIfChanged();

    setInterval(async () => {
      await this.syncIfChanged();
    }, intervalSeconds * 1000);
  }

  async syncOnce() {
    console.log('[ONCE] Running one-time sync...');
    const synced = await this.syncIfChanged();
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
  
  // Initialize (prompt for passphrase)
  await sync.initialize();

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
  return JSON.stringify(objOrString, Object.keys(objOrString).sort());
}

function sha256b64(s) {
  if (!__nodeCrypto) return null;
  return __nodeCrypto.createHash('sha256').update(s).digest('base64');
}

// === added: buildEncryptedPayloadGCM (append-only, safe) ==================
async function buildEncryptedPayloadGCM(data, opts = {}) {
  // opts: { version?: number, prevHash?: string }
  const schemaVersion = 1;
  const issuedAt = new Date().toISOString();

  // 1) prepare plaintext (stable JSON text for consistent hashing)
  const jsonText = normalizeJsonString(data);

  // 2) encrypt using PBKDF2-SHA256 -> AES-GCM (helpers handle WebCrypto)
  const enc = await encryptGCM({
    passphrase: PASS_PHRASE,   // from env (DASH_PASSPHRASE)
    saltB64:   SALT_B64,       // from env (DASH_SALT_B64)
    plaintext: jsonText,
    iterations: KDF_ITERS
    // Optional AAD example (tie to account/schema):
    // aadB64: b64encode(new TextEncoder().encode(`${process.env.PUBLIC_ID || ''}|${schemaVersion}`))
  });

  // 3) envelope to send to Worker
  const payload = {
    nonce: enc.nonceB64,                  // 12-byte GCM nonce (base64)
    ciphertext: enc.ctB64,                // includes auth tag
    version: (opts.version ?? 1),         // your monotonic version counter (if you track one)
    issuedAt,                             // ISO timestamp
    schemaVersion                         // bump on schema changes
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
