# show_monitor_url_and_qr.sh - Upgrade Plan

**Version:** Current → v2.0  
**Date:** November 6, 2025  
**Status:** Planning Phase

---

## Executive Summary

This document details a comprehensive upgrade plan for `show_monitor_url_and_qr.sh`, addressing 7 identified issues ranging from critical bugs to UX improvements. The upgrade maintains backward compatibility while adding robustness, better error handling, and quality-of-life features.

---

## Issues Found & Prioritization

### Priority 1: Critical Issues ⚠️

#### Issue #1: Missing jq Check Before URL Encoding
**Severity:** CRITICAL  
**Current Line:** ~302  
**Problem:**
```bash
local encoded_pass=$(printf %s "$passphrase" | jq -sRr @uri)
```
Script uses `jq` for URL encoding but only checks for `jq` when reading config (line ~239), not when encoding passphrase. If user has `.cloudflare-config.json` but `jq` was uninstalled after registration, script will crash.

**Test:**
```bash
# In test-show-monitor-script.sh - Test 1
# Validates jq availability and URL encoding functionality
```

**Impact:** Script crashes with cryptic error when embedding passphrase  
**Users Affected:** Anyone using `--embed-passphrase` without jq installed

**Fix:**
```bash
# Before attempting URL encoding
if [ "$embed_now" = "1" ] && [ -n "$passphrase" ]; then
  # Check for jq
  if ! command -v jq >/dev/null 2>&1; then
    echo "${RED}✗ jq not found (required for passphrase encoding)${NC}"
    echo "   Install: ${CYAN}sudo apt install jq${NC}"
    echo "   Showing URL without embedded passphrase..."
    embed_now=0
  else
    local encoded_pass=$(printf %s "$passphrase" | jq -sRr @uri)
    final_url="${dashboard_url}#p=${encoded_pass}"
    echo "${GREEN}✓ Passphrase embedded in URL fragment${NC}"
  fi
fi
```

---

#### Issue #2: Fragile .env Passphrase Parsing
**Severity:** HIGH  
**Current Line:** ~277  
**Problem:**
```bash
passphrase=$(grep -E '^DASH_PASSPHRASE=' .env | cut -d= -f2- | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' || true)
```
Complex sed regex with escaped quotes is hard to read and may fail with:
- Passphrases containing equals signs
- Mixed quote types
- Trailing/leading whitespace
- Empty values

**Test:**
```bash
# In test-show-monitor-script.sh - Test 2
# Tests 5 different passphrase formats:
# 1. Double quotes: DASH_PASSPHRASE="Test Pass 123"
# 2. Single quotes: DASH_PASSPHRASE='Test Pass 456'
# 3. No quotes: DASH_PASSPHRASE=NoQuotes789
# 4. Special chars: DASH_PASSPHRASE="Pass@#$%^&*()"
# 5. Equals in value: DASH_PASSPHRASE="Pass=With=Equals"
```

**Impact:** Passphrase not extracted correctly → user prompted unnecessarily  
**Users Affected:** Anyone with complex passphrases in .env

**Fix (Option A - Safer Parsing):**
```bash
# More robust parsing function
get_env_value() {
  local key="$1"
  local file="${2:-.env}"
  
  if [ ! -f "$file" ]; then
    return 1
  fi
  
  # Get the value after = sign
  local value=$(grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-)
  
  # Remove surrounding quotes if present
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  echo "$value"
}

# Usage:
passphrase=$(get_env_value "DASH_PASSPHRASE" ".env" || true)
```

**Fix (Option B - Source .env Safely):**
```bash
# Source .env in a subshell to avoid polluting environment
passphrase=$(set -a; source .env 2>/dev/null; echo "$DASH_PASSPHRASE")
```

**Recommendation:** Use Option A (more explicit, easier to debug)

---

