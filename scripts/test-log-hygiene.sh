#!/bin/bash
set -euo pipefail

# Simple but effective credential leak scanner for RBMonitor
# Scans scripts and logs for potential credential exposure

echo "🔍 Scanning for credential leaks in RBMonitor..."
echo "=================================================="

FAILED=0
# Focus on the most critical patterns that indicate actual credential leaks
SCAN_PATTERNS=(
  "console\.log.*token"
  "console\.log.*pass.*="
  "console\.log.*secret"
  "echo.*\$DASH_PASSPHRASE[^=]"
  "echo.*\$.*TOKEN[^=]"
  "echo.*\$.*SECRET[^=]"
  "cat \.env"
  "cat.*cloudflare-config\.json"
  "PASSWORD="
  "API_KEY="
)

SCAN_DIRS=(
  "scripts/"
  "worker/mute-mouse-2cd2/src/"
)

# Exclude patterns (legitimate uses)
EXCLUDE_PATTERNS=(
  "test-log-hygiene"
  "backup"
  "\.bak"
  "\.md"
  "\.git"
  "node_modules"
  "Example"
  "Test"
  "redact"
  "sed -i"
  "jq -er"
  "echo.*DASH_PASSPHRASE.*>>"
  "WRITE_TOKEN=\$WRITE_TOKEN"
  "PASSPHRASE=\"\""
  "shift 2"
)

echo "Scanning directories: ${SCAN_DIRS[*]}"
echo "Looking for patterns: ${#SCAN_PATTERNS[@]} credential leak patterns"
echo ""

for pattern in "${SCAN_PATTERNS[@]}"; do
  echo -n "Checking pattern: $pattern ... "
  
  # Scan for the pattern
  results=$(grep -r --line-number -E "$pattern" "${SCAN_DIRS[@]}" 2>/dev/null || true)
  
  if [ -n "$results" ]; then
    # Filter out excluded patterns
    filtered_results=""
    while IFS= read -r line; do
      exclude_match=false
      for exclude in "${EXCLUDE_PATTERNS[@]}"; do
        if echo "$line" | grep -q "$exclude"; then
          exclude_match=true
          break
        fi
      done
      
      if [ "$exclude_match" = false ]; then
        filtered_results="$filtered_results$line\n"
      fi
    done <<< "$results"
    
    if [ -n "$filtered_results" ] && [ "$filtered_results" != "\n" ]; then
      echo "❌ FOUND"
      echo -e "$filtered_results"
      FAILED=1
    else
      echo "✅ clean (excluded patterns filtered)"
    fi
  else
    echo "✅ clean"
  fi
done

echo ""
echo "==================== SUMMARY ===================="

if [ $FAILED -eq 0 ]; then
  echo "✅ No credential leaks detected"
  echo "✅ All patterns passed security scan"
  exit 0
else
  echo "❌ Potential credential leaks found above"
  echo "❌ Please review and fix the findings"
  echo ""
  echo "💡 Common fixes:"
  echo "   - Replace console.log with safe logging"
  echo "   - Use environment variables instead of hardcoded secrets"
  echo "   - Redact sensitive values in output"
  exit 1
fi