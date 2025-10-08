export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Remote monitoring dashboard for Rosen Bridge Watchers - access health summaries from any PC or mobile device.">
  <title>Rosen Bridge Watchers Monitor</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="icon" href="/favicon.ico?v=6" type="image/x-icon">
  <link rel="shortcut icon" href="/favicon.ico?v=6" type="image/x-icon">
  <link rel="apple-touch-icon" href="/icons/owlHeadA_180.png?v=6">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#12181B">
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 id="pageTitle">Rosen Bridge Watchers Monitor</h1>
    </div>

<div id="login" class="login">
      <div class="login-container">
        <div class="login-header">
          <div class="lock-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
            </svg>
          </div>
          <h1 class="login-subtitle" style="font-size: 1.1rem;">Enter your passphrase to access the<br>Rosen Bridge Watchers Monitor</h1>
        </div>
        <form>
          <div class="form-group">
            <label class="form-label" for="pass">Passphrase</label>
            <div class="password-input-container">
              <input 
                type="password" 
                id="pass" 
                class="form-input"
                placeholder="Enter your secure passphrase"
                autocomplete="current-password"
              >
              <button type="button" id="togglePassword" class="password-toggle" title="Show password">
                <svg id="eyeIcon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" id="rememberPassword" class="checkbox-input">
              <span class="checkbox-custom"></span>
              Save password, allow auto-refresh
            </label>
          </div>
          
          <button type="submit" class="submit-button" id="submitBtn">
            Access Dashboard
            <div class="spinner"></div>
          </button>
          
          <div class="error-message" id="error">
          </div>
        </form>
        
        <div class="security-note">
          <div class="security-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            End-to-end encrypted monitoring
          </div>
        </div>
      </div>
    </div>
    <div id="content" style="display:none;">
      <div class="monitor-status-line">
        <span class="status-dot" id="statusDot"></span>
        <span id="monitorStatus">MONITOR ALIVE SINCE:</span>
        <span id="timerA">00:00:00</span>
        <span class="separator">|</span>
        <span>LAST DATA UPDATE:</span>
        <span id="timerB">00:00:00</span>
        <span>AGO</span>
      </div>
      <div id="summary" class="summary"></div>
      <div id="watchers" class="watchers-grid"></div>
      <div class="last-update" id="lastUpdate"></div>
      <div class="staleness" id="staleness"></div>
    </div>
  </div>

  <script>
    // Injected by server
    const PUBLIC_ID = "{{PUBLIC_ID}}"; // replaced by server-side code
    const DEFAULT_KDF_ITERS = 100000;

    // Save password helper -- define globally!
    function handleRememberPassword(pass) {
      const rememberCheckbox = document.getElementById('rememberPassword');
      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('rememberPassword', 'true');
        localStorage.setItem('savedPassphrase', pass);
      } else {
        localStorage.removeItem('rememberPassword');
        localStorage.removeItem('savedPassphrase');
      }
    }

    // Step 1: Login, decryption
    async function decrypt(passphraseOverride) {
      const passInput = document.getElementById('pass');
      const pass = passphraseOverride !== undefined ? passphraseOverride : passInput.value;
      if (!pass) {
        document.getElementById('error').textContent = 'Please enter your passphrase';
        return;
      }
      try {
        document.getElementById('error').textContent = '';
        const res = await fetch('/api/blob/' + PUBLIC_ID);
        if (!res.ok) throw new Error('Failed to fetch data');
        const j = await res.json();
        const saltB64 = j.userInfo.salt;
        const iterations = j.userInfo.kdfParams?.iterations || DEFAULT_KDF_ITERS;
        const data = await decryptData(j.data, pass, saltB64, iterations);

        // Extract timer fields from outer payload before showing data
        window.monitorStartTime = j.data.monitorStartTime ? new Date(j.data.monitorStartTime).getTime() : null;
        window.lastDataChangeTime = j.data.lastDataChangeTime ? new Date(j.data.lastDataChangeTime).getTime() : null;
        window.lastUploadReceivedTime = Date.now();

        // --- PATCH: Properly initialize status fields on first load ---
        window.lastUploadType = j.data.uploadType || null;
        window.lastSeq = typeof j.data.sequenceNumber === 'number' ? j.data.sequenceNumber : null;
        window.lastUpdatedAt = j.data.updatedAt || null;
        // -------------------------------------------------------------

        // Save decryption params in memory for auto-refresh
        window.currentPassphrase = pass;
        window.currentSalt = saltB64;
        window.currentIterations = iterations;

        // Optionally save in localStorage
        handleRememberPassword(pass);

        // Hide login, show content
        document.getElementById('login').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        showData(data);

        // Start auto-refresh if password is saved
        setupAutoRefresh();
      } catch(e) {
        document.getElementById('error').textContent = 'Invalid passphrase or decryption failed';
        console.error('Decrypt error:', e);
      }
    }

    async function decryptData(encData, pass, saltB64, iters) {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      // Convert base64 to bytes
      const saltBytes = new Uint8Array(Array.from(atob(saltB64), c => c.charCodeAt(0)));
      const passBytes = enc.encode(pass);
      // Derive key using PBKDF2
      const keyMaterial = await crypto.subtle.importKey('raw', passBytes, {name:'PBKDF2'}, false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        {name:'PBKDF2', salt:saltBytes, iterations:iters, hash:'SHA-256'},
        keyMaterial,
        {name:'AES-GCM', length:256},
        false,
        ['decrypt']
      );
      // Decrypt
      const iv = new Uint8Array(Array.from(atob(encData.nonce), c => c.charCodeAt(0)));
      const ciphertext = new Uint8Array(Array.from(atob(encData.ciphertext), c => c.charCodeAt(0)));
      const plaintext = await crypto.subtle.decrypt({name:'AES-GCM', iv:iv}, key, ciphertext);
      return JSON.parse(dec.decode(plaintext));
    }

