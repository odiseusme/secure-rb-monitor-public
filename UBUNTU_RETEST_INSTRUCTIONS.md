# Ubuntu PC Retest Instructions - feature/ubuntu-fixes Branch

## Quick Summary
Stop everything → Pull latest changes → Rebuild Docker → Restart services → Test

---

## Step 1: Stop All Services

```bash
cd ~/secure-rb-monitor-public

# Stop monitoring
./scripts/monitor_control.sh stop

# Or if using systemd service
systemctl --user stop rbmonitor-uploader.service

# Stop Docker container
docker compose down
```

---

## Step 2: Pull Latest Changes

```bash
# Make sure you're in the project directory
cd ~/secure-rb-monitor-public

# Check current branch
git branch

# If not on feature/ubuntu-fixes, switch to it
git checkout feature/ubuntu-fixes

# Pull latest changes from GitHub (if pushed)
# OR if not pushed yet, you'll do this from Orit's PC first
git pull origin feature/ubuntu-fixes

# Check what changed
git log --oneline -10
```

---

## Step 3: Review Changes

The feature/ubuntu-fixes branch includes:

1. ✅ **Issue #2-6 Fixes:** chmod, prompts, docs, admin keys
2. ✅ **Issue #7 Fix:** monitor_control.sh auto-loads .env
3. ✅ **Issue #8 Fix:** Systemd auto-start service
4. ✅ **Issue #9 Fix (CRITICAL):** Egress validator allows private IPs (for Ergo node at 10.0.0.8)
5. ✅ **show_monitor_url_and_qr.sh:** Simplified UI, shows both local & remote dashboards

**Key files changed:**
- `lib/egress-validator.js` - Private IP support
- `scripts/monitor_control.sh` - Auto .env loading
- `scripts/install-systemd-service.sh` - NEW
- `scripts/uninstall-systemd-service.sh` - NEW
- `scripts/show_monitor_url_and_qr.sh` - Improved UI
- `scripts/prepare_build.sh` - Better prompts

---

## Step 4: Rebuild Docker (IMPORTANT!)

**Why?** The egress-validator.js fix is inside the Docker container, so you MUST rebuild:

```bash
# Make scripts executable (just in case)
chmod +x scripts/*.sh scripts/*.py

# Rebuild Docker image with new code
docker compose build --no-cache

# Verify the new image was built
docker images | grep rosen-bridge-monitor
```

---

## Step 5: Start Services

### Option A: Manual Start (For Testing)

```bash
# Start Docker container
docker compose up -d

# Start uploader manually
./scripts/monitor_control.sh start

# Check status
./scripts/monitor_control.sh status
```

### Option B: Install Auto-Start (Recommended)

```bash
# Install systemd service for auto-start
./scripts/install-systemd-service.sh

# Check service status
systemctl --user status rbmonitor-uploader.service

# View logs
journalctl --user -u rbmonitor-uploader.service -f
```

---

## Step 6: Critical Test - Ergo Node Connection

**This is THE most important test!**

The Ubuntu PC watchers were failing because egress-validator was blocking `10.0.0.8:9053`. This should now work:

```bash
# Watch the uploader logs
journalctl --user -u rbmonitor-uploader.service -f

# OR if running manually:
./scripts/monitor_control.sh logs

# Look for:
# ✅ "Fetching from http://10.0.0.8:9053/..." - SUCCESS
# ❌ "Egress blocked: http://10.0.0.8:9053/..." - FAILED (if you see this, the fix didn't work)
```

**What to check:**
1. No more "Egress validation failed" errors for 10.0.0.8
2. Watchers successfully connect to Ergo node
3. Status data uploads to Cloudflare Worker
4. Dashboard shows watcher data

---

## Step 7: View Dashboard URLs

```bash
# Show both local and remote dashboard URLs with QR codes
./scripts/show_monitor_url_and_qr.sh

# Should show:
# - Local dashboard: http://192.168.x.x:8080/
# - Remote dashboard: https://mute-mouse-2cd2.rbmonitor.workers.dev/d/YOUR-USER-ID
```

---

## Step 8: Test Auto-Start After Reboot

**If you installed systemd service:**

```bash
# Check auto-start is enabled
systemctl --user status rbmonitor-uploader.service
# Should show "enabled"

# Check loginctl
loginctl show-user $USER | grep Linger
# Should show "Linger=yes"

# Reboot the system
sudo reboot

# After reboot, SSH back in and check:
systemctl --user status rbmonitor-uploader.service
# Should show "active (running)"

docker ps
# Should show rosen-bridge-monitor container running
```

---

## Expected Results After Fix

### ✅ What Should Work Now:

1. **Watchers connect to Ergo node** at `10.0.0.8:9053` without errors
2. **No more egress validation failures** in logs
3. **Auto-start after reboot** works (if systemd service installed)
4. **Dashboard shows accurate data** from all watchers
5. **monitor_control.sh** works without manually sourcing .env

### ❌ What to Report if Broken:

1. Still getting "Egress blocked" errors for 10.0.0.8
2. Watchers show as "unknown" or "down" in dashboard
3. Services don't auto-start after reboot
4. Docker container fails to start
5. Uploader crashes or shows errors

---

## Troubleshooting

### Problem: Still Getting Egress Errors

```bash
# Check if Docker was rebuilt with new code
docker exec rosen-bridge-monitor cat lib/egress-validator.js | grep -A5 "isPrivateIP"
# Should show the isPrivateIP function

# If not present, rebuild:
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Problem: Watchers Not Connecting

```bash
# Check network connectivity
curl -v http://10.0.0.8:9053/info

# Check logs for specific error
journalctl --user -u rbmonitor-uploader.service | grep "10.0.0.8"
```

### Problem: Auto-Start Not Working

```bash
# Check linger status
loginctl show-user $USER | grep Linger

# Enable linger if not enabled
sudo loginctl enable-linger $USER

# Reinstall service
./scripts/uninstall-systemd-service.sh
./scripts/install-systemd-service.sh
```

---

## Rollback (If Needed)

If something goes wrong:

```bash
# Stop everything
./scripts/monitor_control.sh stop
docker compose down

# Switch back to main branch
git checkout main

# Rebuild Docker
docker compose build --no-cache
docker compose up -d

# Restart monitoring
./scripts/monitor_control.sh start
```

---

## Reporting Results

After testing, please report:

1. ✅ Ergo node connection status (10.0.0.8:9053)
2. ✅ Watcher health in dashboard
3. ✅ Auto-start after reboot (if tested)
4. ✅ Any errors in logs
5. ✅ Dashboard accessibility (local & remote)

**Log locations:**
- Systemd: `journalctl --user -u rbmonitor-uploader.service`
- Manual: `./scripts/monitor_control.sh logs`
- Docker: `docker logs rosen-bridge-monitor`

---

## Commands Cheat Sheet

```bash
# Status
./scripts/monitor_control.sh status
systemctl --user status rbmonitor-uploader.service

# Logs
./scripts/monitor_control.sh logs
journalctl --user -u rbmonitor-uploader.service -f

# Restart
./scripts/monitor_control.sh restart
systemctl --user restart rbmonitor-uploader.service

# Stop
./scripts/monitor_control.sh stop
systemctl --user stop rbmonitor-uploader.service

# View dashboards
./scripts/show_monitor_url_and_qr.sh
```

---

**Last Updated:** November 7, 2025  
**Branch:** feature/ubuntu-fixes  
**Critical Fix:** Private IP egress validation (10.0.0.8:9053)