#### Issue #3: LAN IP Detection Fallback Not Useful
**Severity:** MEDIUM  
**Current Line:** ~127  
**Problem:**
```bash
echo "127.0.0.1"  # Falls back to localhost
```
When LAN IP detection fails, script falls back to `127.0.0.1` which:
- Cannot be accessed from mobile devices
- Makes QR code useless for remote access
- Provides no warning to user

**Test:**
```bash
# In test-show-monitor-script.sh - Test 3
# Validates LAN IP is in private range (10.x, 192.168.x, 172.16-31.x)
# Warns if fallback is localhost
```

**Impact:** QR code for "mobile access" doesn't work  
**Users Affected:** Anyone on networks where standard detection fails

**Fix:**
```bash
get_lan_ip() {
  local ip=""
  
  # Try hostname -I (Linux)
  if command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ] && { echo "$ip"; return; }
  fi
  
  # Try ip route (Linux)
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1);exit}}}')
    [ -n "$ip" ] && { echo "$ip"; return; }
  fi
  
  # Try ipconfig (macOS)
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 eth0; do
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
      [ -n "$ip" ] && { echo "$ip"; return; }
    done
  fi
  
  # CHANGED: Return empty instead of localhost
  echo ""
}

# In show_local_dashboard():
local lan_ip=$(get_lan_ip)

if [ -n "$lan_ip" ]; then
  echo ""
  echo "${BOLD}Access from mobile/other devices (same network):${NC}"
  echo "  ${BLUE}http://${lan_ip}:${host_port}/${NC}"
  
  if ask_yn "${BOLD}Show QR code for mobile access?${NC}" "y"; then
    show_qr "http://${lan_ip}:${host_port}/" \
            "dashboard-local.png" \
            "${BOLD}${GREEN}📱 Scan with mobile device:${NC}"
  fi
else
  echo ""
  echo "${YELLOW}⚠  Could not detect LAN IP address${NC}"
  echo "   Mobile QR code requires LAN IP - skipping"
  echo ""
  echo "${CYAN}💡 Tip:${NC} You can manually use: http://YOUR_IP:${host_port}/"
  echo "   Find your IP with: ${CYAN}ip addr${NC} or ${CYAN}hostname -I${NC}"
fi
```

---

### Priority 2: UX Improvements 📱

#### Issue #4: Docker Port Detection Fragile
**Severity:** LOW  
**Current Line:** ~188  
**Problem:**
```bash
host_port=$(docker port rosen-bridge-monitor 8080 2>/dev/null | cut -d: -f2 || echo "8080")
```
- `docker port` returns format `0.0.0.0:8080` but could be `:::8080` (IPv6)
- No validation that returned value is actually a port number
- Silent fallback to 8080 may be wrong

**Test:**
```bash
# In test-show-monitor-script.sh - Test 4
# Validates docker port command returns numeric value
```

**Impact:** Wrong port displayed if Docker binding is non-standard  
**Users Affected:** Anyone with custom Docker port configurations

**Fix:**
```bash
# Get port from .env or docker
local host_port=""
local host_ip="0.0.0.0"

if [ -f ".env" ]; then
  host_port=$(grep -E '^HOST_PORT=' .env | tail -1 | cut -d= -f2 | tr -d '"' || true)
  host_ip=$(grep -E '^HOST_IP=' .env | tail -1 | cut -d= -f2 | tr -d '"' || echo "0.0.0.0")
fi

if [ -z "$host_port" ]; then
  # Try to detect from docker (more robust parsing)
  local docker_output=$(docker port rosen-bridge-monitor 8080 2>/dev/null || true)
  if [ -n "$docker_output" ]; then
    # Extract port number (handles both 0.0.0.0:8080 and :::8080 formats)
    host_port=$(echo "$docker_output" | grep -oE '[0-9]+$' | head -1)
  fi
  
  # Final fallback
  if [ -z "$host_port" ]; then
    host_port="8080"
    echo "${YELLOW}⚠  Could not detect port, assuming default: 8080${NC}"
  fi
fi

# Validate port is numeric
if ! [[ "$host_port" =~ ^[0-9]+$ ]]; then
  echo "${RED}✗ Invalid port detected: $host_port${NC}"
  host_port="8080"
fi
```