function showData(data) {
  const watchersArray = Object.values(data.watchers || {}).map(normalizeWatcher);
  const health = computeHealthSummary(watchersArray);
  const permit = computePermitSummary(watchersArray);
  const summary = {
    total: watchersArray.length,
    healthy: health.healthy,
    unstable: health.unstable,
    broken: health.broken,
    sufficient: permit.sufficient,
    critical: permit.critical,
    exhausted: permit.exhausted
  };

  document.getElementById('summary').innerHTML = renderSummary(summary);
  document.getElementById('watchers').innerHTML = watchersArray.map(renderWatcher).join('');
}

    // --- Summary helpers and normalizers ---
    function getNetworkClass(network) {
      const n = String(network || 'unknown').toLowerCase();
      return 'network-' + n;
    }
    function getProgressClass(status) {
      if (status === 'exhausted') return 'progress-critical';
      if (status === 'critical')  return 'progress-warning';
      return 'progress-healthy';
    }
    function normalizedPermits(watcher) {
      const active = watcher && watcher.permitCount && typeof watcher.permitCount.active === 'number'
        ? watcher.permitCount.active : null;
      const perEvent = watcher && typeof watcher.permitsPerEvent === 'number'
        ? watcher.permitsPerEvent : null;
      if (active == null || perEvent == null || perEvent <= 0) return null;
      return Math.floor(active / perEvent);
    }
    function computeHealthSummary(watchers) {
      const result = { healthy: 0, unstable: 0, broken: 0 };
      for (let i = 0; i < watchers.length; i++) {
        const hs = String(watchers[i].healthStatus || '').toLowerCase();
        if (hs === 'healthy') result.healthy++;
        else if (hs === 'unstable') result.unstable++;
        else result.broken++;
      }
      return result;
    }
    function computePermitSummary(watchers) {
      const result = { sufficient: 0, critical: 0, exhausted: 0 };
      for (let i = 0; i < watchers.length; i++) {
        const w = watchers[i];
        if (w && w.permitStatus && typeof w.permitStatus.status === 'string') {
          const ps = w.permitStatus.status.toLowerCase();
          if (ps === 'sufficient') result.sufficient++;
          else if (ps === 'critical') result.critical++;
          else result.exhausted++;
          continue;
        }
        const n = normalizedPermits(w);
        if (n == null) result.exhausted++;
        else if (n >= 2) result.sufficient++;
        else if (n === 1) result.critical++;
        else result.exhausted++;
      }
      return result;
    }
    function buildPermitStatus(w) {
      const perEvent = (w && typeof w.permitsPerEvent === 'number' && w.permitsPerEvent > 0) ? w.permitsPerEvent : null;
      const active = (w && w.permitCount && typeof w.permitCount.active === 'number') ? w.permitCount.active : null;
      const total  = (w && w.permitCount && typeof w.permitCount.total  === 'number') ? w.permitCount.total  : null;
      if (!perEvent || active == null || total == null) {
        return { status: 'unknown', message: 'No data', available: 0, total: 0, utilization: 0 };
      }
      const totalBlocks = Math.floor(total / perEvent);
      let availableBlocks = (active === total) ? totalBlocks : Math.floor(active / perEvent);
      if (!Number.isFinite(availableBlocks) || availableBlocks < 0) availableBlocks = 0;
      let status = 'exhausted';
      if (availableBlocks >= 2) status = 'sufficient';
      else if (availableBlocks === 1) status = 'critical';
      const utilization = (totalBlocks > 0) ? (1 - (availableBlocks / totalBlocks)) : 0;
      const message = (totalBlocks > 0) ? (availableBlocks + '/' + totalBlocks + ' blocks') : 'No data';
      return {
        status,
        message,
        available: availableBlocks,
        total: totalBlocks,
        utilization
      };
    }
    function normalizeWatcher(w) {
      const out = Object.assign({}, w);
      if (out.port == null && out.hostPort != null) out.port = out.hostPort;
      if (!out.permitStatus) out.permitStatus = buildPermitStatus(out);
      return out;
    }
    function renderSummary(summary) {
      return (
        '<div class="summary-column">' +
          '<div class="summary-column-label">WATCHERS</div>' +
          '<div class="summary-card healthy">' +
            '<h3>' +
              '<span class="count-num">' + summary.healthy + '</span>' +
              '<span class="count-div"> / </span>' +
              '<span class="count-den">' + summary.total + '</span>' +
            '</h3>' +
            '<p>Healthy</p>' +
          '</div>' +
          '<div class="summary-card unstable">' +
            '<h3>' +
              '<span class="count-num">' + summary.unstable + '</span>' +
              '<span class="count-div"> / </span>' +
              '<span class="count-den">' + summary.total + '</span>' +
            '</h3>' +
            '<p>Unstable</p>' +
          '</div>' +
          '<div class="summary-card broken">' +
            '<h3>' +
              '<span class="count-num">' + summary.broken + '</span>' +
              '<span class="count-div"> / </span>' +
              '<span class="count-den">' + summary.total + '</span>' +
            '</h3>' +
            '<p>Broken or Offline</p>' +
          '</div>' +
        '</div>' +
        '<div class="summary-column">' +
          '<div class="summary-column-label">PERMIT STATUS</div>' +
          '<div class="summary-card sufficient"><h3>' + summary.sufficient + '</h3><p>Sufficient</p></div>' +
          '<div class="summary-card critical"><h3>' + summary.critical + '</h3><p>Critical</p></div>' +
          '<div class="summary-card exhausted"><h3>' + summary.exhausted + '</h3><p>Exhausted</p></div>' +
        '</div>'
      );
    }
    function renderWatcher(watcher) {
      const permitStatus = watcher.permitStatus || {
        status: 'unknown',
        message: 'No data'
      };
      const formatBalance = (b) => (typeof b === 'number' ? b.toFixed(2) : '0');
      const formatERG = (b) => (typeof b === 'number' ? b.toFixed(2) : '0');
      const cleanName = watcher.container ? watcher.container.replace(/-service-1$/, '') : (watcher.name || '');
      const avail = Number.isFinite(permitStatus.available) ? permitStatus.available : 0;
      const total = Number.isFinite(permitStatus.total) ? permitStatus.total : 0;
      let percent = 0;
      if (total > 0) {
        percent = Math.round((avail / total) * 100);
      } else if (typeof permitStatus.utilization === 'number') {
        const u = Math.max(0, Math.min(1, permitStatus.utilization));
        percent = Math.round((1 - u) * 100);
      }
      percent = Math.max(0, Math.min(100, percent));
      const permitsHTML =
        '<div class="status-row-2col">' +
          '<div class="status-col"><strong>Permits:</strong> ' + avail + '/' + total + '</div>' +
          '<div class="status-col right"><strong>Status:</strong> ' +
            '<span class="permit-' + permitStatus.status.replace(/\\s+/g, '-').toLowerCase() + '">' + (permitStatus.message || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="progress-bar">' +
          '<div class="progress-fill ' + getProgressClass(permitStatus.status) + '" style="width:' + percent + '%"></div>' +
        '</div>';
      return (
        '<div class="watcher-card">' +
          '<div class="watcher-header">' +
            '<div class="watcher-name">' + cleanName + '</div>' +
            '<div class="network-badge ' + getNetworkClass(watcher.network) + '">' + watcher.network + '</div>' +
          '</div>' +
          '<div class="status-row-2col">' +
            '<div class="status-col"><strong>Health:</strong> ' +
              '<span class="' +
                (watcher.healthStatus === 'Healthy'
                  ? 'health-green'
                  : watcher.healthStatus === 'Unstable'
                  ? 'health-orange'
                  : watcher.healthStatus === 'Broken'
                  ? 'health-red'
                  : watcher.healthStatus === 'Offline'
                  ? 'health-down'
                  : ''
                ) + '">' + (watcher.healthStatus || 'Unknown') + '</span>' +
            '</div>' +
            '<div class="status-col right"><strong>Port:</strong> ' + (watcher.ui_port ?? '') + '</div>' +
          '</div>' +
          permitsHTML +
          '<hr class="balances-separator">' +
          '<div class="balances-row">' +
            '<div><span class="status-label">ERG:</span>  <span class="status-value">' + formatERG(watcher.currentBalance) + '</span></div>' +
            '<div><span class="status-label">eRSN:</span> <span class="status-value">' + formatBalance(watcher.eRsnBalance) + '</span></div>' +
            '<div><span class="status-label">RSN:</span>  <span class="status-value">' + formatBalance(watcher.rsnBalance) + '</span></div>' +
          '</div>' +
          (watcher.error
            ? '<div class="permit-status permit-critical"><strong>Error:</strong> ' + watcher.error + '</div>'
            : ''
          ) +
        '</div>'
      );
    }

function formatDurationHMS(milliseconds) {
  if (!milliseconds || milliseconds < 0) return '00:00:00';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  
  return hh + 'H ' + mm + 'M ' + ss + 'S ';
}

// Enhanced login functionality

// Enhanced login functionality
document.addEventListener('DOMContentLoaded', function() {
  const passInput = document.getElementById('pass');
  const toggleBtn = document.getElementById('togglePassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const rememberCheckbox = document.getElementById('rememberPassword');
  const submitBtn = document.getElementById('submitBtn');
  const form = document.querySelector('#login form');

  // Load saved password if remember is enabled
  if (localStorage.getItem('rememberPassword') === 'true') {
    const savedPass = localStorage.getItem('savedPassphrase');
    if (savedPass) {
      passInput.value = savedPass;
      rememberCheckbox.checked = true;
    }
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', function() {
    const isPassword = passInput.type === 'password';
    passInput.type = isPassword ? 'text' : 'password';
    // Update eye icon
    eyeIcon.innerHTML = isPassword 
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"><line x1="1" y1="1" x2="23" y2="23"></line></path>'
      : '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
    toggleBtn.title = isPassword ? 'Hide password' : 'Show password';
    passInput.focus();
  });

  // Enter key support
  passInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      decrypt();
    }
  });

  // Form submit
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    decrypt();
  });

  // Auto-login if remembered
  if (localStorage.getItem('rememberPassword') === 'true' && localStorage.getItem('savedPassphrase')) {
    // Only auto-login if the dashboard is not already visible
    if (document.getElementById('content').style.display === 'none') {
      decrypt(localStorage.getItem('savedPassphrase'));
    }
  }
});

