# Upgrade Guide: Old Monitor → v1.2.1 (Cloudflare)

**Scenario:** You have an old monitor running (pre-Cloudflare) and want to upgrade to v1.2.1

---

## ⚠️ Important: This is a Breaking Change

The old version (local-only monitoring) is **incompatible** with v1.2.1 (Cloudflare-based).

**Why?**
- Old version: Local dashboard only, no encryption, no registration
- v1.2.1: Cloudflare Worker required, encrypted dashboard, registration flow

**You cannot simply `git pull`** - you need to migrate.

---

## Option 1: Clean Migration (Recommended)

### Step 1: Backup Current Setup
```bash
cd /path/to/old/secure-rb-monitor-public

# Backup config
cp config.json config.json.backup
cp .env .env.backup 2>/dev/null || true

# Note current watchers
cat config.json  # Save this info!
```

### Step 2: Stop Old Monitor
```bash
# Stop old container
docker compose down

# Optional: Remove old image to force rebuild
docker rmi $(docker images | grep rosen-bridge-monitor | awk '{print $3}')
```

### Step 3: Pull v1.2.1
```bash
git fetch origin
git checkout main

# If you get "divergent branches" error:
git reset --hard origin/main
git clean -fd

# Or if no conflicts:
git pull origin main

# IMPORTANT: Restore executable permissions
chmod +x scripts/*.sh scripts/*.py
```

**Note:** `git reset --hard` removes executable permissions, so you MUST run `chmod +x` after.

### Step 4: Review What Changed
```bash
# Check new files
git log --oneline -10

# New files you'll see:
# - scripts/register-user.sh (NEW registration flow)
# - scripts/generate-compact-qr.py (QR codes)
# - lib/egress-validator.js (security)
# - INSTALLATION_CHECKLIST.md (setup guide)
```

### Step 5: Fresh Registration
```bash
# You MUST register with Cloudflare Worker now
./scripts/register-user.sh

# This will:
# 1. Ask for invite code (get from Worker admin)
# 2. Create .cloudflare-config.json
# 3. Set up encrypted dashboard
# 4. Optionally save passphrase to .env
# 5. Show dashboard URL + QR code
```

### Step 6: Restore Watchers (if any)
```bash
# If old config.json had watchers, restore them:
# (v1.2.1 uses same config.json format for watchers)

# Copy watcher URLs from config.json.backup
nano config.json

# Or use prepare_build.sh to auto-detect from Docker
./scripts/prepare_build.sh
```

### Step 7: Start New Monitor
```bash
# Build and start
docker compose up -d --build

# Verify
docker ps | grep rosen-bridge-monitor
docker compose logs --tail 50
```

---

## Option 2: Side-by-Side (Keep Old, Test New)

If you want to keep the old monitor running while testing v1.2.1:

### Step 1: Clone to New Directory
```bash
cd /path/to/projects
git clone https://github.com/odiseusme/secure-rb-monitor-public.git secure-rb-monitor-v1.2.1
cd secure-rb-monitor-v1.2.1
```

### Step 2: Different Port
```bash
# Edit docker-compose.yml to use different port
nano docker-compose.yml

# Change:
# ports:
#   - "8080:8080"
# To:
#   - "8081:8080"  # Use 8081 on host
```

### Step 3: Register and Run
```bash
./scripts/register-user.sh
docker compose up -d --build
```

### Step 4: Compare
- Old: http://localhost:8080 (local only)
- New: https://your-worker.workers.dev (encrypted, remote access)

### Step 5: Migrate When Ready
Once satisfied, stop old monitor and remove old directory.

---

## Option 3: Fresh Install (Safest)

If you don't need to preserve old setup:

### Step 1: Complete Cleanup
```bash
cd /path/to/old/secure-rb-monitor-public

# Stop everything
docker compose down
docker rmi $(docker images | grep rosen-bridge-monitor | awk '{print $3}')

# Remove old config (start fresh)
rm -f .env .cloudflare-config.json config.json
```

### Step 2: Pull Latest
```bash
git pull origin main
```

### Step 3: Follow Installation Checklist
```bash
# Use the new installation guide
cat INSTALLATION_CHECKLIST.md

# Run registration
./scripts/register-user.sh
```

---

## Key Differences: Old vs v1.2.1

| Feature | Old Version | v1.2.1 |
|---------|-------------|--------|
| Dashboard | Local only (http://localhost:8080) | Cloudflare Worker (https://...) |
| Encryption | None | AES-256-GCM |
| Registration | Not needed | Required (invite code) |
| Remote access | No | Yes (via Worker URL) |
| Mobile access | LAN only | Anywhere (QR code) |
| Passphrase | N/A | Optional (for dashboard decryption) |
| Setup | docker compose up | register-user.sh + docker compose |

---

## What You'll Need for v1.2.1

1. **Cloudflare Worker URL** - Get from admin or deploy your own
2. **Invite Code** - Get from Worker admin or generate via setup-cloudflare.js
3. **Passphrase** - Choose strong passphrase for dashboard encryption

---

## Recommended Approach for Your Ubuntu PC

Since you have an old monitor running:

```bash
# 1. Go to old monitor directory
cd /path/to/secure-rb-monitor-public

# 2. Backup current config
cp config.json ~/monitor-config-backup.json
cat config.json  # Note watcher URLs

# 3. Stop old monitor
docker compose down

# 4. Pull latest (this is safe now that container is stopped)
git pull origin main

# 5. Check what changed
git log --oneline HEAD~10..HEAD

# 6. Run registration
./scripts/register-user.sh

# 7. Restore watchers if needed
# (copy from ~/monitor-config-backup.json to config.json)

# 8. Build and start new version
docker compose up -d --build

# 9. Check dashboard
# (URL shown by register-user.sh)
```

---

## Troubleshooting

### "Module './lib/safe-fetch' not found"
✅ Fixed in v1.2.1 - just rebuild:
```bash
docker compose down
docker compose up -d --build
```

### "Egress security blocked internal services"
✅ Fixed in v1.2.1 - watchers can now connect to internal Docker services

### "Double passphrase prompt"
✅ Fixed in v1.2.1 - only prompts once

### "QR code too big"
✅ Fixed in v1.2.1 - compact QR now fits terminal

---

## Need Help?

See `INSTALLATION_CHECKLIST.md` for step-by-step guide.

