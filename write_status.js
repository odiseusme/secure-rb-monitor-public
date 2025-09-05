#!/usr/bin/env node
// Status data generator for remote Rosen Bridge monitoring
// Creates status.json for access from any PC or mobile device
// Optimized for static hosting and cloud deployment
// API-ONLY VERSION - No Docker socket dependency

const fs = require('fs');
const path = require('path');

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
let CONFIG = {
  statusFile: path.join(__dirname, 'public', 'status.json'),
  ergoExplorerApi: 'https://api.ergoplatform.com',
  timeout: 10000,
  watchers: []
};

// Mutex to prevent overlapping cycles
let updateInProgress = false;

// Load config file if exists
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    CONFIG = { ...CONFIG, ...userConfig };
    console.log('[INFO] Loaded configuration');
  } catch (err) {
    console.warn('  Failed to load config.json:', err.message);
  }
}

// Retry helper with jittered backoff
async function withRetry(fn, maxRetries = 1, baseDelay = 500) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const jitter = Math.random() * 300;
      const delay = baseDelay + jitter;
      console.log(`  Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Fetch JSON from URL with retry logic
async function fetchJson(url, headers = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG.timeout);
      const res = await fetch(url, { 
        headers, 
        signal: controller.signal 
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      console.log(`  Retry ${i + 1}/${retries} for ${url}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Complete balance fetcher from Ergo Explorer API
async function getAllBalances(address, rsnTokenId, eRsnTokenId) {
  try {
    const apiUrl = `${CONFIG.ergoExplorerApi}/api/v1/addresses/${address}/balance/confirmed`;
    const balanceData = await fetchJson(apiUrl);
    
    // ERG balance: convert from nanoERG to ERG
    const ergBalance = (balanceData.nanoErgs || 0) / 1e9;
    
    let rsnBalance = 0;
    let eRsnBalance = 0;
    
    // Process tokens if they exist
    if (balanceData.tokens && Array.isArray(balanceData.tokens)) {
      for (const token of balanceData.tokens) {
        if (token.tokenId === rsnTokenId && token.amount && token.decimals !== undefined) {
          rsnBalance = token.amount / Math.pow(10, token.decimals);
        }
        if (token.tokenId === eRsnTokenId && token.amount && token.decimals !== undefined) {
          eRsnBalance = token.amount / Math.pow(10, token.decimals);
        }
      }
    }
    
    return { 
      ergBalance: +ergBalance.toFixed(6),
      rsnBalance: +rsnBalance.toFixed(3),
      eRsnBalance: +eRsnBalance.toFixed(3)
    };
  } catch (err) {
    console.error(`  Failed to fetch balances for ${address}: ${err.message}`);
    return { 
      ergBalance: 0, 
      rsnBalance: 0, 
      eRsnBalance: 0 
    };
  }
}

// Calculate permit status with rich data format (preserving original detailed format)
function calculatePermitStatus(activeRaw, totalRaw, permitsPerEvent = 3000000) {
  const ppe = Math.max(1, Number(permitsPerEvent));
  const activeBlocks = Math.floor(Number(activeRaw) / ppe);
  const totalBlocks = Math.floor(Number(totalRaw) / ppe);
  
  let status = 'sufficient';
  if (activeBlocks <= 0) status = 'exhausted';
  else if (activeBlocks === 1) status = 'critical';

  return {
    status,
    message: status.charAt(0).toUpperCase() + status.slice(1),
    utilization: totalBlocks > 0 ? (totalBlocks - activeBlocks) / totalBlocks : 0,
    available: activeBlocks,
    total: totalBlocks,
    blocks: { 
      available: activeBlocks, 
      total: totalBlocks 
    },
    raw: { 
      available: Number(activeRaw), 
      total: Number(totalRaw) 
    },
    permitsPerEvent: ppe
  };
}

// Collect watcher status via API (no Docker)
async function collectWatcherStatus(watcher) {
  const result = {
    name: watcher.name,
    port: extractPortFromName(watcher.name),
    network: watcher.network || 'unknown',
    container: watcher.name,
    containerStatus: 'running', // Assume running if we can reach it
    healthStatus: 'unknown',
    permitStatus: 'unknown',
    currentBalance: null,
    rsnBalance: null,
    eRsnBalance: null,
    errors: []
  };

  try {
    // Get watcher info from API
    const info = await withRetry(async () => {
      return await fetchJson(watcher.url);
    }, 1, 500);

    // Health status
    result.healthStatus = info?.health?.status || 'unknown';

    // Network (override if provided by API)
    if (info.network) {
      result.network = info.network;
    }

    // Permit processing with rich format
    if (info.permitCount && 
        info.permitCount.active !== undefined && 
        info.permitCount.total !== undefined) {
      
      const activeRaw = info.permitCount.active;
      const totalRaw = info.permitCount.total;
      const permitsPerEvent = info.permitsPerEvent || 3000000;

      result.permitStatus = calculatePermitStatus(activeRaw, totalRaw, permitsPerEvent);
    }

    // Fetch balances from Ergo Explorer if we have the needed info
    if (info.address && info.rsnTokenId && info.eRsnTokenId) {
      console.log(`    Fetching balances from Ergo Explorer for ${info.address}...`);
      const balances = await withRetry(async () => {
        return await getAllBalances(info.address, info.rsnTokenId, info.eRsnTokenId);
      }, 1, 1000);
      
      result.currentBalance = balances.ergBalance;
      result.rsnBalance = balances.rsnBalance;
      result.eRsnBalance = balances.eRsnBalance;
    } else {
      // Fallback to watcher API for ERG balance only
      if (typeof info.currentBalance !== 'undefined') {
        result.currentBalance = +(info.currentBalance / 1e9).toFixed(6);
      }
    }

    // Trial errors
    if (Array.isArray(info.health?.trialErrors)) {
      result.errors.push(...info.health.trialErrors);
    }

  } catch (err) {
    result.errors.push(err.message || String(err));
    result.containerStatus = 'unknown';
    result.healthStatus = 'unknown';
    console.error(`    ${watcher.name}: ${err.message}`);
  }

  return result;
}

// Extract port from watcher name (e.g., "watcher_3030-service-1" -> 3030)
function extractPortFromName(name) {
  const match = name.match(/watcher_(\d+)/);
  return match ? parseInt(match[1], 10) : 3000;
}

// Concurrency-controlled batch processing
async function runBatches(thunks, limit) {
  const results = new Array(thunks.length);
  let i = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= thunks.length) break;
      try {
        results[idx] = await thunks[idx]();
      } catch (err) {
        results[idx] = { error: String(err?.message || err) };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// Main execution
(async () => {
  try {
    // Mutex guard - prevent overlapping cycles
    if (updateInProgress) {
      console.log('[MUTEX] Update already in progress, skipping cycle');
      return;
    }
    updateInProgress = true;

    // Get watchers from config
    const watchers = CONFIG.watchers || [];
    console.log(`[API] Discovered ${watchers.length} watchers from configuration`);

    if (!watchers.length) {
      console.warn('[WARN] No watchers found in configuration');
      return;
    }

    // Process watchers with concurrency limit
    const CONCURRENCY = Number(process.env.COLLECT_CONCURRENCY || 4);
    console.log(`[COLLECT] Processing ${watchers.length} watchers with concurrency=${CONCURRENCY}...`);

    // Build thunks for concurrent processing
    const watcherThunks = watchers.map(watcher => async () =>
      collectWatcherStatus(watcher)
    );

    // Run with concurrency control
    const watcherResults = await runBatches(watcherThunks, CONCURRENCY);

    const results = {};

    // Process results
    for (let i = 0; i < watcherResults.length; i++) {
      const watcher = watchers[i];
      const watcherData = watcherResults[i];

      console.log(` Processing result for ${watcher.name}...`);
      results[watcher.name] = watcherData;
    }

    // Calculate summary stats
    const watcherValues = Object.values(results);
    const summary = {
      total: watcherValues.length,
      healthy: watcherValues.filter(w => w.healthStatus === 'Healthy').length,
      unstable: watcherValues.filter(w => w.healthStatus === 'Unstable').length,
      broken: watcherValues.filter(w => w.healthStatus === 'Broken').length,
      sufficient: watcherValues.filter(w => (w.permitStatus?.status) === 'sufficient').length,
      critical: watcherValues.filter(w => (w.permitStatus?.status) === 'critical').length,
      exhausted: watcherValues.filter(w => (w.permitStatus?.status) === 'exhausted').length
    };

    // Create final payload
    const payload = {
      summary,
      watchers: results,
      lastUpdate: new Date().toISOString()
    };

    // Atomic write
    const tmpFile = CONFIG.statusFile + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
    fs.renameSync(tmpFile, CONFIG.statusFile);
    console.log(`[WRITE] Updated status.json with ${watcherValues.length} watchers`);

  } catch (err) {
    console.error('[FATAL] Update cycle failed:', err.message);
  } finally {
    // Always release mutex
    updateInProgress = false;
  }
})();