// Setup auto-refresh using passphrase in memory
function setupAutoRefresh() {
  // Only run one interval
  if (window.dashboardRefreshInterval) return;

  window.dashboardRefreshInterval = setInterval(function() {
    // If passphrase is in memory, and dashboard is visible
    if (window.currentPassphrase && document.getElementById('content').style.display !== 'none') {
      fetch('/api/blob/' + PUBLIC_ID)
        .then(res => res.json())
        .then(j => {
      window.lastUploadReceivedTime = window.lastUploadReceivedTime || Date.now();

  console.log("[DEBUG] AutoRefresh: Fetched blob meta:", {
    seq: (j.data && typeof j.data.sequenceNumber === 'number') ? j.data.sequenceNumber : null,
    updatedAt: (j.data && j.data.updatedAt) ? j.data.updatedAt : null,
    uploadType: (j.data && j.data.uploadType) ? j.data.uploadType : null,
    monitorStartTime: j.data?.monitorStartTime,
    now: new Date().toISOString()
  }, 15000);
  
      // Update timers from blob meta
      const seq = (j.data && typeof j.data.sequenceNumber === 'number') ? j.data.sequenceNumber : null;
      const updAt = (j.data && j.data.updatedAt) ? j.data.updatedAt : null;
      const upType = (j.data && j.data.uploadType) ? j.data.uploadType : null;

// Only initialize monitorStartTime from the blob if we don't already
// have a local baseline. After recovery we control resets locally and
// must NOT overwrite them on each auto-refresh.
if (typeof window.monitorStartTime !== 'number' || !window.monitorStartTime) {
  window.monitorStartTime = j.data?.monitorStartTime
    ? new Date(j.data.monitorStartTime).getTime()
    : null;
}



      // Only update "Last data update" when the upload was a real data change
if (j.data?.uploadType === 'data' && j.data?.lastDataChangeTime) {
  window.lastDataChangeTime = new Date(j.data.lastDataChangeTime).getTime();
}

// Detect a *new* upload (data or alive) by seq/updatedAt change
const hadPrev =
  (typeof window['lastSeq'] !== 'undefined') ||
  (typeof window['lastUpdatedAt'] !== 'undefined');

const prevLastType = window['lastUploadType']; // capture BEFORE we update it

const changed =
  hadPrev &&
  (seq !== window['lastSeq'] || updAt !== window['lastUpdatedAt']);

if (!hadPrev) {
  // First load after reload: initialize state from the blob
  window['lastSeq'] = seq;
  window['lastUpdatedAt'] = updAt;
  window['lastUploadType'] = upType;

  // Sync uptime baseline on any real upload using server-provided monitorStartTime
  const msFromServer = (j && j.data && j.data.monitorStartTime) ? Date.parse(j.data.monitorStartTime) : null;
  if ((upType === "alive" || upType === "data") && msFromServer) {
    window.monitorStartTime = msFromServer;
  }


  // IMPORTANT: seed comms timer from the blob’s timestamp, not Date.now().
  // If the backend is already stale, the dot will show it immediately.
  // If the worker included updatedAt as an ISO string, use it; otherwise 0.
  window.lastUploadReceivedTime = updAt ? Date.parse(updAt) : 0;

} else if (changed) {
  console.log("[DEBUG] AutoRefresh: Detected new uploadType:", upType, "prev:", prevLastType, "at", new Date().toISOString());
  // Subsequent loads: only bump when truly new
  window['lastSeq'] = seq;
  window['lastUpdatedAt'] = updAt;
  window['lastUploadType'] = upType;

  // Sync uptime baseline on any real upload using server-provided monitorStartTime
  const msFromServer = (j && j.data && j.data.monitorStartTime) ? Date.parse(j.data.monitorStartTime) : null;
  if ((upType === "alive" || upType === "data") && msFromServer) { window.monitorStartTime = msFromServer; }


  // Only bump the comms timer on real uploads (not stale-status pings)
  if (upType !== 'stale-status') {
    window.lastUploadReceivedTime = j.data.updatedAt ? Date.parse(j.data.updatedAt) : 0;
  }

  // Fallback only if server did not send a baseline
  if (prevLastType === 'stale-status' && (upType === 'alive' || upType === 'data') && !(j && j.data && j.data.monitorStartTime)) {
    window.monitorStartTime = Date.now();
  }
}

      return decryptData(
        j.data,
        window.currentPassphrase,
        window.currentSalt,
        window.currentIterations
      )
      .then(data => {
        if (data && data.lastUpdate) {
          // Save the writer's lastUpdate (as ms) so we can decide red after ~1 minute if writer stalls
          window.lastWriterUpdateTime = new Date(data.lastUpdate).getTime();
        }
        return showData(data);
      })
      .catch(err => {
        console.error('Auto-refresh decrypt error:', err);
        // Optionally, show a warning or revert to login if continuous failures
      }, 15000);
    }); // <-- closes: .then(j => { ... })
  }
}, 30000); // 30 seconds
}

