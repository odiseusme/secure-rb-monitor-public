# Ubuntu PC Test - Issues Found

**Date:** November 4, 2025  
**Test:** Live installation on Ubuntu PC (upgrading from old version)

---

## Issues Found

### 1. Git Divergent Branches Error
**When:** Running `git pull` on Ubuntu PC with old monitor version  
**Error:** `fatal: You have divergent branches and need to specify how to reconcile them`  
**Solution:**
```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```
**Side Effect:** Lost executable permissions on scripts (see issue #2)

### 7. monitor_control.sh Doesn't Auto-Load .env After Reboot
**When:** Running `./scripts/monitor_control.sh start` after system reboot  
**Error:** `[ERROR] Worker not responding at http://localhost:38472`  
**Root Cause:** Script had hardcoded `BASE_URL="${BASE_URL:-http://localhost:38472}"` default but didn't source .env file automatically. After reboot, fresh shell has no BASE_URL exported, so defaults to localhost even when production URL is in .env  
**Solution:** Added auto-load of .env at script start:
```bash
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi
```
**Status:** ✅ FIXED in commit 64cb4e1  
**Impact:** Users can now restart services seamlessly after reboot without manual environment variable exports

### 8. Uploader Doesn't Auto-Start After Reboot
**Problem:** After system reboot, Docker container auto-restarts but uploader (Node.js host process) does not  
**Impact:** User must manually run `./scripts/monitor_control.sh start` after every reboot  
**Solution:** Created optional systemd service for auto-start:
- `scripts/install-systemd-service.sh` - Install auto-start service
- `scripts/uninstall-systemd-service.sh` - Remove service
- Service manages uploader lifecycle (start on boot, restart on failure)
- Logs available via `journalctl --user -u rbmonitor-uploader.service`
**Status:** ✅ IMPLEMENTED in feature/ubuntu-fixes branch  
**Usage:** Optional - users who want auto-start can run install script, others use manual start
**Note:** Docker container already has restart policy, systemd service only needed for uploader

### 2. Missing Executable Permissions After Reset
**Problem:** `./scripts/register-user.sh` failed - "Permission denied"  
**Cause:** `git reset --hard` restored file permissions from commit (not executable)  
**Solution:** `chmod +x scripts/*.sh scripts/*.py`  
**Fix for README:** Add note to upgrade guide about permissions after reset

### 3. prepare_build.sh Asks About Cloudflare Sync
**Problem:** At end of `prepare_build.sh`, prompts "Would you like to set up encrypted Cloudflare sync? [y/N]"  
**Confusion:** User doesn't know if they should say Yes or No  
**Expected:** Should say **No** because proper registration happens next with `register-user.sh`  
**Fix for README:** 
- Clarify in INSTALLATION_CHECKLIST that `prepare_build.sh` is for local setup only
- Or make `prepare_build.sh` skip Cloudflare prompt if `--no-cloudflare` flag used
- Or update docs to explain: "Say N if you plan to run register-user.sh next"

### 4. Invite Code Generation - Which Worker?
**Question:** To produce an invite code, which Worker needs to run?  
**Answer:** Main deployed Worker (mute-mouse-2cd2.rbmonitor.workers.dev)  
**Command:**
```bash
curl -X POST https://mute-mouse-2cd2.rbmonitor.workers.dev/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 30}'
```
**Fix for README:** Add clear section: "How to Generate Invite Codes"

### 5. Cloudflare KV Daily Limit Exceeded
**Problem:** `{"error":"Internal server error"}` when creating invite  
**Cause:** Cloudflare KV free tier limit (1,000 writes/day) exceeded  
**Error in logs:** `Error: KV put() limit exceeded for the day`  
**Solution:** 
- Wait until midnight UTC for limit reset
- Or upgrade to paid plan ($5/month, unlimited writes)
- Or investigate what's causing excessive KV writes
**Fix for README:** Add warning about KV limits in admin documentation

### 6. Local vs Production Admin Keys
**Problem:** Local worker (`wrangler dev`) uses `.dev.vars` for ADMIN_API_KEY  
**Confusion:** Production admin key doesn't work with local worker  
**Solution:** Set ADMIN_API_KEY in `.dev.vars` for local development  
**Fix for README:** Clarify local vs production admin key configuration

---

## Questions to Answer for Docs

1. **Which Worker to run for invite generation?**
   - Is it the main Worker (mute-mouse-2cd2)?
   - Or a specific setup/admin Worker?
   - Does it matter which Worker?

2. **Invite code generation command?**
   - Is it: `node setup-cloudflare.js --generate-invite`?
   - Or something else?

3. **Can users generate their own invites?**
   - Or do they need admin access to Worker?

---

## README Updates Needed

### INSTALLATION_CHECKLIST.md
- [ ] Add note about `chmod +x` after `git reset --hard`
- [ ] Clarify `prepare_build.sh` Cloudflare sync prompt (say No if using register-user.sh)
- [ ] Add "Generating Invite Codes" section

### UPGRADE_FROM_OLD_VERSION.md
- [ ] Add `chmod +x scripts/*.sh scripts/*.py` step after git reset
- [ ] Clarify prepare_build.sh prompt behavior

### README.md
- [ ] Add "How to Generate Invite Codes" section
- [ ] Clarify Worker setup (which Worker to run)
- [ ] Document admin vs. user workflows

---

## Next Steps

**WAIT FOR KV LIMIT RESET** (midnight UTC, ~2.5 hours)

Then complete Ubuntu PC test by the book:
1. Generate invite code (production Worker will work after reset)
2. Complete registration on Ubuntu PC
3. Verify all v1.2.1 features work
4. Document any remaining issues
5. Update README with all findings

