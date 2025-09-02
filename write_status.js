#!/usr/bin/env node
// Status data generator for remote Rosen Bridge monitoring
// Creates status.json for access from any PC or mobile device
// Optimized for static hosting and cloud deployment

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Safe fetch fallback (built-in or node-fetch)
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) throw new Error('No built-in fetch');
  console.log('[NETWORK] Using fetch module');
} catch {
  try {
    fetch = require('node-fetch');
    console.log('[NETWORK] Using fetch module');
  } catch (err) {
    console.error('[ERROR]');
    process.exit(1);
  }
}

// Configuration
let CONFIG = {
  statusFile: path.join(__dirname, 'public', 'status.json'),
  ergoExplorerApi: 'https://api.ergoplatform.com',
  dockerCmd: null,
  timeout: 10000  // Increased to 10s
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

// Run shell command with timeout
function run(cmd, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
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

// Concurrency limiter
async function mapWithConcurrency(items, fn, limit = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchPromises = batch.map(fn);
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Batch item failed:', result.reason?.message || result.reason);
        results.push({
          errors: [`Collection failed: ${result.reason?.message || 'Unknown error'}`],
          healthStatus: 'unknown',
          permitStatus: 'unknown'
        });
      }
    }
  }
  return results;
}

// Auto-detect Docker
async function findDocker() {
  if (CONFIG.dockerCmd) {
    try {
      await run(`${CONFIG.dockerCmd} --version`);
      return CONFIG.dockerCmd;
    } catch {
      console.warn(`  Configured docker path ${CONFIG.dockerCmd} not working, auto-detecting...`);
    }
  }
  const dockerPaths = ['docker', '/snap/bin/docker', '/usr/bin/docker'];
  for (const path of dockerPaths) {
    try {
      await run(`${path} --version`);
      console.log(` Found Docker at: ${path}`);
      return path;
    } catch {}
  }
  throw new Error('Docker not found!');
}

// Fetch JSON from URL with retry logic
async function fetchJson(url, headers = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers, timeout: CONFIG.timeout });
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

// General watcher discovery
async function discoverWatchers(dockerCmd) {
  try {
    console.log('[SEARCH] Getting container list...');
    const output = await run(`${dockerCmd} ps --format "{{.Names}}\t{{.Ports}}"`);
    if (!output || output.trim() === '') {
      console.warn('[WARN] No containers found');
      return [];
    }
    
    const lines = output.split('\n').filter(line => line.trim());
    const containers = {};
    
    lines.forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const ports = parts[1].trim();
        containers[name] = ports;
      }
    });
    
    console.log(' Found containers:', Object.keys(containers));
    const watchers = [];
    
    for (const [serviceName, servicePorts] of Object.entries(containers)) {
      if (serviceName.includes('-service-1')) {
        console.log(` Processing service container: ${serviceName}`);
        const baseName = serviceName.replace('-service-1', '');
        const uiName = `${baseName}-ui-1`;
        
        if (containers[uiName]) {
          const uiPorts = containers[uiName];
          const portMatch = uiPorts.match(/:(\d+)->/);
          const port = portMatch ? parseInt(portMatch[1], 10) : 3000;
          console.log(` Found watcher with port ${port}`);
          watchers.push({ 
            name: serviceName, 
            container: serviceName, 
            port, 
            network: 'unknown' 
          });
        } else {
          console.warn(`  No UI container found for service: ${serviceName}, using port 3000`);
          watchers.push({ 
            name: serviceName, 
            container: serviceName, 
            port: 3000, 
            network: 'unknown' 
          });
        }
      }
    }
    
    console.log(` Discovered ${watchers.length} watchers total`);
    return watchers;
  } catch (err) {
    console.error(' Error discovering watchers:', err.message);
    return [];
  }
}

// Docker info with retry helper - FIXED
async function dockerInfoWithRetry(dockerCmd, container, maxAttempts = 2) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const out = await run(`${dockerCmd} exec ${container} curl -s --max-time 8 http://localhost:3000/info`, 10000);
      if (out && out.trim()) return out.trim();
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
      await new Promise(r => setTimeout(r, 200 + Math.floor(Math.random() * 400)));
    }
  }
  return '';
}

