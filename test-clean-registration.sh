#!/bin/bash
set -euo pipefail

echo "🧪 Clean Registration Test - v1.2.1"
echo "===================================="
echo ""
echo "This test will:"
echo "  1. Backup current .env and .cloudflare-config.json"
echo "  2. Run dry-run to validate dependencies"
echo "  3. Check for common issues (Docker, permissions, etc.)"
echo "  4. Report results"
echo ""

# Backup existing config
BACKUP_DIR=".test-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/.env"
    echo "✓ Backed up .env to $BACKUP_DIR/"
fi

if [ -f ".cloudflare-config.json" ]; then
    cp .cloudflare-config.json "$BACKUP_DIR/.cloudflare-config.json"
    echo "✓ Backed up .cloudflare-config.json to $BACKUP_DIR/"
fi

echo ""
echo "📋 Pre-flight checks:"
echo ""

# Check Docker
echo -n "  Docker: "
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "✅ Available and running"
else
    echo "❌ Not available or not running"
    echo "     Please start Docker before registration"
    exit 1
fi

# Check Python/QR
echo -n "  Python 3: "
if command -v python3 >/dev/null 2>&1; then
    echo "✅ $(python3 --version)"
else
    echo "⚠️  Not found (QR codes will be limited)"
fi

echo -n "  python3-qrcode: "
if python3 -c "import qrcode" 2>/dev/null; then
    echo "✅ Installed"
else
    echo "⚠️  Not installed (will use fallback QR)"
fi

# Check Node/jq
echo -n "  Node.js: "
if command -v node >/dev/null 2>&1; then
    echo "✅ $(node --version)"
else
    echo "❌ Not found (required)"
    exit 1
fi

echo -n "  jq: "
if command -v jq >/dev/null 2>&1; then
    echo "✅ $(jq --version)"
else
    echo "❌ Not found (required)"
    exit 1
fi

echo ""
echo "🔍 Running dry-run test..."
echo ""

# Run dry-run
./scripts/register-user.sh --dry-run

echo ""
echo "✅ Dry-run completed successfully!"
echo ""
echo "📝 Notes:"
echo "  - Backup saved to: $BACKUP_DIR/"
echo "  - To restore: cp $BACKUP_DIR/.env . && cp $BACKUP_DIR/.cloudflare-config.json ."
echo "  - Dry-run validates dependencies but doesn't make changes"
echo ""
echo "🎯 Next step: Run actual registration with invite code"
echo "     ./scripts/register-user.sh"
echo ""

