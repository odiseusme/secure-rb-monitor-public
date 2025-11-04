#!/usr/bin/env bash
# Stop all monitoring services
set -euo pipefail

echo "🛑 Stopping All Monitoring Services"
echo "===================================="
echo ""

# Stop Docker containers
echo "1️⃣ Docker Containers:"
if docker compose ps 2>/dev/null | grep -q "Up"; then
  docker compose down
  echo "  ✓ Stopped Docker containers"
else
  echo "  ℹ No Docker containers running"
fi
echo ""

# Stop uploader
echo "2️⃣ Cloud Sync Uploader:"
uploader_pid=$(pgrep -f "cloudflare-sync.js" || echo "")
if [ -n "$uploader_pid" ]; then
  kill $uploader_pid 2>/dev/null || kill -9 $uploader_pid 2>/dev/null || true
  sleep 2
  echo "  ✓ Stopped uploader (PID: $uploader_pid)"
else
  echo "  ℹ No uploader running"
fi

# Clean up PID files
if [ -d ".run" ]; then
  rm -rf .run
  echo "  ✓ Cleaned .run/ directory"
fi
echo ""

# Clear logs (optional - keep for debugging)
echo "3️⃣ Logs & State Files:"
if [ -f "nohup.out" ]; then
  mv nohup.out nohup.out.old
  echo "  ✓ Archived nohup.out → nohup.out.old"
fi

if [ -f ".last-sync-hash" ]; then
  rm -f .last-sync-hash
  echo "  ✓ Cleared .last-sync-hash"
fi

if [ -f ".cf-sync-state.json" ]; then
  rm -f .cf-sync-state.json
  echo "  ✓ Cleared .cf-sync-state.json"
fi

if [ -f ".register-user.log" ]; then
  mv .register-user.log .register-user.log.old
  echo "  ✓ Archived .register-user.log → .register-user.log.old"
fi
echo ""

echo "✅ All services stopped - clean slate ready!"
echo ""
echo "📋 To start fresh registration:"
echo "   ./scripts/register-user.sh"