---

#### Issue #5: QR Files Saved in Project Root
**Severity:** LOW  
**Current:** Saves `dashboard-local.png`, `dashboard-USERID.png` in current directory  
**Problem:**
- Clutters project root
- Files tracked by git if .gitignore not updated
- No organization for multiple QR files

**Test:**
```bash
# In test-show-monitor-script.sh - Test 5
# Validates QR file creation and cleanup
```

**Impact:** Repository clutter, accidental commits  
**Users Affected:** All users generating QR codes

**Fix:**
```bash
# Add at script start
QR_OUTPUT_DIR=".qr-codes"

# Create directory if needed
mkdir -p "$QR_OUTPUT_DIR"

# Update .gitignore
if [ -f ".gitignore" ]; then
  if ! grep -q "^.qr-codes/" .gitignore; then
    echo ".qr-codes/" >> .gitignore
  fi
fi

# In show_qr function:
show_qr() {
  local url="$1"
  local filename="$2"
  local description="$3"
  
  # Prepend output directory
  local output_path="${QR_OUTPUT_DIR}/${filename}"
  
  # ... existing QR generation code ...
  
  # PNG QR
  if qrencode -o "$output_path" "$url" 2>/dev/null; then
    echo "${GREEN}✓ Saved QR code: ${BOLD}${output_path}${NC}"
  else
    echo "${YELLOW}⚠  Failed to save PNG QR code${NC}"
  fi
}
```

---

#### Issue #6: URL Not Copyable Easily
**Severity:** LOW  
**Current:** User must manually select URL from terminal  
**Problem:**
- Error-prone (easy to copy incorrectly)
- Time-consuming
- No automation support

**Test:**
```bash
# In test-show-monitor-script.sh - Test 8
# Checks for xclip, pbcopy, clip.exe availability
```

**Impact:** Poor UX, slow workflow  
**Users Affected:** Anyone sharing URLs frequently

**Fix:**
```bash
# Add clipboard copy function
copy_to_clipboard() {
  local text="$1"
  
  # Try xclip (Linux)
  if command -v xclip >/dev/null 2>&1; then
    echo -n "$text" | xclip -selection clipboard 2>/dev/null && return 0
  fi
  
  # Try pbcopy (macOS)
  if command -v pbcopy >/dev/null 2>&1; then
    echo -n "$text" | pbcopy 2>/dev/null && return 0
  fi
  
  # Try clip.exe (Windows/WSL)
  if command -v clip.exe >/dev/null 2>&1; then
    echo -n "$text" | clip.exe 2>/dev/null && return 0
  fi
  
  return 1
}

# After displaying URL:
echo "  ${BLUE}${final_url}${NC}"
echo ""

if copy_to_clipboard "$final_url"; then
  echo "${GREEN}✓ URL copied to clipboard${NC}"
else
  if ask_yn "${BOLD}Copy URL to clipboard?${NC}" "n"; then
    echo "${YELLOW}⚠  No clipboard tool found${NC}"
    echo "   Install: ${CYAN}sudo apt install xclip${NC} (Linux)"
    echo "   Or manually copy URL above"
  fi
fi
```

---

### Priority 3: Nice-to-Have Features 🎨

#### Issue #7: No Batch/Quiet Mode
**Severity:** VERY LOW  
**Current:** Script is always interactive (except with `-y` flag)  
**Problem:**
- Cannot be used in automation/scripts easily
- Always requires terminal interaction
- No way to suppress output for piping

**Impact:** Limited scriptability  
**Users Affected:** Power users, automation scripts

