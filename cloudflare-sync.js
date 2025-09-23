#!/usr/bin/env node
// Cloudflare sync script for Rosen Bridge Monitor
// Watches public/status.json and uploads changes to Cloudflare only when content updates

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Safe fetch fallback (built-in or node-fetch)
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) throw new Error('No built-in fetch');
  console.log('[NETWORK] Using built-in fetch');
} catch {
  try {
    fetch = require('node-fetch');
    console.log('[NETWORK] Using node-fetch module');
  } catch (err) {
    console.error('[ERROR] No fetch implementation available');
    process.exit(1);
  }
}

// Configuration
const CONFIG = {
  statusFile: path.join(__dirname, 'public', 'status.json'),
  cloudflareConfigFile: path.join(__dirname, '.cloudflare-config.json'),
  lastHashFile: path.join(__dirname, '.last-sync-hash'),
  watchInterval: Number(process.env.WATCH_INTERVAL) || 5000, // 5 seconds
  timeout: Number(process.env.FETCH_TIMEOUT) || 30000, // 30 seconds
  maxRetries: Number(process.env.MAX_RETRIES) || 3,
};

// Environment variables
const ENV = {
  BASE_URL: process.env.BASE_URL,
  WRITE_TOKEN: process.env.WRITE_TOKEN,
  DASH_PASSPHRASE: process.env.DASH_PASSPHRASE,
  DASH_SALT_B64: process.env.DASH_SALT_B64,
};

// State
let cloudflareConfig = null;
let lastKnownHash = null;
let watchTimeout = null;
let isShuttingDown = false;

/**
 * Enhanced logging with timestamps and categories
 */
function log(category, message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category}] ${message}`, ...args);
}

function logError(category, message, error) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${category}] ${message}`, error?.message || error);
  if (error?.stack) {
    console.error(`[${timestamp}] [${category}] Stack:`, error.stack);
  }
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  log('INIT', 'Validating environment variables...');
  
  const missing = [];
  Object.entries(ENV).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
    } else {
      log('ENV', `${key}: ${'*'.repeat(Math.min(8, value.length))}`);
    }
  });
  
  if (missing.length > 0) {
    logError('ENV', `Missing required environment variables: ${missing.join(', ')}`);
    log('ENV', 'Required environment variables:');
    log('ENV', '  BASE_URL - Cloudflare endpoint URL');
    log('ENV', '  WRITE_TOKEN - Authentication token for uploads');
    log('ENV', '  DASH_PASSPHRASE - Dashboard passphrase');
    log('ENV', '  DASH_SALT_B64 - Base64 encoded salt');
    return false;
  }
  
  log('ENV', 'All required environment variables are present');
  return true;
}

/**
 * Load and validate Cloudflare configuration
 */
function loadCloudflareConfig() {
  log('CONFIG', `Loading Cloudflare configuration from ${CONFIG.cloudflareConfigFile}`);
  
  try {
    if (!fs.existsSync(CONFIG.cloudflareConfigFile)) {
      logError('CONFIG', `Cloudflare config file not found: ${CONFIG.cloudflareConfigFile}`);
      log('CONFIG', 'Creating example .cloudflare-config.json file...');
      
      const exampleConfig = {
        endpoint: "https://api.cloudflare.com/client/v4",
        accountId: "your-account-id",
        namespaceId: "your-kv-namespace-id",
        keyName: "status-data",
        encryption: {
          algorithm: "aes-256-gcm",
          keyDerivation: "pbkdf2"
        }
      };
      
      try {
        fs.writeFileSync(CONFIG.cloudflareConfigFile, JSON.stringify(exampleConfig, null, 2));
        log('CONFIG', 'Example .cloudflare-config.json created - please configure it with your actual values');
      } catch (writeErr) {
        logError('CONFIG', 'Failed to create example config file', writeErr);
      }
      
      return false;
    }
    
    const configData = fs.readFileSync(CONFIG.cloudflareConfigFile, 'utf8');
    cloudflareConfig = JSON.parse(configData);
    
    // Validate required config fields
    const requiredFields = ['endpoint', 'accountId', 'namespaceId', 'keyName'];
    const missingFields = requiredFields.filter(field => !cloudflareConfig[field]);
    
    if (missingFields.length > 0) {
      logError('CONFIG', `Missing required fields in Cloudflare config: ${missingFields.join(', ')}`);
      return false;
    }
    
    log('CONFIG', 'Cloudflare configuration loaded successfully');
    log('CONFIG', `Endpoint: ${cloudflareConfig.endpoint}`);
    log('CONFIG', `Account ID: ${cloudflareConfig.accountId}`);
    log('CONFIG', `Namespace ID: ${cloudflareConfig.namespaceId}`);
    log('CONFIG', `Key Name: ${cloudflareConfig.keyName}`);
    
    return true;
    
  } catch (err) {
    logError('CONFIG', 'Failed to load Cloudflare configuration', err);
    return false;
  }
}

