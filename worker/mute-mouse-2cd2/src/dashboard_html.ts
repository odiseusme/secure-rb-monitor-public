export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Remote monitoring dashboard for Rosen Bridge Watchers - access health summaries from any PC or mobile device.">
  <title>Rosen Bridge Monitor</title>
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
      <h1 id="pageTitle">Rosen Bridge Monitor</h1>
      <div id="lastUpdatedTop" class="last-updated-top">Last updated: --</div>
    </div>

    <div id="login" class="login">
      <h2>Enter Dashboard Passphrase</h2>
      <input type="password" id="pass" placeholder="Enter your passphrase">
      <br>
      <button onclick="decrypt()">Access Dashboard</button>
      <div id="error" class="error"></div>
    </div>

    <div id="content" style="display:none;">
      <div id="summary" class="summary"></div>
      <div id="watchers"></div>
      <div class="last-update" id="lastUpdate"></div>
      <div class="staleness" id="staleness"></div>
    </div>
  </div>

  <script>
    // Injected by server
    const PUBLIC_ID = "{{PUBLIC_ID}}"; // replaced by server-side code
    const DEFAULT_KDF_ITERS = 100000;

    // Step 1: Login, decryption
    async function decrypt() {
      const pass = document.getElementById('pass').value;
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
        // Hide login, show content
        document.getElementById('login').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        showData(data);
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

    // Step 2: Render dashboard after decryption
    function showData(data) {
      // Use the new summary/dashboard layout
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
      if (data.lastUpdate) {
        const t = new Date(data.lastUpdate);
        const el = document.getElementById('lastUpdatedTop');
        el.textContent = 'Last updated: ' + t.toLocaleTimeString();
        const ageSeconds = (Date.now() - t.getTime()) / 1000;
        if (ageSeconds > 30) el.classList.add('stale'); else el.classList.remove('stale');
      }
    }

    // --- Summary helpers and normalizers (from your new dashboard_html.ts) ---
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
              '<span class="count-div">/</span>' +
              '<span class="count-den">' + summary.total + '</span>' +
            '</h3>' +
            '<p>Healthy</p>' +
          '</div>' +
          '<div class="summary-card unstable">' +
            '<h3>' +
              '<span class="count-num">' + summary.unstable + '</span>' +
              '<span class="count-div">/</span>' +
              '<span class="count-den">' + summary.total + '</span>' +
            '</h3>' +
            '<p>Unstable</p>' +
          '</div>' +
          '<div class="summary-card broken">' +
            '<h3>' +
              '<span class="count-num">' + summary.broken + '</span>' +
              '<span class="count-div">/</span>' +
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
          '<div class="status-col right"><strong>Status:</strong>' +
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
            '<div class="status-col"><strong>Health:</strong>' +
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

    // Enter key support for login
    document.getElementById('pass').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') decrypt();
    });
  </script>
</body>
</html>
`;
