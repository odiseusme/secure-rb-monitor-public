# Release Notes: v1.2.1 (2025-11-04)

**Type**: Patch Release (Bug Fixes)  
**Focus**: Critical registration flow and Docker deployment fixes

This patch release addresses several important bugs discovered during v1.2.0 testing, including a confusing double-prompt issue, Docker deployment failures, and network connectivity problems for internal services.

---

## 🐛 Critical Fixes

### 1. **Passphrase Flow Double-Prompt Bug** ⭐ HIGH PRIORITY

**Problem**: Users were being asked TWICE whether to save their passphrase to .env:
- First time: After generating/entering passphrase (expected)
- Second time: After registration completed (confusing and redundant)

**Root Cause**: 
```bash
# Old code - subshell execution
PASSPHRASE="$(get_passphrase)"
# The $(command substitution) creates a subshell
# Global variable SAVE_PASSPHRASE_DECISION set in subshell was lost
```

**Solution**: Changed to global variable pattern
```bash
# New code - no subshell
get_passphrase  # Sets _PASSPHRASE_RESULT global
PASSPHRASE="$_PASSPHRASE_RESULT"
# Global SAVE_PASSPHRASE_DECISION preserved across functions
```

**Impact**: Registration flow now asks once, decision is remembered, no confusion.

---

### 2. **Passphrase Flow UX Reorganization** ⭐ HIGH PRIORITY

**Problem**: Security notice and save decision appeared AFTER registration, when it was too late to change your mind.

**Old Flow**:
1. Show passphrase
2. Press Enter to continue
3. **Registration happens** ←️ Point of no return
4. Security notice appears
5. Asked about saving passphrase

**New Flow**:
1. Show passphrase
2. **Security notice** ← Informed decision BEFORE registration
3. **Save decision** ← Choose BEFORE registration
4. **Confirmation** (if saving) ← Extra warning BEFORE registration
5. Press Enter to continue
6. Registration happens ← User already made all decisions

**Impact**: Users make informed decisions before registration completes, clearer security understanding.

---

### 3. **Docker Missing lib/ Directory** ⭐ CRITICAL

**Problem**: Rebuilt Docker containers crashed with:
```
Error: Cannot find module './lib/safe-fetch'
```

**Root Cause**: 
- lib/ directory added in commit b6ac553 (Oct 30) for network egress security
- Dockerfile never updated to copy lib/ into image
- Old images (built before Oct 30) worked fine
- New builds triggered the bug

**Solution**: Added to Dockerfile (line 30):
```dockerfile
COPY lib/ ./lib/
```

**Impact**: Docker containers now build and run successfully with all required modules.

---

### 4. **Network Egress Security Blocking Internal Services** ⭐ CRITICAL

**Problem**: Monitoring containers couldn't fetch data from watcher services:
```
[E_EGRESS_SCHEME] HTTP egress blocked. Target: http://watcher_ergo-service-1:3000/info
[E_EGRESS_SCHEME] HTTP egress blocked. Target: http://watchme_first-service-1:3000/info
```

**Root Cause**: 
- Egress security (added Oct 30) enforces HTTPS for external domains
- Internal Docker services (watcher_ergo-service-1) use HTTP
- Security validator didn't distinguish between internal vs external traffic

**Solution**: Added intelligent internal service detection:
```javascript
function isInternalDockerService(hostname) {
  // Match Docker Compose naming: service_name-container-number
  const dockerPattern = /^[a-z0-9_-]+(-[a-z0-9_-]+)?-\d+$/i;
  const internalDns = hostname.endsWith('.internal') || 
                      hostname === 'host.docker.internal';
  return dockerPattern.test(hostname) || internalDns;
}
```

**Security Model**:
- ✅ HTTP allowed: Internal Docker services only
- ✅ Custom ports allowed: Internal Docker services only
- ❌ External domains: HTTPS with standard ports enforced

**Impact**: Watcher services connect successfully, data flows to dashboard, security maintained for external requests.

---

### 5. **Dashboard URL in Monitoring Summary**

**Problem**: Monitoring prompt showed stale or incorrect dashboard URL from old `DASHBOARD_URL` variable.

**Solution**: Changed to pass `dashboard_url` as function parameter from registration result.

**Impact**: Users always see the correct dashboard URL when starting cloud sync.

---

### 6. **Python Dependency Check in Dry Run**

**Problem**: Dry run didn't check for python3-qrcode library, users discovered missing QR generation too late.

**Solution**: Added comprehensive Python check:
```bash
# Check Python (optional, for QR code generation)
if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import qrcode" 2>/dev/null; then
    success "python3-qrcode: installed"
  else
    warn "QR code generation will be unavailable"
    echo "Install: sudo apt-get install -y python3-qrcode"
  fi
fi
```

**Impact**: Users know about missing dependencies before registering, can install if desired.

---

## 📋 Testing Verification

All fixes verified through complete registration and monitoring workflow:

- [x] Passphrase flow: Single prompt, correct order
- [x] Docker build: Successful with lib/ directory
- [x] Docker run: No module errors
- [x] Watcher connectivity: HTTP to internal services working
- [x] External security: HTTPS still enforced for external domains
- [x] Dashboard URL: Correct URL displayed in summary
- [x] Dry run: Python check shows installation guidance
- [x] Local monitoring: http://localhost:8080 accessible
- [x] Remote dashboard: Cloud sync functional
- [x] Full system: End-to-end data flow confirmed

---

## 🔄 Migration Guide

**No migration needed.** All fixes are backward compatible.

If you're on v1.2.0:
1. Pull latest: `git pull origin main`
2. Rebuild Docker: `docker compose down && docker compose up -d --build`
3. Test registration: `./scripts/register-user.sh --dry-run`

---

## 📦 Changed Files

**Core Files**:
- `scripts/register-user.sh` - Passphrase flow fixes, version bump to 1.2.1
- `Dockerfile` - Added lib/ directory copy (line 30)
- `lib/egress-validator.js` - Internal service detection logic

**Documentation**:
- `CHANGELOG.md` - v1.2.1 entry
- `RELEASE_v1.2.1.md` - This file

---

## 🎯 Upgrade Recommendation

**Upgrade Priority**: **HIGH** for new deployments, **MEDIUM** for existing working systems

**Reasons to upgrade**:
- ✅ Registration experience significantly improved
- ✅ Docker rebuilds now work (critical for infrastructure-as-code)
- ✅ Internal service communication fixed (required for multi-container setups)

**Safe to skip** if:
- Already registered and monitoring successfully with v1.2.0
- Not planning to re-register or rebuild Docker

---

## 🙏 Acknowledgments

All issues discovered and fixed during comprehensive v1.2.0 testing session.

Special thanks for:
- Thorough testing of the passphrase flow
- Patience during multiple registration iterations
- Catching the subtle double-prompt bug
- Verifying Docker rebuild scenarios
- Testing network connectivity edge cases

---

## 📌 Version History

- **v1.2.1** (2025-11-04) - Bug fixes (this release)
- **v1.2.0** (2025-11-04) - QR codes, monitoring prompts, BASE_URL auto-restore
- **v1.1.0** (2025-11-01) - Previous stable release

---

**Full Changelog**: https://github.com/odiseusme/secure-rb-monitor-public/blob/main/CHANGELOG.md