**Fix:**
```bash
# Add new flags
QUIET_MODE=0
OUTPUT_FORMAT="terminal"  # terminal, json, url-only

# In usage():
  --quiet              Minimal output, no prompts
  --format FORMAT      Output format: terminal, json, url-only
  --output-dir DIR     Save QR codes to DIR (default: .qr-codes)

# In argument parsing:
    --quiet) QUIET_MODE=1; AUTO_YES=1; shift ;;
    --format) OUTPUT_FORMAT="$2"; shift 2 ;;
    --output-dir) QR_OUTPUT_DIR="$2"; shift 2 ;;

# Conditional output:
log() {
  [ "$QUIET_MODE" = "0" ] && echo "$@"
}

# JSON output mode:
if [ "$OUTPUT_FORMAT" = "json" ]; then
  cat <<EOF
{
  "local": {
    "url": "http://${display_host}:${host_port}/",
    "lan_url": "http://${lan_ip}:${host_port}/",
    "qr_file": "${QR_OUTPUT_DIR}/dashboard-local.png"
  },
  "remote": {
    "url": "${dashboard_url}",
    "user_id": "${public_id}",
    "qr_file": "${QR_OUTPUT_DIR}/dashboard-${public_id}.png"
  }
}
EOF
  exit 0
fi

# URL-only mode:
if [ "$OUTPUT_FORMAT" = "url-only" ]; then
  [ "$SHOW_REMOTE" = "1" ] && echo "$dashboard_url"
  [ "$SHOW_LOCAL" = "1" ] && echo "http://${lan_ip}:${host_port}/"
  exit 0
fi
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
**Goal:** Fix bugs that cause crashes or incorrect behavior

1. ✅ Create test suite (`test-show-monitor-script.sh`)
2. Fix Issue #1 - Add jq check before URL encoding
3. Fix Issue #2 - Implement robust .env parsing
4. Fix Issue #3 - Better LAN IP detection with warnings
5. Run tests - ensure all critical tests pass
6. Update documentation

**Deliverables:**
- Working test suite
- Fixed script with no critical bugs
- Updated usage examples

**Time Estimate:** 2-3 hours

---

### Phase 2: UX Improvements (Week 2)
**Goal:** Improve user experience and reduce friction

1. Fix Issue #4 - Robust Docker port detection
2. Fix Issue #5 - QR files to dedicated directory
3. Fix Issue #6 - Clipboard copy functionality
4. Add progress indicators for slow operations
5. Improve error messages (more helpful)
6. Run full test suite

**Deliverables:**
- Better organized output files
- Clipboard integration
- Clearer error messages

**Time Estimate:** 3-4 hours

---

### Phase 3: Advanced Features (Week 3)
**Goal:** Add power-user features

1. Fix Issue #7 - Quiet/batch mode
2. Add JSON output format
3. Add URL-only output format
4. Add `--output-dir` flag
5. Add `--no-qr` flag (skip QR generation)
6. Comprehensive documentation update

**Deliverables:**
- Scriptable interface
- Multiple output formats
- Complete documentation

**Time Estimate:** 2-3 hours

---

## Testing Strategy

### Automated Tests
Run `./test-show-monitor-script.sh` before each phase:

**Test Coverage:**
- ✅ Test 1: jq availability and URL encoding
- ✅ Test 2: .env passphrase parsing (5 formats)
- ✅ Test 3: LAN IP detection validation
- ✅ Test 4: Docker port detection
- ✅ Test 5: QR code generation (terminal + PNG)
- ✅ Test 6: Cloudflare config reading
- ✅ Test 7: Default choice handling
- ✅ Test 8: Clipboard tool availability

### Manual Tests
**Scenario A: Local Dashboard**
1. No Docker running → Should show helpful error
2. Docker running, no .env → Should detect port automatically
3. Docker running, custom port in .env → Should use .env port
4. LAN IP detected → Should offer mobile QR
5. LAN IP fails → Should show warning, no QR

**Scenario B: Remote Dashboard**
1. Not registered → Should show registration instructions
2. Registered, no jq → Should show jq install instructions
3. Registered, jq installed, no passphrase embedding → Should show URL only
4. Registered, embed passphrase from .env → Should create QR with embedded pass
5. Registered, embed passphrase (manual entry) → Should prompt for passphrase

**Scenario C: Edge Cases**
1. Empty input → Should default to remote
2. Invalid input → Should re-prompt with helpful message
3. Passphrase with special chars → Should encode correctly
4. Multiple QR generations → Should save to .qr-codes/ directory
5. Clipboard copy → Should work or show helpful install message

---

## Migration Path

### Backward Compatibility
**Guaranteed:**
- All existing flags work identically
- Default behavior unchanged (interactive mode)
- Output format unchanged (unless --format specified)
- QR files can still be found (just in subdirectory)

**Changes Users Will Notice:**
- QR files now in `.qr-codes/` instead of project root
- More helpful error messages
- Clipboard copy offered automatically
- LAN IP detection shows warnings when failing

### Upgrade Instructions for Users
```bash
# 1. Pull latest version
git pull

