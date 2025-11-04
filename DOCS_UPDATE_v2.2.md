# Documentation Updates for v2.2.0

## Summary of Changes

This release includes major UX improvements to `register-user.sh`:

### New Features
1. **Compact QR Code Generation** - Python-based QR generator creates terminal-friendly codes (~50% smaller)
2. **Two-Step Monitoring Prompt** - Clear workflow: Start/Quit, then Local/Cloud/Quit
3. **Auto-Restore BASE_URL** - Self-healing when BASE_URL missing from .env
4. **Special Character Handling** - Passphrases with shell metacharacters now properly quoted

### Key Documentation Updates Needed

#### README.md
- Update registration workflow section
- Document new monitoring mode options (Local vs Cloud sync)
- Add compact QR code feature
- Update dependencies (python3-qrcode instead of qrencode)
- Clarify two-step startup process

#### RBMonitor_project_description_and_future_plans.md
- Update registration flow diagrams
- Document monitoring modes
- Add QR code generation details
- Update dependency list

#### CHANGELOG.md
- Add v2.2.0 entry with all improvements

---

## Detailed Changes by File

### README.md Updates

**Section: Dependencies**
- REMOVE: `qrencode` 
- ADD: `python3-qrcode` (or `pip install qrcode`)

**Section: User Registration**
Current workflow needs update to reflect:
1. Interactive menu with [H]elp, [D]ry run, [R]egister, [Q]uit
2. Compact QR code generation (optional, terminal-friendly)
3. Two-step monitoring prompt:
   - Step 1: Start now or Quit?
   - Step 2: Local only / Cloud sync / Quit

**Section: Starting Monitoring**
Clarify the difference:
- **Local only**: `docker compose up -d` (web interface at localhost:8080)
- **Cloud sync**: `docker compose up -d && ./start-monitoring.sh start` (local + remote dashboard)
- Script handles both automatically based on user choice

---

## Version Numbering

Current: v2.1.0
Proposed: **v2.2.0**

Rationale:
- Minor version bump (not patch) due to new features
- No breaking changes (backward compatible)
- Major UX improvements warrant minor version bump

---

## Files to Update

1. ✅ README.md - User-facing guide
2. ✅ RBMonitor_project_description_and_future_plans.md - Technical reference
3. ✅ CHANGELOG.md - Version history
4. ✅ scripts/register-user.sh - Update VERSION variable to 2.2.0
5. ✅ Create git tag: v2.2.0
