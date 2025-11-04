# Scripts Folder Analysis

## Files Found:
1. **generate-compact-qr.py** (2.4KB, Nov 3)
   - Status: ✅ KEEP - Used by v1.2.0+
   - Purpose: Compact QR code generation
   - Used by: register-user.sh

2. **monitor_control.sh** (10.8KB, Oct 23)
   - Status: ❓ REVIEW NEEDED
   - Purpose: Unknown - need to check content
   - May overlap with start-monitoring.sh?

3. **prepare_build.sh** (16.3KB, Oct 25)
   - Status: ✅ KEEP - Core installation script
   - Purpose: Initial setup, creates .env, config.json
   - Used by: Installation process

4. **.prepare_build.sh.swp** (16KB, Oct 25)
   - Status: ❌ DELETE - Vim swap file
   - Purpose: Editor temp file (leftover)

5. **register-user.sh** (58KB, Nov 4)
   - Status: ✅ KEEP - Core registration script
   - Purpose: User registration with v1.2.1 features
   - Used by: Primary registration workflow

6. **register-with-qr.sh** (5.7KB, Oct 20)
   - Status: ❓ LEGACY? KEEP OR DELETE?
   - Purpose: QR registration (pre-v1.2.0)
   - Functionality now in register-user.sh
   - Decision: Archive or keep for backward compat?

7. **.run/** (directory, Oct 23)
   - Status: ❌ DELETE - Runtime PID files
   - Purpose: Process tracking (should be gitignored)
   - Already in .gitignore

8. **show_monitor_url_and_qr.sh** (11.8KB, Oct 20)
   - Status: ❓ REVIEW NEEDED
   - Purpose: Unknown - may show URL/QR after setup?
   - Possibly redundant with register-user.sh features?

9. **test-log-hygiene.sh** (2.5KB, Oct 28)
   - Status: ❓ TEST SCRIPT - Keep or move?
   - Purpose: Testing script (not for users)
   - Decision: Keep for CI/CD or archive?

## Cleanup Actions Needed:

### Immediate Delete:
- [ ] .prepare_build.sh.swp (vim swap file)
- [ ] .run/ directory (runtime files)

### Review Required:
- [ ] monitor_control.sh - Check if overlaps with start-monitoring.sh
- [ ] register-with-qr.sh - Legacy? README mentions it as "Alternative: register-with-qr.sh (Legacy)"
- [ ] show_monitor_url_and_qr.sh - Redundant with register-user.sh?
- [ ] test-log-hygiene.sh - Move to tests/ or archive?

## Questions for User:
1. What's your "clutter bag" location? Should we move legacy/test scripts there?
2. Keep test-log-hygiene.sh for CI/CD pipeline (task #9)?
3. Keep register-with-qr.sh as legacy fallback or remove it?