# 2. Run tests (optional)
./test-show-monitor-script.sh

# 3. Use as normal - script will auto-migrate
./scripts/show_monitor_url_and_qr.sh

# 4. Old QR files can be cleaned up:
rm -f dashboard-*.png  # (now in .qr-codes/)
```

---

## New Features Summary

### For End Users
- ✅ More reliable passphrase handling
- ✅ Better error messages with solutions
- ✅ QR files organized in dedicated directory
- ✅ One-click URL copy to clipboard
- ✅ Clearer warnings when features unavailable

### For Power Users / Automation
- ✅ Quiet mode for scripts
- ✅ JSON output format
- ✅ URL-only output format
- ✅ Custom QR output directory
- ✅ Skip QR generation option

### For Developers
- ✅ Comprehensive test suite
- ✅ Modular helper functions
- ✅ Better code organization
- ✅ Detailed error codes
- ✅ Documented testing strategy

---

## File Changes

### New Files
- `test-show-monitor-script.sh` - Automated test suite
- `.qr-codes/` - Directory for QR code PNGs
- `.gitignore` - Updated to ignore .qr-codes/

### Modified Files
- `scripts/show_monitor_url_and_qr.sh` - All fixes and improvements
- `README.md` - Updated usage examples and troubleshooting

### Deprecated Files
- None (backward compatible)

---

## Risk Assessment

### Low Risk Changes
- jq availability check (prevents crash)
- Better .env parsing (more robust)
- QR file location (backward compatible)
- Clipboard copy (optional feature)

### Medium Risk Changes
- LAN IP detection changes (could affect QR generation)
- Docker port detection (could show wrong port if logic fails)

### Mitigation
- Comprehensive test suite catches regressions
- Fallback behavior preserves existing functionality
- Error messages guide users to solutions
- Backward compatibility maintained

---

## Success Metrics

### Phase 1 (Critical Fixes)
- ✅ All 8 tests pass
- ✅ No crashes on missing dependencies
- ✅ Passphrases parse correctly in all tested formats
- ✅ LAN IP warnings show when detection fails

### Phase 2 (UX Improvements)
- ✅ QR files organized in subdirectory
- ✅ Clipboard copy works on Linux/macOS/WSL
- ✅ Port detection accurate in 95%+ cases
- ✅ Users report improved error messages

### Phase 3 (Advanced Features)
- ✅ Quiet mode usable in scripts
- ✅ JSON output parseable by external tools
- ✅ Documentation complete with examples

---

## Conclusion

This upgrade transforms `show_monitor_url_and_qr.sh` from a functional but fragile script into a robust, user-friendly tool suitable for both interactive use and automation. The phased approach ensures stability while delivering value incrementally.

**Estimated Total Time:** 7-10 hours  
**Primary Benefits:**
- No more crashes from missing dependencies
- Better error messages with solutions
- Organized file output
- Clipboard integration
- Scriptable interface

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Run test suite after each phase
4. Deploy and monitor user feedback
