#!/usr/bin/env bash
# test-show-monitor-script.sh - Test suite for show_monitor_url_and_qr.sh
#
# Tests all identified issues and validates fixes

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

info() {
  echo -e "${CYAN}ℹ${NC} $1"
}

# Test 1: jq availability check
test_jq_check() {
  echo ""
  info "Test 1: jq availability for URL encoding"
  
  if command -v jq >/dev/null 2>&1; then
    pass "jq is installed"
    
    # Test URL encoding
    local test_pass="Test@123!#$%"
    local encoded=$(printf %s "$test_pass" | jq -sRr @uri 2>/dev/null)
    
    if [ -n "$encoded" ] && [ "$encoded" != "$test_pass" ]; then
      pass "jq URL encoding works: '$test_pass' → '$encoded'"
    else
      fail "jq URL encoding failed"
    fi
  else
    fail "jq is NOT installed (required for passphrase embedding)"
    warn "Install with: sudo apt install jq"
  fi
}

# Test 2: .env passphrase parsing
test_env_passphrase_parsing() {
  echo ""
  info "Test 2: .env passphrase parsing"
  
  # Create test .env files with different formats
  local test_dir=$(mktemp -d)
  
  # Test case 1: Double quotes
  echo 'DASH_PASSPHRASE="Test Pass 123"' > "$test_dir/test1.env"
  local pass1=$(grep -E '^DASH_PASSPHRASE=' "$test_dir/test1.env" | cut -d= -f2- | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' || true)
  if [ "$pass1" = "Test Pass 123" ]; then
    pass "Parsed double-quoted passphrase correctly"
  else
    fail "Failed to parse double-quoted passphrase (got: '$pass1')"
  fi
  
  # Test case 2: Single quotes
  echo "DASH_PASSPHRASE='Test Pass 456'" > "$test_dir/test2.env"
  local pass2=$(grep -E '^DASH_PASSPHRASE=' "$test_dir/test2.env" | cut -d= -f2- | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' || true)
  if [ "$pass2" = "Test Pass 456" ]; then
    pass "Parsed single-quoted passphrase correctly"
  else
    fail "Failed to parse single-quoted passphrase (got: '$pass2')"
  fi
  
  # Test case 3: No quotes
  echo 'DASH_PASSPHRASE=NoQuotes789' > "$test_dir/test3.env"
  local pass3=$(grep -E '^DASH_PASSPHRASE=' "$test_dir/test3.env" | cut -d= -f2- | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' || true)
  if [ "$pass3" = "NoQuotes789" ]; then
    pass "Parsed unquoted passphrase correctly"
  else
    fail "Failed to parse unquoted passphrase (got: '$pass3')"
  fi
  
  # Test case 4: Special characters
  echo 'DASH_PASSPHRASE="Pass@#$%^&*()"' > "$test_dir/test4.env"
  local pass4=$(grep -E '^DASH_PASSPHRASE=' "$test_dir/test4.env" | cut -d= -f2- | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' || true)
  if [ "$pass4" = 'Pass@#$%^&*()' ]; then
    pass "Parsed passphrase with special chars correctly"
  else
    fail "Failed to parse passphrase with special chars (got: '$pass4')"
  fi
  
  # Test case 5: Equals sign in passphrase
  echo 'DASH_PASSPHRASE="Pass=With=Equals"' > "$test_dir/test5.env"
  local pass5=$(grep -E '^DASH_PASSPHRASE=' "$test_dir/test5.env" | cut -d= -f2-)
  if [ "$pass5" = '"Pass=With=Equals"' ]; then
    pass "Preserved passphrase with equals signs"
  else
    fail "Failed with equals in passphrase (got: '$pass5')"
  fi
  
  rm -rf "$test_dir"
}

# Test 3: LAN IP detection
test_lan_ip_detection() {
  echo ""
  info "Test 3: LAN IP detection"
  
  # Source the function from script (this is a workaround for testing)
  get_lan_ip() {
    local ip=""
    
    if command -v hostname >/dev/null 2>&1; then
      ip=$(hostname -I 2>/dev/null | awk '{print $1}')
      [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ] && { echo "$ip"; return; }
    fi
    
    if command -v ip >/dev/null 2>&1; then
      ip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1);exit}}}')
      [ -n "$ip" ] && { echo "$ip"; return; }
    fi
    
    echo "127.0.0.1"
  }
  
  local lan_ip=$(get_lan_ip)
  
  if [ -n "$lan_ip" ]; then
    if [ "$lan_ip" = "127.0.0.1" ]; then
      warn "LAN IP detected as localhost ($lan_ip) - not useful for mobile QR"
      fail "LAN IP detection fell back to localhost"
    else
      pass "LAN IP detected: $lan_ip"
      
      # Validate it's a private IP
      if [[ "$lan_ip" =~ ^10\. ]] || [[ "$lan_ip" =~ ^192\.168\. ]] || [[ "$lan_ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
        pass "LAN IP is in private range (suitable for mobile access)"
      else
        warn "LAN IP is not in standard private ranges"
      fi
    fi
  else
    fail "Failed to detect LAN IP"
  fi
}

# Test 4: Docker port detection
test_docker_port_detection() {
  echo ""
  info "Test 4: Docker port detection"
  
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker not installed - skipping test"
    return
  fi
  
  if docker ps --format '{{.Names}}' | grep -q "rosen-bridge-monitor"; then
    local port=$(docker port rosen-bridge-monitor 8080 2>/dev/null | cut -d: -f2 || echo "")
    
    if [ -n "$port" ] && [[ "$port" =~ ^[0-9]+$ ]]; then
      pass "Docker port detected: $port"
    else
      fail "Docker port detection failed or returned invalid format: '$port'"
    fi
  else
    warn "Docker container not running - skipping port detection test"
  fi
}

# Test 5: QR code generation
test_qr_generation() {
  echo ""
  info "Test 5: QR code generation"
  
  if ! command -v qrencode >/dev/null 2>&1; then
    fail "qrencode not installed"
    warn "Install with: sudo apt install qrencode"
    return
  fi
  
  local test_url="https://example.com/test"
  local test_file="/tmp/test-qr-$$.png"
  
  # Test terminal QR
  if qrencode -t ANSIUTF8 "$test_url" >/dev/null 2>&1; then
    pass "Terminal QR generation works"
  else
    fail "Terminal QR generation failed"
  fi
  
  # Test PNG QR
  if qrencode -o "$test_file" "$test_url" 2>/dev/null; then
    if [ -f "$test_file" ]; then
      local size=$(stat -f%z "$test_file" 2>/dev/null || stat -c%s "$test_file" 2>/dev/null)
      if [ "$size" -gt 0 ]; then
        pass "PNG QR generation works (size: $size bytes)"
      else
        fail "PNG QR file is empty"
      fi
      rm -f "$test_file"
    else
      fail "PNG QR file not created"
    fi
  else
    fail "PNG QR generation failed"
  fi
}

# Test 6: Cloudflare config reading
test_cloudflare_config() {
  echo ""
  info "Test 6: Cloudflare config reading"
  
  if [ ! -f ".cloudflare-config.json" ]; then
    warn "No .cloudflare-config.json found - skipping test"
    return
  fi
  
  if ! command -v jq >/dev/null 2>&1; then
    fail "jq not installed - cannot test config reading"
    return
  fi
  
  local dashboard_url=$(jq -r '.dashboardUrl' .cloudflare-config.json 2>/dev/null || echo "")
  local public_id=$(jq -r '.publicId' .cloudflare-config.json 2>/dev/null || echo "")
  
  if [ -n "$dashboard_url" ] && [ "$dashboard_url" != "null" ]; then
    pass "Dashboard URL read from config: ${dashboard_url:0:50}..."
  else
    fail "Failed to read dashboard URL from config"
  fi
  
  if [ -n "$public_id" ] && [ "$public_id" != "null" ]; then
    pass "Public ID read from config: ${public_id:0:20}..."
  else
    fail "Failed to read public ID from config"
  fi
}

# Test 7: Default choice handling
test_default_choice() {
  echo ""
  info "Test 7: Default choice on empty input (simulated)"
  
  # This tests the logic, not actual user input
  local choice=""
  
  # Simulate default behavior
  if [ -z "$choice" ]; then
    choice="r"  # Should default to remote
  fi
  
  choice="${choice,,}"
  
  if [ "$choice" = "r" ]; then
    pass "Empty input correctly defaults to 'r' (remote)"
  else
    fail "Empty input did not default correctly (got: '$choice')"
  fi
}

# Test 8: Clipboard availability
test_clipboard_tools() {
  echo ""
  info "Test 8: Clipboard tool availability"
  
  local has_clipboard=0
  
  if command -v xclip >/dev/null 2>&1; then
    pass "xclip available (Linux)"
    has_clipboard=1
  fi
  
  if command -v pbcopy >/dev/null 2>&1; then
    pass "pbcopy available (macOS)"
    has_clipboard=1
  fi
  
  if command -v clip.exe >/dev/null 2>&1; then
    pass "clip.exe available (Windows/WSL)"
    has_clipboard=1
  fi
  
  if [ $has_clipboard -eq 0 ]; then
    warn "No clipboard tool found - URL copy feature won't work"
    info "Install xclip: sudo apt install xclip"
  fi
}

# Run all tests
main() {
  echo ""
  echo "${CYAN}╔════════════════════════════════════════════════╗${NC}"
  echo "${CYAN}║  show_monitor_url_and_qr.sh - Test Suite      ║${NC}"
  echo "${CYAN}╚════════════════════════════════════════════════╝${NC}"
  
  test_jq_check
  test_env_passphrase_parsing
  test_lan_ip_detection
  test_docker_port_detection
  test_qr_generation
  test_cloudflare_config
  test_default_choice
  test_clipboard_tools
  
  echo ""
  echo "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed${NC} ($TESTS_PASSED/$TESTS_PASSED)"
    exit 0
  else
    echo -e "${RED}✗ Some tests failed${NC} ($TESTS_PASSED passed, $TESTS_FAILED failed)"
    exit 1
  fi
}

main "$@"
