import type { Context } from "hono";

export const ServeDashboard = async (c: Context) => {
  try {
    const { publicId } = c.req.param();

    if (!publicId || publicId.length !== 32) {
      return c.html(getErrorPage("Invalid dashboard URL"), 400);
    }

    const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
    if (!userDataRaw) {
      return c.html(getErrorPage("Dashboard not found"), 404);
    }

    const html = getDashboardHtml(publicId);
    return c.html(html, 200, {
      "Content-Type": "text/html; charset=utf-8",
    });
  } catch (err) {
    console.error("Error serving dashboard:", err);
    return c.html(getErrorPage("Internal server error"), 500);
  }
};

function getDashboardHtml(publicId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<title>Rosen Bridge Monitor</title>
<style>
body { 
  font-family: Arial; 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
  color: white; 
  padding: 20px; 
  min-height: 100vh;
}
.container { max-width: 1000px; margin: 0 auto; }
.login { 
  background: white; 
  color: black; 
  padding: 30px; 
  border-radius: 15px; 
  margin: 20px 0; 
  text-align: center; 
}
.login input {
  padding: 15px;
  font-size: 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  margin: 10px;
  width: 250px;
}
.login button {
  padding: 15px 30px;
  font-size: 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.login button:hover { background: #5a67d8; }
.content { display: none; }
.watcher { 
  background: white; 
  color: black; 
  margin: 15px 0; 
  padding: 20px; 
  border-radius: 10px; 
}
.summary { 
  display: flex; 
  gap: 20px; 
  margin: 20px 0; 
  flex-wrap: wrap;
}
.card { 
  background: white; 
  color: black; 
  padding: 20px; 
  border-radius: 10px; 
  text-align: center; 
  flex: 1;
  min-width: 120px;
}
.error { color: #ff4444; margin-top: 10px; }
.health-broken { color: #ff4444; font-weight: bold; }
.health-healthy { color: #44aa44; font-weight: bold; }
</style>
</head>
<body>
<div class="container">
<h1>Rosen Bridge Monitor</h1>
<div id="login" class="login">
<h2>Enter Dashboard Passphrase</h2>
<input type="password" id="pass" placeholder="Enter your passphrase">
<br>
<button onclick="decrypt()">Access Dashboard</button>
<div id="error" class="error"></div>
</div>
<div id="content" class="content">
<div id="summary" class="summary"></div>
<div id="watchers"></div>
</div>
</div>
<script>
const PUBLIC_ID = "${publicId}";
const DEFAULT_KDF_ITERS = 100000;

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
    const iterations = j.userInfo.kdfParams.iterations || DEFAULT_KDF_ITERS;
    
    const data = await decryptData(j.data, pass, saltB64, iterations);
    
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

function showData(data) {
  const watchers = Object.values(data.watchers || {});
  const healthy = watchers.filter(w => w.healthStatus === 'Healthy').length;
  const broken = watchers.filter(w => w.healthStatus === 'Broken').length;
  const total = watchers.length;
  
  document.getElementById('summary').innerHTML = 
    '<div class="card"><h3>' + total + '</h3><p>Total Watchers</p></div>' +
    '<div class="card"><h3>' + healthy + '</h3><p>Healthy</p></div>' +
    '<div class="card"><h3>' + broken + '</h3><p>Broken</p></div>';
    
  document.getElementById('watchers').innerHTML = watchers.map(w => 
    '<div class="watcher">' +
    '<h3>' + (w.name || 'Unknown') + '</h3>' +
    '<p>Health: <span class="health-' + (w.healthStatus || '').toLowerCase() + '">' + (w.healthStatus || 'Unknown') + '</span></p>' +
    '<p>Network: ' + (w.network || 'Unknown') + '</p>' +
    '<p>ERG Balance: ' + (w.currentBalance || 0) + '</p>' +
    '<p>eRSN Balance: ' + (w.eRsnBalance || 0) + '</p>' +
    '<p>RSN Balance: ' + (w.rsnBalance || 0) + '</p>' +
    (w.ui_port ? '<p>Port: ' + w.ui_port + '</p>' : '') +
    '</div>'
  ).join('');
}

// Enter key support
document.getElementById('pass').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') decrypt();
});
</script>
</body>
</html>`;
}

function getErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<title>Dashboard Error</title>
<style>
body { 
  font-family: Arial; 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
  color: white; 
  padding: 50px; 
  text-align: center;
}
.card { 
  background: white; 
  color: black; 
  padding: 30px; 
  border-radius: 15px; 
  display: inline-block;
}
</style>
</head>
<body>
<div class="card">
<h1>Dashboard Error</h1>
<p>${message}</p>
</div>
</body>
</html>`;
}

export default ServeDashboard;
