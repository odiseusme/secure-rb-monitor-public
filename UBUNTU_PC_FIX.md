# Ubuntu PC - Fix Divergent Branches

Your Ubuntu PC has local changes that conflict with v1.2.1. Since you don't care about the old repo state, here's the clean fix:

## Run this on Ubuntu PC:

```bash
cd ~/secure-rb-monitor-public

# 1. Your backups are already safe (good!)
#    ~/monitor-config-backup-20251104.json
#    ~/monitor-env-backup-20251104.txt

# 2. Force reset to v1.2.1 (discard local changes)
git fetch origin
git reset --hard origin/main

# 3. Clean any leftover files
git clean -fd

# 4. Verify you're on v1.2.1
git log --oneline -5

# 5. Now register
./scripts/register-user.sh

# 6. Restore watchers if needed
# cat ~/monitor-config-backup-20251104.json
# Copy watcher URLs to config.json if you had any

# 7. Build and start
docker compose up -d --build

# 8. Check logs
docker compose logs -f
```

## What this does:

- `git reset --hard origin/main` - Throws away local changes, matches GitHub exactly
- `git clean -fd` - Removes any untracked files
- You're now on clean v1.2.1

## Your data is safe:

- ✅ config.json backed up to ~/monitor-config-backup-20251104.json
- ✅ .env backed up to ~/monitor-env-backup-20251104.txt

