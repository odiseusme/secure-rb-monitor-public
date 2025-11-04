# Installation Checklist - First-Time User Perspective

## Pre-Installation Validation

### System Requirements Check
- [ ] OS: Linux (tested), macOS, Windows (WSL2)
- [ ] Disk space: 1GB+ free
- [ ] Internet connection: Active

### Required Software
- [ ] **Git** - `git --version` (≥ 2.x)
- [ ] **Docker** - `docker --version` (≥ 20.x)
- [ ] **Docker Compose** - `docker compose version` (v2 preferred)
- [ ] **Node.js** - `node --version` (≥ 14.x, v18+ recommended)
- [ ] **curl** - `curl --version`
- [ ] **jq** - `jq --version` (JSON processor)
- [ ] **openssl** - `openssl version`

### Optional (for QR codes)
- [ ] **Python 3** - `python3 --version`
- [ ] **python3-qrcode** - `python3 -c "import qrcode"` (no error = installed)

If missing: `sudo apt-get install -y python3 python3-qrcode` or `pip3 install --user qrcode`

---

## Installation Flow (Local Monitoring)

### Step 1: Clone Repository
```bash
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public
```

**Validation:**
- [ ] Repository cloned successfully
- [ ] Inside `secure-rb-monitor-public` directory
- [ ] Can see `README.md`, `docker-compose.yml`

### Step 2: Prepare Build
```bash
./scripts/prepare_build.sh
```

**Expected Output:**
- Creates `.env` file with BASE_URL
- Creates `config.json` from watchers
- Shows success message

**Common Issues:**
- ❌ **"Permission denied"** → Run: `chmod +x ./scripts/prepare_build.sh`
- ❌ **"docker-compose.yml not found"** → Wrong directory, `cd` to repo root

**Validation:**
- [ ] `.env` file exists and contains `BASE_URL=`
- [ ] `config.json` exists (may be empty if no watchers yet)
- [ ] No error messages

### Step 3: Start Docker Monitoring
```bash
docker compose up -d --build
```

**Expected Output:**
- Building Docker image
- Creating container `rosen-bridge-monitor`
- Container status: Running

**Common Issues:**
- ❌ **"Cannot connect to Docker daemon"** → Start Docker: `sudo systemctl start docker`
- ❌ **"Port 8080 already in use"** → Script auto-selects different port (check output)
- ❌ **"Build failed"** → Check Docker logs: `docker compose logs`

**Validation:**
- [ ] Container running: `docker ps | grep rosen-bridge-monitor`
- [ ] Container healthy: `docker compose ps` (status: Up)
- [ ] No error logs: `docker compose logs --tail 20`

### Step 4: Access Dashboard
```bash
# URL shown in prepare_build.sh output, default:
open http://localhost:8080
```

**Expected:**
- Dashboard loads in browser
- Shows "Secure Rosen Bridge Monitor" title
- May show "Encrypted" toggle (for cloud mode)
- Watcher table (may be empty if no watchers configured)

**Common Issues:**
- ❌ **"Site can't be reached"** → Check container: `docker ps`, check port
- ❌ **"Empty dashboard"** → Normal if no watchers. Add watchers to config.json

**Validation:**
- [ ] Dashboard loads successfully
- [ ] No browser console errors (F12)
- [ ] Page shows correct header/footer

---

## Installation Flow (Cloud Monitoring - Remote Access)

### Prerequisites
- [ ] Completed Steps 1-3 above (local monitoring working)
- [ ] Have Cloudflare Worker URL from admin
- [ ] Have invitation code from admin

### Step 1: Dry Run (Recommended)
```bash
./scripts/register-user.sh --dry-run --base-url https://your-worker.workers.dev
```

**Expected Output:**
- ✓ All dependencies installed
- ✓ Python/QR check (optional)
- ✓ Worker health check passes
- ✓ "All checks passed! System is ready."

