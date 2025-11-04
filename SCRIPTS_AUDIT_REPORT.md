# Scripts Folder Audit Report
**Date:** November 4, 2025  
**Purpose:** Identify which scripts to keep, delete, or move to "clutter bag"

---

## Analysis Summary

### ✅ KEEP (Essential - v1.2.1 Core)
| File | Size | Purpose | Used By | Notes |
|------|------|---------|---------|-------|
| `register-user.sh` | 58KB | **Primary registration** - v1.2.1 with passphrase UX fixes | End users, installation | Core workflow |
| `prepare_build.sh` | 16KB | **Initial setup** - Creates .env, config.json, selects ports | Installation, first-time setup | Core workflow |
| `generate-compact-qr.py` | 2.4KB | **Compact QR generation** - Terminal + PNG QR codes | register-user.sh (v1.2.0+) | New feature |
| `show_monitor_url_and_qr.sh` | 11.8KB | **Display dashboard access** - Show URLs/QR for local/remote dashboards | Users who want to view dashboard without re-registering | Standalone utility |

### ✅ UTILITY (Standalone Features)
| File | Size | Purpose | Use Case | Recommendation |
|------|------|---------|----------|----------------|
| `show_monitor_url_and_qr.sh` | 11.8KB | **Display dashboard URLs/QR** - Shows local/remote dashboard with QR codes | Users who want to view dashboard URL/QR without re-registering | **KEEP** - Useful standalone utility |

### ⚠️ REDUNDANT/LEGACY (Move to Clutter Bag)
| File | Size | Purpose | Redundant With | Recommendation |
|------|------|---------|----------------|----------------|
| `register-with-qr.sh` | 5.7KB | **Legacy registration** - Calls old register-user.sh, generates QR | register-user.sh (now has integrated QR) | **MOVE** - Superseded by v1.2.0+ |

