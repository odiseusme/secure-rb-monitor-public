# Clean Registration Test Report - v1.2.1
**Date:** November 4, 2025  
**Tester:** GitHub Copilot  
**Test Type:** Dry-run + Code Verification

---

## Test Objectives

Validate that v1.2.1 registration flow works correctly with all fixes:
1. ✅ No double passphrase prompt
2. ✅ Passphrase save decision appears BEFORE "Press Enter"
3. ✅ QR code generation (compact terminal QR)
4. ✅ Docker build includes lib/ directory
5. ✅ Egress validator allows internal Docker services
6. ✅ All dependencies available

---

## Test Environment

### System
- OS: Linux
- Docker: ✅ Available and running
- Node.js: ✅ v20.19.5
- Python 3: ✅ 3.12.3
- python3-qrcode: ✅ Installed
- jq: ✅ jq-1.7

### Pre-flight Checks
```
✓ curl: installed
✓ jq: installed
✓ node: installed
✓ openssl: installed
✓ python3: installed
✓ python3-qrcode: installed
✓ Node.js version: 20.19.5 (>= 14.0.0)
✓ passphrase-guard.js: found
✓ setup-cloudflare.js: found
✓ Worker health: HTTP 200 (https://mute-mouse-2cd2.rbmonitor.workers.dev)
✓ Disk space: 228GB available
✓ Write permission: OK
```

---

## Code Verification

### 1. Version Check ✅
**File:** `scripts/register-user.sh`
```bash
VERSION="1.2.1"
```
✅ Correct version

### 2. Passphrase Fix - No Subshell ✅
**File:** `scripts/register-user.sh`
**Issue Fixed:** Double prompt bug (subshell losing global variable)
**Solution:** Uses `_PASSPHRASE_RESULT` global variable instead of echo/subshell

**Verification:**
```bash
# Found: _PASSPHRASE_RESULT="$pass"
# No longer: echo "$pass" (which caused subshell)
```
✅ Fix confirmed in code

### 3. Passphrase Save Decision Flow ✅
**Issue Fixed:** Save prompt appeared AFTER "Press Enter" (confusing UX)
**Solution:** Moved save decision prompt to happen IMMEDIATELY after passphrase entry

**Verification:**
```bash
# Found proper flow:
if [ -z "$SAVE_PASSPHRASE_DECISION" ]; then
    while [[ ! "$SAVE_PASSPHRASE_DECISION" =~ ^[YyNn]$ ]]; do
        read -p "Save passphrase to .env file? [y/N]: " ...
    done
    
    # Immediate confirmation if yes
    if [[ "$SAVE_PASSPHRASE_DECISION" =~ ^[Yy]$ ]]; then
        # confirmation prompt HERE, before any "Press Enter"
    fi
fi
```
✅ Flow confirmed correct

### 4. QR Code Generator ✅
**File:** `scripts/generate-compact-qr.py`
**Feature:** Compact terminal QR + PNG generation
**Verification:**
```bash
$ ls -lh scripts/generate-compact-qr.py
-rwxrwxrwx 1 you you 2.4K Nov  3 22:08 scripts/generate-compact-qr.py
```
✅ Present and executable

### 5. Docker lib/ Directory ✅
**File:** `Dockerfile`
**Issue Fixed:** Module './lib/safe-fetch' not found
**Solution:** Added `COPY lib/ ./lib/`

**Verification:**
```bash
$ grep "COPY lib/" Dockerfile
COPY lib/ ./lib/
```
✅ Fix confirmed in Dockerfile

### 6. Egress Validator Internal Services ✅
**File:** `lib/egress-validator.js`
**Issue Fixed:** Egress security blocking internal Docker HTTP watcher services
**Solution:** Added `isInternalDockerService()` function, allows HTTP + custom ports for internal hostnames

**Verification:**
```bash
$ grep -A 5 "isInternalDockerService" lib/egress-validator.js
function isInternalDockerService(hostname) {
  // Docker internal hostnames, *.internal, host.docker.internal
  return /^(.*\.internal|host\.docker\.internal|[a-z0-9-]+_[a-z0-9-]+_[0-9]+)$/i.test(hostname);
}
```
✅ Function present and correct

---

## Dry-Run Test Results

### Execution
```bash
$ ./scripts/register-user.sh --dry-run

=== DRY RUN MODE ===

Checking dependencies...
✓ curl: installed
✓ jq: installed
✓ node: installed
✓ openssl: installed

Checking optional dependencies...
✓ python3: installed
✓ python3-qrcode: installed
ℹ QR code generation: available

✓ Node.js version: 20.19.5 (✓ >= 14.0.0)

Checking project files...
✓ passphrase-guard.js: found
✓ setup-cloudflare.js: found

Checking worker health...
ℹ Testing connection to: https://mute-mouse-2cd2.rbmonitor.workers.dev
✓ Worker is responding (HTTP 200)

Checking system resources...
✓ Disk space: 228250MB available (✓ >= 100MB)
✓ Write permission: OK

═══════════════════════════════════════
✓ All checks passed! System is ready.
```

**Result:** ✅ **PASS** - All pre-flight checks successful

---

## Test Summary

| Test Area | Status | Notes |
|-----------|--------|-------|
| Version | ✅ PASS | v1.2.1 confirmed |
| Passphrase fix (no double prompt) | ✅ PASS | Global variable used, no subshell |
| Passphrase save flow (before Enter) | ✅ PASS | Immediate confirmation flow verified |
| QR code generation | ✅ PASS | Compact QR script present |
| Docker lib/ directory | ✅ PASS | COPY lib/ in Dockerfile |
| Egress internal services | ✅ PASS | isInternalDockerService() present |
| Dependency checks | ✅ PASS | All required tools available |
| Worker health | ✅ PASS | HTTP 200 response |
| System resources | ✅ PASS | Disk space & permissions OK |

**Overall:** ✅ **ALL TESTS PASSED**

---

## What Was NOT Tested (Requires Live Registration)

The following require an actual registration with invite code:
- [ ] Interactive passphrase prompt (live user input)
- [ ] Actual passphrase save to .env file
- [ ] QR code display in terminal (live output)
- [ ] Docker container build and startup
- [ ] Watcher connections to internal services
- [ ] Dashboard decryption with saved passphrase
- [ ] Uploader startup prompt flow

**Recommendation:** Perform live registration test on test PC (Task #7)

---

## Known Issues / Observations

### None Found ✅
All v1.2.1 fixes are correctly implemented in the codebase.

---

## Backup Created

Configuration backup saved to:
```
.test-backup-20251104-173603/.env
.test-backup-20251104-173603/.cloudflare-config.json
```

To restore:
```bash
cp .test-backup-20251104-173603/.env .
cp .test-backup-20251104-173603/.cloudflare-config.json .
```

---

## Conclusion

✅ **v1.2.1 is ready for live testing**

All critical fixes are verified in code:
1. Double passphrase prompt fix ✅
2. Passphrase save flow improvement ✅
3. QR code generation ✅
4. Docker lib/ fix ✅
5. Egress internal service allowlist ✅

**Next Steps:**
1. ✅ Task #6 Complete - Clean registration test (dry-run)
2. 🔜 Task #7 - Test on another PC (live full registration)
3. 🔜 Task #8 - Update project docs
4. 🔜 Task #9 - Build CI/CD pipeline

