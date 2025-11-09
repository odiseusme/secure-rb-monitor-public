#!/bin/bash
# Quick upgrade script for Ubuntu PC with old monitor

set -euo pipefail

echo "🔄 Upgrade to v1.2.1 - Quick Steps"
echo "===================================="
echo ""

# Step 1: Backup
echo "📦 Step 1: Backing up current config..."
if [ -f "config.json" ]; then
    cp config.json ~/monitor-config-backup-$(date +%Y%m%d).json
    echo "✓ Backed up config.json to ~/monitor-config-backup-$(date +%Y%m%d).json"
    echo ""
    echo "Current watchers:"
    cat config.json | jq -r '.watchers[]?.url // empty' 2>/dev/null || cat config.json
    echo ""
else
    echo "⚠️  No config.json found (that's OK for fresh install)"
    echo ""
fi

if [ -f ".env" ]; then
    cp .env ~/monitor-env-backup-$(date +%Y%m%d).txt
    echo "✓ Backed up .env"
    echo ""
fi

# Step 2: Stop old monitor
echo "🛑 Step 2: Stopping old monitor..."
if docker ps | grep -q rosen-bridge-monitor; then
    docker compose down
    echo "✓ Old monitor stopped"
else
    echo "⚠️  Monitor not running (that's OK)"
fi
echo ""

# Step 3: Pull latest
echo "📥 Step 3: Pulling v1.2.1..."
git fetch origin

# Handle divergent branches if present
if ! git pull origin main 2>&1; then
    echo "⚠️  Divergent branches detected - using reset method..."
    git reset --hard origin/main
    git clean -fd
    echo "✓ Repository reset to origin/main"
fi

# CRITICAL: Restore executable permissions (git reset removes them)
echo "🔧 Restoring executable permissions..."
chmod +x scripts/*.sh scripts/*.py 2>/dev/null || true
echo "✓ Updated to latest version"
echo ""

# Step 4: Show what changed
echo "📋 Step 4: Recent changes:"
git log --oneline -5
echo ""

# Step 5: Ready for registration
echo "✅ Ready for registration!"
echo ""
echo "Next steps:"
echo "  1. Get invite code from Cloudflare Worker admin"
echo "  2. Run: ./scripts/register-user.sh"
echo "  3. If you had watchers, restore config.json from backup"
echo "  4. Build and start: docker compose up -d --build"
echo ""
echo "📖 For detailed guide, see: UPGRADE_FROM_OLD_VERSION.md"
echo ""