### 🔧 UTILITY (Decision Needed)
| File | Size | Purpose | Decision | Notes |
|------|------|---------|----------|-------|
| `monitor_control.sh` | 10.8KB | **Orchestration controller** - Start/stop monitoring (Docker + uploader) | **KEEP for now** | Used by you for operations; needed? |
| `test-log-hygiene.sh` | 2.5KB | **Security test** - Scans for credential leaks | **MOVE to tests/** (for CI) | Useful for CI pipeline (task #9) |

### ❌ DELETE (Junk Files)
| File | Size | Reason |
|------|------|--------|
| `.prepare_build.sh.swp` | 16KB | Vim swap file - leftover editor temp |
| `.run/` | directory | Runtime PID files - should be gitignored & excluded |

---

## Detailed Analysis

### 1. `register-user.sh` ✅ KEEP
- **Status:** Core script, v1.2.1 (Nov 4)
- **Purpose:** Complete registration workflow with:
  - Passphrase handling (fixed double-prompt bug)
  - QR code generation (compact terminal QR)
  - .env and .cloudflare-config.json creation
  - Monitoring startup prompts
- **Used by:** End users, installation checklist
- **Decision:** **ESSENTIAL - KEEP**

### 2. `prepare_build.sh` ✅ KEEP
- **Status:** Core setup script (Oct 25)
- **Purpose:** Pre-registration setup:
  - Port selection (auto-detect conflicts)
  - .env creation with BASE_URL
  - config.json generation from Docker watchers
  - Docker group ID detection
  - QR code display helpers
- **Used by:** Installation flow (step 2 in INSTALLATION_CHECKLIST.md)
- **Decision:** **ESSENTIAL - KEEP**

### 3. `generate-compact-qr.py` ✅ KEEP
- **Status:** New utility (Nov 3), v1.2.0+
- **Purpose:** Generate terminal-friendly and PNG QR codes
  - Smaller terminal output (fits screen)
  - Variable box size for different environments
- **Used by:** register-user.sh (SHOW_TERMINAL integration)
- **Decision:** **KEEP - Active feature**

### 4. `register-with-qr.sh` ⚠️ LEGACY → MOVE
- **Status:** Old registration wrapper (Oct 20) - **Pre-v1.2.0**
- **Purpose:** 
  - Calls `./scripts/register-user.sh`
  - Generates QR code with optional passphrase embedding
  - Outputs PNG file
- **Redundant with:** 
  - register-user.sh now has integrated QR generation (v1.2.0+)
  - generate-compact-qr.py handles QR better
- **README mentions:** "Alternative: register-with-qr.sh (Legacy)"
- **Decision:** **MOVE TO CLUTTER BAG** - No longer needed; functionality absorbed

### 5. `show_monitor_url_and_qr.sh` ✅ KEEP
- **Status:** Dashboard display helper (Oct 20) - **RESTORED**
- **Purpose:**
  - Shows local (Docker) and remote (Cloudflare) dashboard URLs
  - Generates QR codes for both (terminal + PNG)
  - Optional passphrase embedding
  - Interactive mode (choose local/remote) or flags (--local, --remote)
- **Use Case:** Users who want to view dashboard URL/QR **without re-registering**
  - After registration completed, they can run this anytime
  - Useful for sharing access (e.g., mobile phone via QR)
  - No need to dig through registration output
- **Decision:** **KEEP** - Standalone utility, not redundant (serves different purpose than registration flow)

### 6. `monitor_control.sh` 🔧 UTILITY
- **Status:** Orchestration controller (Oct 23)
- **Purpose:**
  - Start/stop monitoring (Docker producer + Node uploader)
  - Status checks
  - Interactive menu (S/V/X/R/Q)
  - PID tracking in .run/
- **Question for you:** Do you actively use this for operations?
  - If YES → **KEEP** (operational tool)
  - If NO → **MOVE** (end users use docker compose + manual uploader)
- **Decision:** **PENDING YOUR INPUT**

### 7. `test-log-hygiene.sh` 🔧 TEST SCRIPT
- **Status:** Security scanner (Oct 28)
- **Purpose:**
  - Scans scripts/worker code for credential leaks
  - Checks for exposed tokens, passwords, secrets
  - Useful for pre-commit validation
- **Decision:** **MOVE TO tests/ directory** (not delete!)
  - Keep for CI/CD pipeline (task #9)
  - Not needed in scripts/ (confuses end users)
  - Future: Integrate into GitHub Actions

### 8. `.prepare_build.sh.swp` ❌ DELETE
- **Status:** Vim swap file (Oct 25)
- **Reason:** Editor temp file, should never be committed
- **Decision:** **DELETE IMMEDIATELY**

### 9. `.run/` directory ❌ DELETE (contents, keep pattern)
- **Status:** Runtime PID directory
- **Reason:** Contains process tracking files (uploader.pid, etc.)
- **Decision:** 
  - **DELETE contents** (runtime state)
  - **Already in .gitignore** (keep empty directory in repo structure)

---

## Recommended Actions

### Immediate (Safe to do now):
```bash
# Delete junk files
rm -f scripts/.prepare_build.sh.swp
rm -rf scripts/.run/

# Verify .gitignore has:
# .run/
# *.swp
```

### Pending your clutter bag location:
```bash
# Move legacy/redundant scripts (AFTER you confirm clutter bag path)
# mv scripts/register-with-qr.sh <CLUTTER_BAG>/
# mv scripts/show_monitor_url_and_qr.sh <CLUTTER_BAG>/

# Move test script to proper location
# mkdir -p tests/
# mv scripts/test-log-hygiene.sh tests/
```

### Questions for You:
1. **Where is your "clutter bag"?** (Path outside repo for archiving old files)
2. **Do you use `monitor_control.sh` actively?** (Keep vs. move decision)
3. **Should I create a `tests/` directory** for test-log-hygiene.sh? (For future CI)

---

## Summary

| Action | Count | Files |
|--------|-------|-------|
| ✅ KEEP | 5 | register-user.sh, prepare_build.sh, generate-compact-qr.py, monitor_control.sh, show_monitor_url_and_qr.sh |
| ⚠️ MOVE | 1 | register-with-qr.sh |
| 🧪 RELOCATE | 1 | test-log-hygiene.sh → tests/ |
| ❌ DELETE | 2 | .prepare_build.sh.swp, .run/ |

**Update (Nov 4, 2025):**
After initial cleanup, `show_monitor_url_and_qr.sh` was **restored** based on user feedback.
**Reason:** Provides standalone utility for users to view dashboard URL/QR without re-registering.
**Use case:** After setup, users can quickly get QR code for mobile access anytime.
