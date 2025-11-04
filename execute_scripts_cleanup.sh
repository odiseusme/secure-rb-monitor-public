#!/bin/bash
set -euo pipefail

echo "🧹 Scripts Folder Cleanup - Execution Plan"
echo "=========================================="
echo ""

# Answers confirmed:
# 1. Clutter bag: ~/projects/Monitor Junk
# 2. monitor_control.sh: KEEP (useful operational tool, heavily documented)
# 3. Create tests/ directory: YES

CLUTTER_BAG="$HOME/projects/Monitor Junk"

echo "✅ Confirmed decisions:"
echo "  - Clutter bag location: $CLUTTER_BAG"
echo "  - monitor_control.sh: KEEP (operational tool)"
echo "  - Create tests/ directory: YES"
echo ""

# Verify clutter bag exists
if [ ! -d "$CLUTTER_BAG" ]; then
    echo "❌ ERROR: Clutter bag not found: $CLUTTER_BAG"
    exit 1
fi

echo "📋 Cleanup actions:"
echo ""

# 1. Delete junk files
echo "1️⃣  Deleting junk files..."
if [ -f "scripts/.prepare_build.sh.swp" ]; then
    rm -f scripts/.prepare_build.sh.swp
    echo "   ✓ Deleted: scripts/.prepare_build.sh.swp"
else
    echo "   - Already gone: scripts/.prepare_build.sh.swp"
fi

if [ -d "scripts/.run" ]; then
    rm -rf scripts/.run
    echo "   ✓ Deleted: scripts/.run/"
else
    echo "   - Already gone: scripts/.run/"
fi

echo ""

# 2. Move legacy scripts to clutter bag
echo "2️⃣  Moving legacy scripts to Monitor Junk..."
if [ -f "scripts/register-with-qr.sh" ]; then
    mv scripts/register-with-qr.sh "$CLUTTER_BAG/"
    echo "   ✓ Moved: register-with-qr.sh → Monitor Junk/"
else
    echo "   - Already moved: register-with-qr.sh"
fi

if [ -f "scripts/show_monitor_url_and_qr.sh" ]; then
    mv scripts/show_monitor_url_and_qr.sh "$CLUTTER_BAG/"
    echo "   ✓ Moved: show_monitor_url_and_qr.sh → Monitor Junk/"
else
    echo "   - Already moved: show_monitor_url_and_qr.sh"
fi

echo ""

# 3. Create tests/ directory and move test script
echo "3️⃣  Creating tests/ directory..."
mkdir -p tests
echo "   ✓ Created: tests/"

if [ -f "scripts/test-log-hygiene.sh" ]; then
    mv scripts/test-log-hygiene.sh tests/
    echo "   ✓ Moved: test-log-hygiene.sh → tests/"
else
    echo "   - Already moved: test-log-hygiene.sh"
fi

echo ""

# 4. Update .gitignore
echo "4️⃣  Updating .gitignore..."
if ! grep -q "^\\.run/" .gitignore 2>/dev/null; then
    echo ".run/" >> .gitignore
    echo "   ✓ Added: .run/"
fi

if ! grep -q "^\*\\.swp$" .gitignore 2>/dev/null; then
    echo "*.swp" >> .gitignore
    echo "   ✓ Added: *.swp"
fi

echo "   ✓ .gitignore updated"
echo ""

# 5. Final verification
echo "5️⃣  Final verification..."
echo ""
echo "   Remaining in scripts/:"
ls -1 scripts/ | head -10
echo ""

echo "   Moved to Monitor Junk:"
ls -1 "$CLUTTER_BAG/" | grep -E "(register-with-qr|show_monitor)" || echo "   (files not found - may have been moved earlier)"
echo ""

echo "   Created tests/ directory:"
ls -1 tests/ 2>/dev/null || echo "   (empty)"
echo ""

echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   ✅ KEPT (3): register-user.sh, prepare_build.sh, generate-compact-qr.py"
echo "   ✅ KEPT (1): monitor_control.sh (operational tool)"
echo "   ⚠️  MOVED (2): register-with-qr.sh, show_monitor_url_and_qr.sh → Monitor Junk"
echo "   �� MOVED (1): test-log-hygiene.sh → tests/"
echo "   ❌ DELETED (2): .prepare_build.sh.swp, .run/"
echo ""
echo "Next: Update todo list, then proceed to clean registration test"