**Common Issues:**
- ❌ **"jq: NOT FOUND"** → Install: `sudo apt-get install -y jq`
- ❌ **"python3-qrcode: NOT FOUND"** → Optional. Install if you want QR codes
- ❌ **"Worker not responding"** → Wrong URL or worker not deployed

**Validation:**
- [ ] Dry run passes all checks
- [ ] No missing dependencies (except optional Python)

### Step 2: Register User
```bash
./scripts/register-user.sh
```

**Interactive Flow:**
1. Menu: Choose [D] Dry run (already done), then [R] Register
2. Enter invitation code (from admin)
3. Choose/generate passphrase
   - Auto-generate (press Enter) OR enter custom (12+ chars, complex)
4. **SAVE PASSPHRASE NOW** (shown only once!)
5. Security notice about storing passphrase in .env
   - Choose [N] for maximum security (manual entry each time)
   - Choose [Y] for convenience (auto-login, less secure)
6. Press Enter to continue registration
7. QR code prompt (optional)
8. Start monitoring prompt
   - [L] Local only (already running)
   - [C] Cloud sync (starts uploader + local)
   - [Q] Quit (start manually later)

**Expected Output:**
- ✓ Registration successful
- ✓ Dashboard URL shown (save this!)
- ✓ QR code displayed (if chosen)
- ✓ Monitoring started (if chosen)

**Common Issues:**
- ❌ **"Invitation code required"** → Get from admin
- ❌ **"HTTP 400/409"** → Code invalid or already used
- ❌ **"Passphrase validation failed"** → Too weak, try auto-generate
- ❌ **"Double prompt for passphrase storage"** → Bug in v1.2.0, fixed in v1.2.1

**Validation:**
- [ ] `.env` contains `WRITE_TOKEN`, `DASH_SALT_B64`
- [ ] `.cloudflare-config.json` exists
- [ ] Dashboard URL saved
- [ ] Passphrase saved (somewhere secure!)

### Step 3: Verify Cloud Sync
```bash
./start-monitoring.sh status
```

**Expected Output:**
- Dashboard URL
- Uploader status: Running (PID shown)
- Docker status: Running
- Last upload: Recent timestamp

**Common Issues:**
- ❌ **"Uploader not running"** → Start: `./start-monitoring.sh start`
- ❌ **"No such file"** → Registration incomplete, re-run register-user.sh
- ❌ **"Passphrase missing"** → Not saved in .env, must enter manually

**Validation:**
- [ ] Uploader process running: `pgrep -f cloudflare-sync.js`
- [ ] Docker container running: `docker ps | grep rosen-bridge`
- [ ] Logs show uploads: `tail -20 nohup.out`

### Step 4: Access Remote Dashboard
```bash
# Open the URL from registration (sent by admin or shown after registration)
# Example: https://mute-mouse-2cd2.rbmonitor.workers.dev/d/YOUR-USER-ID
```

**In Browser:**
1. Open dashboard URL
2. Toggle "Encrypted" mode ON
3. Enter passphrase
4. Click "Decrypt"
5. Dashboard shows real-time watcher data

**Expected:**
- Encrypted mode toggle works
- Passphrase decrypts data successfully
- Watcher data visible (if watchers configured)
- Updates every ~30 seconds

**Common Issues:**
- ❌ **"Decryption failed"** → Wrong passphrase, check saved passphrase
- ❌ **"No data"** → Uploader not running or no watchers configured
- ❌ **"Stale data"** → Check uploader logs: `tail -50 nohup.out`

**Validation:**
- [ ] Dashboard decrypts successfully
- [ ] Watcher data visible (if configured)
- [ ] Data updates automatically
- [ ] Mobile access works (test on phone)

---

## Post-Installation Verification

### Complete System Check
```bash
# 1. Check Docker
docker ps | grep rosen-bridge-monitor

# 2. Check uploader (if cloud mode)
pgrep -f cloudflare-sync.js

# 3. Check recent uploads (if cloud mode)
tail -20 nohup.out | grep -E "Upload|alive"

# 4. Check local dashboard
curl -s http://localhost:8080/health | jq

# 5. Check remote dashboard (if cloud mode)
curl -s https://YOUR-WORKER.workers.dev/health
```

