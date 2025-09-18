#!/usr/bin/env node
/**
 * setup-cloudflare.js
 * -------------------
 * Registers a new user with the Worker and stores credentials in .cloudflare-config.json
 *
 * HOW TO USE (local dev):
 *   BASE_URL=http://localhost:38472 node setup-cloudflare.js
 *
 * HOW TO USE (prod default):
 *   node setup-cloudflare.js
 *   (defaults BASE_URL to the workers.dev URL below)
 */

const fs = require('fs');
const path = require('path');

// ---- BASE URL (this is the key change) --------------------------------------
// You can override with: BASE_URL=http://localhost:38472 node setup-cloudflare.js
const BASE_URL = process.env.BASE_URL || 'https://your-worker-name.workers.dev';

// ---- fetch shim for Node (uses built-in if present, else node-fetch) --------
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    fetchFn = require('node-fetch');
  } catch (err) {
    console.error('ERROR: No fetch implementation available.');
    console.error('Install node-fetch:  npm install node-fetch');
    process.exit(1);
  }
}

// ---- Files / paths -----------------------------------------------------------
const CONFIG_FILE = path.join(process.cwd(), '.cloudflare-config.json');

// ---- tiny prompt helpers -----------------------------------------------------
function askYesNo(question, defaultNo = true) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${question} (${defaultNo ? 'y/N' : 'Y/n'}): `, (ans) => {
      rl.close();
      const a = (ans || '').trim().toLowerCase();
      if (!a) return resolve(!defaultNo); // enter = default
      resolve(a === 'y' || a === 'yes');
    });
  });
}

function askLine(question) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${question}: `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// ---- main -------------------------------------------------------------------
(async function main() {
  console.log('🔐 Cloudflare Registration for Rosen Bridge Monitor\n');

  // If config exists, ask if they want to create a new registration
  let existing = null;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (_) {}
  }

  if (existing) {
    console.log('Found existing configuration.');
    const doNew = await askYesNo('Do you want to create a new registration?', true);
    if (!doNew) {
      console.log('Okay, keeping existing configuration. Exiting.');
      process.exit(0);
    }
  }

  // Ask for invite code
  const inviteCode = await askLine('Enter your invitation code');
  if (!inviteCode) {
    console.error('No invite code entered. Exiting.');
    process.exit(1);
  }

  // Register with Worker
  console.log('\nRegistering with Cloudflare...');
  let reg;
  try {
    const resp = await fetchFn(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inviteCode })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(`Registration failed: HTTP ${resp.status}`);
      console.error(text || '(no response body)');
      process.exit(1);
    }

    reg = await resp.json();
  } catch (err) {
    console.error(err);
    console.error('\nHINT: If you are testing locally, make sure your worker is running, e.g.:');
    console.error('  npx wrangler dev --local --port 38472');
    console.error('and run this script with:');
    console.error('  BASE_URL=http://localhost:38472 node setup-cloudflare.js');
    process.exit(1);
  }

  // Expecting: { success, publicId, writeToken, salt, kdfParams, dashboardUrl }
  if (!reg || !reg.success || !reg.publicId || !reg.writeToken) {
    console.error('Unexpected response from /api/register:');
    console.error(reg);
    process.exit(1);
  }

  // Build the config we persist
  const newConfig = {
    baseUrl: BASE_URL,                // <- keep the BASE_URL we used
    publicId: reg.publicId,
    writeToken: reg.writeToken,
    salt: reg.salt,
    kdfParams: reg.kdfParams,
    dashboardUrl: reg.dashboardUrl
  };

  // Write file
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
  } catch (err) {
    console.error('Failed to write .cloudflare-config.json:');
    console.error(err);
    process.exit(1);
  }

  // Friendly summary
  console.log('\n✅ Registration complete. Saved to .cloudflare-config.json\n');
  console.log('Public ID:    ', reg.publicId);
  console.log('Write token:  ', reg.writeToken);
  console.log('Salt (b64):   ', reg.salt);
  console.log('Dashboard URL:', reg.dashboardUrl);
  console.log('\nYou can now run your uploader or open the dashboard URL above.\n');
})().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

