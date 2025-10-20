#!/usr/bin/env node
/**
 * setup-cloudflare.js
 * -------------------
 * Registers a new user with the Worker and stores credentials in both:
 * - .cloudflare-config.json (for backwards compatibility)
 * - .env file (for easier use with start-monitoring.sh)
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
const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_FILE = path.join(process.cwd(), '.env.example');

// ---- Helper function to update or add environment variable ------------------
function updateOrAddEnvVar(content, varName, value) {
  const regex = new RegExp(`^${varName}=.*$`, 'gm');
  const newLine = `${varName}=${value}`;
  
  if (regex.test(content)) {
    // Variable exists, update it
    return content.replace(regex, newLine);
  } else {
    // Variable doesn't exist, add it
    return content + '\n' + newLine;
  }
}

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

function askPassword(question) {
  const rl = require('readline').createInterface({ 
    input: process.stdin, 
    output: process.stdout 
  });
  return new Promise(resolve => {
    // Simple password input (hiding characters would need additional complexity)
    rl.question(`${question}: `, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

// ---- main -------------------------------------------------------------------
(async function main() {
  console.log('Cloudflare Registration for Rosen Bridge Monitor\n');

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

  // Write to .cloudflare-config.json (for backwards compatibility)
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
  } catch (err) {
    console.error('Failed to write .cloudflare-config.json:');
    console.error(err);
    process.exit(1);
  }

  // Now update .env file with the credentials
  console.log('\n Updating .env file with credentials...');
  
  // Read existing .env or create from .env.example
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf8');
    console.log('Found existing .env file, updating it...');
  } else if (fs.existsSync(ENV_EXAMPLE_FILE)) {
    envContent = fs.readFileSync(ENV_EXAMPLE_FILE, 'utf8');
    console.log('Creating .env from .env.example...');
  } else {
    console.log('No .env or .env.example found, creating new .env...');
  }

  // Add header comment if this is a new section
  if (!envContent.includes('# Cloudflare Worker Configuration')) {
    envContent += '\n\n# Cloudflare Worker Configuration (auto-updated by setup-cloudflare.js)\n';
    envContent += `# Updated on: ${new Date().toISOString()}\n`;
    envContent += '# These values are specific to YOUR registration - do not share!\n';
  }

  // Update or add the registration values
  envContent = updateOrAddEnvVar(envContent, 'BASE_URL', BASE_URL);
  envContent = updateOrAddEnvVar(envContent, 'WRITE_TOKEN', reg.writeToken);
  envContent = updateOrAddEnvVar(envContent, 'DASH_SALT_B64', reg.salt);

  // Save .env
  try {
    fs.writeFileSync(ENV_FILE, envContent);
    console.log('Updated .env with registration credentials');
  } catch (err) {
    console.error('Failed to write .env file:');
    console.error(err);
    process.exit(1);
  }

  // Ask about passphrase
  console.log('\n Passphrase Configuration');
  console.log('You need a passphrase to encrypt your data.');
  console.log('This should be strong and memorable (20+ characters recommended).\n');
  
  const savePassphrase = await askYesNo('Would you like to save your passphrase to .env? (convenient but less secure)', true);
  
  if (savePassphrase) {
    const passphrase = await askPassword('Enter your passphrase');
    if (passphrase && passphrase.length >= 8) {
      envContent = fs.readFileSync(ENV_FILE, 'utf8');
      envContent = updateOrAddEnvVar(envContent, 'DASH_PASSPHRASE', passphrase);
      fs.writeFileSync(ENV_FILE, envContent);
      console.log('Passphrase saved to .env');
      console.log('Keep your .env file secure and never commit it to git!');
    } else {
      console.log('Warning! Passphrase too short (minimum 8 characters). Not saved.');
      console.log('You will need to provide it when running: DASH_PASSPHRASE="your-pass" ./start-monitoring.sh');
    }
  } else {
    console.log('Passphrase not saved (more secure)');
    console.log('You will need to provide it each time: DASH_PASSPHRASE="your-pass" ./start-monitoring.sh');
  }

  // Friendly summary
  console.log('\n Registration complete!\n');
  console.log('Configuration saved to:');
  console.log('  - .cloudflare-config.json (full config)');
  console.log('  - .env (credentials for monitoring)');
  console.log('\nYour dashboard URL:', reg.dashboardUrl);
  console.log('\nTo start monitoring:');
  if (savePassphrase) {
    console.log('  ./start-monitoring.sh');
  } else {
    console.log('  DASH_PASSPHRASE="your-passphrase" ./start-monitoring.sh');
  }
  console.log('\n');
})().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