**All Green:**
- [ ] Docker container: Up
- [ ] Uploader: Running (cloud mode only)
- [ ] Local dashboard: Responding
- [ ] Remote dashboard: Responding (cloud mode only)
- [ ] Logs: No errors

---

## Troubleshooting Decision Tree

### Problem: Can't access local dashboard
1. Is Docker running? → `docker ps`
2. Is container running? → `docker compose ps`
3. Is port correct? → Check `docker compose ps` for port mapping
4. Check logs → `docker compose logs --tail 50`

### Problem: Can't access remote dashboard
1. Did registration succeed? → Check `.cloudflare-config.json` exists
2. Is uploader running? → `pgrep -f cloudflare-sync.js`
3. Is passphrase correct? → Check saved passphrase
4. Check uploader logs → `tail -50 nohup.out`

### Problem: Data not updating
1. Are watchers configured? → Check `config.json`
2. Is Docker collecting data? → `docker logs rosen-bridge-monitor --tail 20`
3. Is uploader sending? → `tail -50 nohup.out | grep Upload`
4. Network issues? → Check egress logs in Docker

### Problem: Registration fails
1. Run dry run → `./scripts/register-user.sh --dry-run`
2. Check invitation code → Ask admin for new code
3. Check worker health → `curl https://YOUR-WORKER.workers.dev/health`
4. Check passphrase complexity → Try auto-generate

---

## Quick Reference Commands

```bash
# Start everything (cloud mode)
docker compose up -d && ./start-monitoring.sh start

# Stop everything
docker compose down && ./start-monitoring.sh stop

# Check status
./start-monitoring.sh status

# View Docker logs
docker compose logs -f

# View uploader logs
tail -f nohup.out

# Restart Docker only
docker compose restart

# Restart uploader only
./start-monitoring.sh restart

# Clean slate (stop + clean logs)
./stop-all-services.sh  # If script exists
# OR manually:
docker compose down
pkill -f cloudflare-sync.js
rm -f .last-sync-hash .cf-sync-state.json nohup.out
```

---

## Success Criteria

### Local Monitoring Success
- ✅ Docker container running
- ✅ Dashboard accessible at localhost:8080
- ✅ Watcher data visible (if configured)
- ✅ No errors in Docker logs

### Cloud Monitoring Success
- ✅ Local monitoring working (above)
- ✅ Registration completed with dashboard URL
- ✅ Uploader running and sending data
- ✅ Remote dashboard decrypts successfully
- ✅ Mobile access works
- ✅ Data updates every ~30 seconds

---

## Common Gotchas & Tips

1. **Passphrase Storage**
   - ⚠️ If you save to .env: Convenient but less secure
   - ✅ If you don't save: Must enter each time uploader starts
   - 💡 Tip: Use password manager, don't rely on memory

2. **Python QR Codes**
   - ℹ️ Optional feature, not required
   - 💡 Install: `sudo apt-get install -y python3 python3-qrcode`
   - 📱 Makes mobile setup much easier

3. **Port Conflicts**
   - ℹ️ prepare_build.sh auto-selects free port
   - 💡 Check output for actual port used
   - 🔧 Manually override in docker-compose.yml if needed

4. **Invitation Codes**
   - ⚠️ Single-use only
   - ⚠️ Expire after time limit (set by admin)
   - 💡 Ask admin for new code if expired

5. **Uploader Process**
   - ℹ️ Runs in background via nohup
   - 💡 Survives terminal close
   - 🔧 Check: `pgrep -f cloudflare-sync.js`

6. **Clean Restart**
   - 💡 Use stop-all-services.sh for complete cleanup
   - 🔧 Removes state files but keeps .env (credentials)
   - ✅ Good for troubleshooting weird issues

---

**Document Version:** 1.0 (for secure-rb-monitor-public v1.2.1)  
**Last Updated:** 2025-11-04  
**For:** First-time users and PC-to-PC deployment testing