/**
 * Calculate hash of file content
 */
function calculateFileHash(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log('HASH', `File does not exist: ${filePath}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    log('HASH', `Calculated hash for ${path.basename(filePath)}: ${hash.substring(0, 16)}...`);
    return hash;
    
  } catch (err) {
    logError('HASH', `Failed to calculate hash for ${filePath}`, err);
    return null;
  }
}

/**
 * Load last known hash from persistent storage
 */
function loadLastKnownHash() {
  try {
    if (fs.existsSync(CONFIG.lastHashFile)) {
      lastKnownHash = fs.readFileSync(CONFIG.lastHashFile, 'utf8').trim();
      log('HASH', `Loaded last known hash: ${lastKnownHash.substring(0, 16)}...`);
    } else {
      log('HASH', 'No previous hash file found - will sync on first change');
      lastKnownHash = null;
    }
  } catch (err) {
    logError('HASH', 'Failed to load last known hash', err);
    lastKnownHash = null;
  }
}

/**
 * Save hash to persistent storage
 */
function saveLastKnownHash(hash) {
  try {
    fs.writeFileSync(CONFIG.lastHashFile, hash);
    log('HASH', `Saved hash: ${hash.substring(0, 16)}...`);
  } catch (err) {
    logError('HASH', 'Failed to save hash', err);
  }
}

/**
 * Fetch current revision from Cloudflare with enhanced error handling
 */
async function fetchCurrentRevision() {
  log('FETCH', 'Fetching current revision from Cloudflare...');
  
  const url = `${cloudflareConfig.endpoint}/accounts/${cloudflareConfig.accountId}/storage/kv/namespaces/${cloudflareConfig.namespaceId}/values/${cloudflareConfig.keyName}`;
  
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      log('FETCH', 'Request timeout - aborting fetch operation');
    }, CONFIG.timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ENV.WRITE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timer);
    
    log('FETCH', `Response status: ${response.status} ${response.statusText}`);
    
    if (response.status === 404) {
      log('FETCH', 'No existing data found in Cloudflare KV - this is normal for first upload');
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.text();
    log('FETCH', `Retrieved ${data.length} bytes from Cloudflare`);
    return data;
    
  } catch (err) {
    if (err.name === 'AbortError') {
      logError('FETCH', 'Request timed out', err);
    } else {
      logError('FETCH', 'Failed to fetch current revision', err);
    }
    throw err;
  }
}

/**
 * Upload data to Cloudflare with enhanced error handling and retry logic
 */
async function uploadToCloudflare(data) {
  log('UPLOAD', 'Uploading data to Cloudflare...');
  
  const url = `${cloudflareConfig.endpoint}/accounts/${cloudflareConfig.accountId}/storage/kv/namespaces/${cloudflareConfig.namespaceId}/values/${cloudflareConfig.keyName}`;
  
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      log('UPLOAD', `Attempt ${attempt}/${CONFIG.maxRetries}`);
      
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        log('UPLOAD', 'Request timeout - aborting upload operation');
      }, CONFIG.timeout);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ENV.WRITE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: data,
        signal: controller.signal,
      });
      
      clearTimeout(timer);
      
      log('UPLOAD', `Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      log('UPLOAD', 'Upload successful', result);
      return result;
      
    } catch (err) {
      if (err.name === 'AbortError') {
        logError('UPLOAD', `Attempt ${attempt} timed out`, err);
      } else {
        logError('UPLOAD', `Attempt ${attempt} failed`, err);
      }
      
      if (attempt === CONFIG.maxRetries) {
        throw err;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 30000);
      log('UPLOAD', `Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Check for status.json changes and sync if needed
 */
async function checkForChanges() {
  if (isShuttingDown) {
    log('WATCH', 'Shutting down - skipping change check');
    return;
  }
  
  log('WATCH', 'Checking for changes in status.json...');
  
  try {
    // Check if status.json exists
    if (!fs.existsSync(CONFIG.statusFile)) {
      log('WATCH', `Status file not found: ${CONFIG.statusFile}`);
      log('WATCH', 'This is normal if write_status.js has not run yet');
      return;
    }
    
    // Calculate current hash
    const currentHash = calculateFileHash(CONFIG.statusFile);
    if (!currentHash) {
      log('WATCH', 'Failed to calculate current hash - skipping this check');
      return;
    }
    
    // Compare with last known hash
    if (lastKnownHash === currentHash) {
      log('WATCH', 'No changes detected');
      return;
    }
    
    log('WATCH', 'Changes detected - preparing to sync');
    log('WATCH', `Previous hash: ${lastKnownHash ? lastKnownHash.substring(0, 16) + '...' : 'none'}`);
    log('WATCH', `Current hash:  ${currentHash.substring(0, 16)}...`);
    
    // Read the status data
    const statusData = fs.readFileSync(CONFIG.statusFile, 'utf8');
    log('WATCH', `Status data size: ${statusData.length} bytes`);
    
    // Validate JSON
    try {
      const parsed = JSON.parse(statusData);
      log('WATCH', `Parsed JSON with ${Object.keys(parsed).length} top-level keys`);
      if (parsed.lastUpdate) {
        log('WATCH', `Data last updated: ${parsed.lastUpdate}`);
      }
    } catch (parseErr) {
      logError('WATCH', 'Status data is not valid JSON', parseErr);
      return;
    }
    
    // Upload to Cloudflare
    try {
      await uploadToCloudflare(statusData);
      
      // Update last known hash only after successful upload
      lastKnownHash = currentHash;
      saveLastKnownHash(currentHash);
      
      log('SYNC', 'Successfully synced status data to Cloudflare');
      
    } catch (uploadErr) {
      logError('SYNC', 'Failed to upload to Cloudflare', uploadErr);
      // Don't update lastKnownHash so we'll retry next time
    }
    
  } catch (err) {
    logError('WATCH', 'Error during change check', err);
  }
}

/**
 * Start the file watcher
 */
function startWatcher() {
  log('WATCH', `Starting file watcher (interval: ${CONFIG.watchInterval}ms)`);
  log('WATCH', `Monitoring: ${CONFIG.statusFile}`);
  
  // Initial check
  checkForChanges();
  
  // Set up periodic checking
  function scheduleNext() {
    if (!isShuttingDown) {
      watchTimeout = setTimeout(() => {
        checkForChanges().finally(scheduleNext);
      }, CONFIG.watchInterval);
    }
  }
  
  scheduleNext();
}

/**
 * Graceful shutdown
 */
function shutdown() {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  log('SHUTDOWN', 'Initiating graceful shutdown...');
  
  if (watchTimeout) {
    clearTimeout(watchTimeout);
    watchTimeout = null;
    log('SHUTDOWN', 'Cleared watch timeout');
  }
  
  log('SHUTDOWN', 'Cloudflare sync script stopped');
  process.exit(0);
}

/**
 * Main initialization and startup
 */
async function main() {
  log('INIT', 'Starting Cloudflare sync script for Rosen Bridge Monitor');
  log('INIT', `Process ID: ${process.pid}`);
  log('INIT', `Node.js version: ${process.version}`);
  log('INIT', `Working directory: ${process.cwd()}`);
  
  // Set up signal handlers for graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGHUP', shutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logError('FATAL', 'Uncaught exception', err);
    shutdown();
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logError('FATAL', 'Unhandled promise rejection', reason);
    console.error('[FATAL] Promise:', promise);
    shutdown();
  });
  
  try {
    // Validate environment
    if (!validateEnvironment()) {
      log('INIT', 'Environment validation failed - exiting');
      process.exit(1);
    }
    
    // Load Cloudflare configuration
    if (!loadCloudflareConfig()) {
      log('INIT', 'Cloudflare configuration failed - exiting');
      process.exit(1);
    }
    
    // Load last known hash
    loadLastKnownHash();
    
    // Test Cloudflare connectivity
    log('INIT', 'Testing Cloudflare connectivity...');
    try {
      await fetchCurrentRevision();
      log('INIT', 'Cloudflare connectivity test successful');
    } catch (err) {
      logError('INIT', 'Cloudflare connectivity test failed', err);
      log('INIT', 'Will continue anyway - connectivity issues may be temporary');
    }
    
    // Start watching for changes
    startWatcher();
    
    log('INIT', 'Cloudflare sync script started successfully');
    
  } catch (err) {
    logError('INIT', 'Failed to initialize', err);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((err) => {
    logError('MAIN', 'Startup failed', err);
    process.exit(1);
  });
}

module.exports = {
  validateEnvironment,
  loadCloudflareConfig,
  calculateFileHash,
  fetchCurrentRevision,
  uploadToCloudflare,
  checkForChanges,
};