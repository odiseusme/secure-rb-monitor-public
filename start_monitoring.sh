#!/bin/bash
#
# start-monitoring.sh - Smart wrapper for write_status.js
# 
# Validates configuration against running watchers before starting monitoring.
# Provides interactive options to handle mismatches.
#
# Usage:
#   ./start-monitoring.sh           # Interactive mode (10s timeout)
#   SKIP_CHECK=1 ./start-monitoring.sh  # Skip validation, start directly
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === PREFLIGHT CHECK ===
preflight_check() {
  echo -e "${BLUE}[PREFLIGHT]${NC} Validating configuration..."
  
  # Check if config.json exists
  if [ ! -f "config.json" ]; then
    echo -e "${RED}[ERROR]${NC} config.json not found."
    echo "Run: ./scripts/prepare_build.sh"
    exit 1
  fi
  
  # Get configured watchers
  CONFIGURED_WATCHERS=$(jq -r '.watchers[].name' config.json 2>/dev/null || echo "")
  
  if [ -z "$CONFIGURED_WATCHERS" ]; then
    echo -e "${RED}[ERROR]${NC} No watchers configured in config.json"
    echo "Run: ./scripts/prepare_build.sh"
    exit 1
  fi
  
  echo -e "${GREEN}[INFO]${NC} Configured watchers:"
  echo "$CONFIGURED_WATCHERS" | sed 's/^/  - /'
  echo ""
  
  # Discover running watchers
  RUNNING_WATCHERS=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -E "watcher.*-service-1$" || true)
  
  if [ -z "$RUNNING_WATCHERS" ]; then
    echo -e "${YELLOW}[WARNING]${NC} No running watchers detected via docker ps"
    echo "Either Docker is not available or no watchers are running."
    echo ""
    read -t 10 -p "Continue anyway? (y/N or wait 10s): " response || response="y"
    if [[ ! "$response" =~ ^[Yy]$ ]] && [ -n "$response" ]; then
      echo "Aborted."
      exit 1
    fi
    return 0
  fi
  
  echo -e "${GREEN}[INFO]${NC} Running watchers:"
  echo "$RUNNING_WATCHERS" | sed 's/^/  - /'
  echo ""
  
  # Find missing watchers (configured but not running)
  MISSING=""
  while IFS= read -r configured; do
    if ! echo "$RUNNING_WATCHERS" | grep -q "^${configured}$"; then
      MISSING="${MISSING}${configured}\n"
    fi
  done <<< "$CONFIGURED_WATCHERS"
  
  # Find extra watchers (running but not configured)
  EXTRA=""
  while IFS= read -r running; do
    if ! echo "$CONFIGURED_WATCHERS" | grep -q "^${running}$"; then
      EXTRA="${EXTRA}${running}\n"
    fi
  done <<< "$RUNNING_WATCHERS"
  
  # Handle missing watchers
  if [ -n "$MISSING" ]; then
    echo -e "${YELLOW}[WARNING]${NC} Configured watchers NOT running:"
    echo -e "$MISSING" | grep -v '^$' | sed 's/^/  - /'
    echo ""
    echo "Options:"
    echo "  1) Start missing watchers and retry"
    echo "  2) Update config (remove missing watchers)"
    echo "  3) Continue anyway (will show as offline)"
    echo ""
    
    read -t 10 -p "Enter choice (1/2/3 or wait 10s to continue): " choice || choice="3"
    echo ""
    
    case "$choice" in
      1)
        echo -e "${BLUE}[INFO]${NC} Please start the missing watchers:"
        echo -e "$MISSING" | grep -v '^$' | sed 's/^/  docker compose up -d /'
        echo ""
        echo "Then re-run: $0"
        exit 0
        ;;
      2)
        echo -e "${BLUE}[INFO]${NC} Regenerating configuration..."
        if [ -x "./scripts/prepare_build.sh" ]; then
          ./scripts/prepare_build.sh
          echo -e "${GREEN}[INFO]${NC} Configuration updated. Continuing..."
        else
          echo -e "${RED}[ERROR]${NC} ./scripts/prepare_build.sh not found or not executable"
          exit 1
        fi
        ;;
      3|"")
        echo -e "${YELLOW}[INFO]${NC} Continuing with current config (missing watchers will show as offline)"
        ;;
      *)
        echo -e "${YELLOW}[INFO]${NC} Invalid choice. Continuing with current config..."
        ;;
    esac
  fi
  
  # Handle extra watchers
  if [ -n "$EXTRA" ]; then
    echo -e "${BLUE}[INFO]${NC} New watchers detected (not in config):"
    echo -e "$EXTRA" | grep -v '^$' | sed 's/^/  - /'
    echo ""
    echo "To add them to monitoring, run: ./scripts/prepare_build.sh"
    echo ""
  fi
  
  echo -e "${GREEN}[PREFLIGHT]${NC} ✓ Validation complete"
  echo ""
}

# === MAIN ===
main() {
  # Skip check if requested
  if [ -n "$SKIP_CHECK" ]; then
    echo -e "${YELLOW}[INFO]${NC} Skipping preflight check (SKIP_CHECK set)"
  else
    preflight_check
  fi
  
  # Start monitoring
  echo -e "${GREEN}[START]${NC} Starting write_status.js..."
  echo ""
  
  # Check if we're in Docker or running natively
  if [ -f "/.dockerenv" ]; then
    # Running in Docker - use exec to replace shell with node process
    exec node write_status.js
  else
    # Running natively - just execute
    node write_status.js
  fi
}

# Run main
main