// Update monitor status display every second
function updateMonitorStatus() {
  const content = document.getElementById('content');
  if (!content || content.style.display === 'none') {
    return;
  }


  const now = Date.now();

  
  // Calculate elapsed times
  const uptimeMs = now - window.monitorStartTime;
  const dataAgeMs = window.lastDataChangeTime ? (now - window.lastDataChangeTime) : 0;
  const commHealthMs = window.lastUploadReceivedTime ? (now - window.lastUploadReceivedTime) : 999999999;
  
  // Update TimerA (Monitor Uptime)
  const timerAEl = document.getElementById('timerA');
  if (timerAEl) {
    timerAEl.textContent = formatDurationHMS(uptimeMs);
  }
  
  // Update TimerB (Last Data Update)
  const timerBEl = document.getElementById('timerB');
  if (timerBEl) {
    timerBEl.textContent = formatDurationHMS(dataAgeMs);
  }
  
  // Update dot color and monitor status
  const statusDotEl = document.getElementById('statusDot');
  const monitorStatusEl = document.getElementById('monitorStatus');
  
  let dotColor, statusText;

  // If the last upload from the sync explicitly reported staleness, show RED immediately.
  if (window['lastUploadType'] === 'stale-status') {
    dotColor = 'red';
    statusText = 'MONITOR OFFLINE SINCE:';
  } else if (commHealthMs < 330000) {  // 0-329 seconds (< 5.5 minutes)
    dotColor = 'green';
    statusText = 'MONITOR ALIVE SINCE:';
  } else if (commHealthMs < 360000) {  // 330-359 seconds (5.5-6 minutes)
    dotColor = 'orange';
    statusText = 'MONITOR UNSTABLE';
  } else {  // 360+ seconds (6 minutes)
    dotColor = 'red';
    statusText = 'MONITOR OFFLINE SINCE:';
  }



  if (statusDotEl) {
    statusDotEl.className = 'status-dot ' + dotColor;
  }
  if (monitorStatusEl) {
    monitorStatusEl.textContent = statusText;
  }
  console.log("[DEBUG] updateMonitorStatus:", {
    dotColor,
    statusText,
    monitorStartTime: window.monitorStartTime,
    lastUploadType: window.lastUploadType,
    commHealthMs: window.lastUploadReceivedTime ? (Date.now() - window.lastUploadReceivedTime) : 999999999,
    now: new Date().toISOString()
  });
}

// Start timer update interval
setInterval(updateMonitorStatus, 1000);
  </script>
</body>
</html>
`;