// Collect status from inside container
async function collectWatcherStatus(watcher, dockerCmd) {
  const result = {
    name: watcher.name,
    port: watcher.port,
    network: watcher.network,
    container: watcher.container,
    containerStatus: 'unknown',
    healthStatus: 'unknown',
    permitStatus: 'unknown',
    currentBalance: null,
    rsnBalance: null,
    eRsnBalance: null,
    errors: []
  };

  try {
    // Check container status with retry
    const containerStatus = await withRetry(
      () => run(`${dockerCmd} inspect ${watcher.container} --format='{{.State.Status}}'`, 10000),
      1, 400
    );
    result.containerStatus = containerStatus || 'unknown';

    // Get watcher info with retry
    const infoRaw = await withRetry(
      () => run(`${dockerCmd} exec ${watcher.container} curl -s --max-time 8 http://localhost:3000/info`, 10000),
      1, 500
    );

    if (!infoRaw || !infoRaw.trim()) {
      throw new Error('Empty response from watcher API');
    }

    let info;
    try {
      info = JSON.parse(infoRaw);
    } catch (e) {
      throw new Error('Invalid JSON from watcher API');
    }

    // Health status
    result.healthStatus = (info?.health?.status) || 'unknown';

    // Network (override discovery 'unknown')
    if (info.network) {
      result.network = info.network;
    }

    // Permits
    if (info.permitCount && 
        typeof info.permitCount.active !== 'undefined' && 
        typeof info.permitCount.total !== 'undefined') {
      
      const active = info.permitCount.active;
      const total = info.permitCount.total;
      const totalBlocks = Math.floor(total / 3000000);
      let availableBlocks = Math.floor(active / 3000000);
      if (active === total) availableBlocks = totalBlocks;

      result.permitStatus = availableBlocks === 0 ? 'degraded' :
                           availableBlocks < totalBlocks ? 'partial' : 'healthy';
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
    console.error(`    ${watcher.container}: ${err.message}`);
  }

  return result;
}

// Calculate permit status (backward-compatible).
// Legacy: calculatePermitStatus(availableBlocks, totalBlocks, permitsPerEvent)
// New:    calculatePermitStatus({ activeRaw, totalRaw, permitsPerEvent })
function calculatePermitStatus(a, b, c) {
  // New API: object with raw permits
  if (a && typeof a === 'object') {
    const activeRaw = Number(a.activeRaw || 0);
    const totalRaw = Number(a.totalRaw || 0);
    const ppe = Math.max(1, Number(a.permitsPerEvent || 3000000));

    const availableBlocks = Math.floor(activeRaw / ppe);
    const totalBlocks = Math.floor(totalRaw / ppe);

    let status = 'sufficient';
    if (availableBlocks <= 0) status = 'exhausted';
    else if (availableBlocks === 1) status = 'critical';

    return {
      status,
      message: status.charAt(0).toUpperCase() + status.slice(1),
      utilization: 0,
      // Display counts in *permits* (blocks) for the UI:
      available: availableBlocks,
      total: totalBlocks,
      // Keep both for debugging / future use:
      blocks: { available: availableBlocks, total: totalBlocks },
      raw: { available: activeRaw, total: totalRaw },
      permitsPerEvent: ppe
    };
  }

  // Legacy API: numbers = blocks
  const availableBlocks = Number(a || 0);
  const totalBlocks = Number(b || 0);
  const ppe = Math.max(1, Number(c || 3000000));

  let status = 'sufficient';
  if (availableBlocks <= 0) status = 'exhausted';
  else if (availableBlocks === 1) status = 'critical';

  return {
    status,
    message: status.charAt(0).toUpperCase() + status.slice(1),
    utilization: 0,
    available: availableBlocks, // legacy behavior (blocks)
    total: totalBlocks,         // legacy behavior (blocks)
    blocks: { available: availableBlocks, total: totalBlocks },
    permitsPerEvent: ppe
  };
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

    const dockerCmd = await findDocker();
    console.log('[SEARCH] Getting container list...');
    const watchers = await discoverWatchers(dockerCmd);
    console.log(` Discovered ${watchers.length} watchers`);

    if (!watchers.length) {
      console.warn('[WARN] No watchers found');
      return;
    }

    // Process watchers with concurrency limit of 4 (real cap, no pre-start)
    const CONCURRENCY = Number(process.env.COLLECT_CONCURRENCY || 4);
    console.log(`[COLLECT] Processing ${watchers.length} watchers with concurrency=${CONCURRENCY}...`);

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

    // Build thunks WITHOUT starting requests yet
    const watcherThunks = watchers.map(watcher => async () =>
      collectWatcherStatus(watcher, dockerCmd)
    );

    // Run with true concurrency cap
    const watcherResults = await runBatches(watcherThunks, CONCURRENCY);

    const results = {};

    // Process results and fix permit status format for HTML
    for (let i = 0; i < watcherResults.length; i++) {
      const watcher = watchers[i];
      const watcherData = watcherResults[i];

      console.log(` Processing result for ${watcher.name}...`);

      // Fix permit status format for HTML if needed
      if (watcherData.permitStatus === 'healthy' ||
          watcherData.permitStatus === 'partial' ||
          watcherData.permitStatus === 'degraded') {

        try {
          const infoRaw = await dockerInfoWithRetry(dockerCmd, watcher.container, 2);
          if (infoRaw) {
            const info = JSON.parse(infoRaw);
            if (info.permitCount && info.permitsPerEvent) {
              const activeRaw = info.permitCount.active || 0;
              const totalRaw  = info.permitCount.total  || 0;
              const permitsPerBlock = info.permitsPerEvent || 3000000;

              const totalBlocks = Math.floor(totalRaw / permitsPerBlock);
              let availableBlocks = Math.floor(activeRaw / permitsPerBlock);
              if (activeRaw === totalRaw) availableBlocks = totalBlocks;

              watcherData.permitStatus = calculatePermitStatus({
                activeRaw: activeRaw,
                totalRaw: totalRaw,
                permitsPerEvent: permitsPerBlock
              });
            }
          }
        } catch (err) {
          console.warn(`  Failed to get detailed permit info for ${watcher.name}: ${err.message}`);
        }
      }

      results[watcher.container] = watcherData;
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
