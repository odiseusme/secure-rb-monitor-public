#!/usr/bin/env node
/**
 * One-shot encrypted upload that always uses a fresh version:
 * version = (current rev from /api/blob/:publicId) + 1
 *
 * Requires env:
 *   BASE_URL         e.g. http://localhost:38472
 *   WRITE_TOKEN      your write token
 *   DASH_PASSPHRASE  passphrase used by dashboard
 *   DASH_SALT_B64    salt (base64) for PBKDF2
 *   DASH_KDF_ITERS   e.g. 100000
 *
 * Reads plaintext from ./public/status.json
 */
const fs = require('fs');
const path = require('path');

const { encryptGCM } = require('./cryptoHelpers'); // same helpers you used elsewhere

const BASE_URL       = process.env.BASE_URL || 'http://localhost:38472';
const WRITE_TOKEN    = process.env.WRITE_TOKEN;
const PASS_PHRASE    = process.env.DASH_PASSPHRASE || '';
const SALT_B64       = process.env.DASH_SALT_B64 || '';
const KDF_ITERS      = Number(process.env.DASH_KDF_ITERS || 100000);

if (!WRITE_TOKEN || !PASS_PHRASE || !SALT_B64) {
  console.error('ERROR: missing one of WRITE_TOKEN / DASH_PASSPHRASE / DASH_SALT_B64');
  process.exit(1);
}

// Load .cloudflare-config.json for publicId
const CFG_PATH = path.join(process.cwd(), '.cloudflare-config.json');
if (!fs.existsSync(CFG_PATH)) {
  console.error('ERROR: .cloudflare-config.json not found (need publicId)');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const PUBLIC_ID = cfg.publicId;
if (!PUBLIC_ID) {
  console.error('ERROR: publicId missing in .cloudflare-config.json');
  process.exit(1);
}

// Small stable stringify for consistent hashing (optional)
function normalizeJsonString(objOrString) {
  if (typeof objOrString === 'string') return objOrString;
  if (!objOrString || typeof objOrString !== 'object') return JSON.stringify(objOrString);
  return JSON.stringify(objOrString, Object.keys(objOrString).sort());
}

async function getCurrentRev() {
  const url = `${BASE_URL}/api/blob/${PUBLIC_ID}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET ${url} -> ${res.status}: ${t}`);
  }
  const j = await res.json();
  return (j && j.data && typeof j.data.rev === 'number') ? j.data.rev : 0;
}

async function main() {
  try {
    // 1) Determine next version (avoid 409)
    const currentRev = await getCurrentRev().catch(() => 0);
    const version = currentRev + 1;

    // 2) Load plaintext to upload
    const statusPath = path.join(process.cwd(), 'public', 'status.json');
    const raw = fs.readFileSync(statusPath, 'utf8');
    const data = JSON.parse(raw);
    const jsonText = JSON.stringify(data);

    // 3) Encrypt with PBKDF2-SHA256 -> AES-GCM (same as dashboard)
    const enc = await encryptGCM({
      passphrase: PASS_PHRASE,
      saltB64:    SALT_B64,
      plaintext:  jsonText,
      iterations: KDF_ITERS,
    });

    // 4) Build payload (Worker expects nonce + ciphertext + tag + version + issuedAt + schemaVersion)
    //    NOTE: encryptGCM returns combined GCM ciphertext (with tag) in enc.ctB64
    //    We split out tag for the Worker since its schema has a separate "tag" field.
    //    If your encryptGCM already returns tag separately, use that instead.
    const issuedAt = new Date().toISOString();
    const schemaVersion = 1;

    // If your encryptGCM returns "tagB64", use it; otherwise split last 16 bytes from raw binary:
    let ctB64 = enc.ctB64;
    let tagB64 = enc.tagB64;
    if (!tagB64) {
      // Split GCM tag (last 16 bytes) from the raw bytes:
      const bin = Buffer.from(ctB64, 'base64');
      const tag = bin.subarray(bin.length - 16);
      const ct  = bin.subarray(0, bin.length - 16);
      tagB64 = tag.toString('base64');
      ctB64  = ct.toString('base64');
    }

    const payload = {
      nonce: enc.nonceB64,         // 12B base64
      ciphertext: enc.ctB64,        // ciphertext WITH tag (as Worker expects)
      version,
      issuedAt,
      schemaVersion,
      // prevHash optional
    };

console.log("Uploading payload:", JSON.stringify(payload, null, 2));

    // 5) POST to /api/update
    const res = await fetch(`${BASE_URL}/api/update`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${WRITE_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[UPLOAD] HTTP', res.status);
      console.error('[UPLOAD] Response (first 200 chars):', text.slice(0, 200));
      process.exit(1);
    }
    console.log('[UPLOAD] HTTP', res.status);
    console.log('[UPLOAD] Response (first 200 chars):', text.slice(0, 200));
  } catch (err) {
    console.error('UPLOAD-ONCE FAILED:', err);
    process.exit(1);
  }
}

main();

