#!/usr/bin/env bash
#
# Cleanup script for Rosen Bridge Monitor repository
# Moves non-essential files to archive and deletes redundant backups
#
# Usage: ./cleanup-repo.sh [--dry-run]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Archive directory
ARCHIVE_DIR="$HOME/projects/Monitor Junk/repo-cleanup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false

if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No files will be moved or deleted"
    echo ""
fi

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create archive directory
if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "$ARCHIVE_DIR"
    log_success "Created archive directory: $ARCHIVE_DIR"
else
    log_info "Would create: $ARCHIVE_DIR"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Repository Cleanup"
echo "════════════════════════════════════════════════════════════"
echo ""

#
# 1. DELETE BACKUP FILES
#
echo "📦 Step 1: Cleaning backup files..."
echo ""

BACKUP_FILES=(
    ".env.bak"
    ".env.bak.*"
    ".cloudflare-config.json.bak.*"
    "cloudflare-sync.js.bak"
    "package-lock.json.bak"
)

for pattern in "${BACKUP_FILES[@]}"; do
    files=$(find . -maxdepth 1 -name "$pattern" 2>/dev/null || true)
    if [[ -n "$files" ]]; then
        for file in $files; do
            if [[ "$DRY_RUN" == false ]]; then
                rm -f "$file"
                log_success "Deleted: $file"
            else
                log_info "Would delete: $file"
            fi
        done
    fi
done

echo ""

#
# 2. ARCHIVE ISSUE DOCUMENTATION
#
echo "📚 Step 2: Archiving issue documentation..."
echo ""

DOCS_TO_ARCHIVE=(
    "UBUNTU_TEST_ISSUES.md"
    "UBUNTU_TRIAL_FIXES.md"
    "UBUNTU_RETEST_INSTRUCTIONS.md"
    "MULTI_INSTANCE_SOLUTIONS.md"
)

for doc in "${DOCS_TO_ARCHIVE[@]}"; do
    if [[ -f "$doc" ]]; then
        if [[ "$DRY_RUN" == false ]]; then
            mv "$doc" "$ARCHIVE_DIR/"
            log_success "Archived: $doc → $ARCHIVE_DIR/"
        else
            log_info "Would archive: $doc → $ARCHIVE_DIR/"
        fi
    fi
done

echo ""

#
# 3. CLEAN OLD LOG FILES
#
echo "🗑️  Step 3: Cleaning old log files..."
echo ""

if [[ -f ".register-user.log" ]]; then
    if [[ "$DRY_RUN" == false ]]; then
        rm -f ".register-user.log"
        log_success "Deleted: .register-user.log"
    else
        log_info "Would delete: .register-user.log"
    fi
fi

# Archive logs directory if it has old files
if [[ -d "logs" ]]; then
    log_count=$(find logs -type f | wc -l)
    if [[ $log_count -gt 0 ]]; then
        if [[ "$DRY_RUN" == false ]]; then
            mkdir -p "$ARCHIVE_DIR/logs-backup"
            cp -r logs/* "$ARCHIVE_DIR/logs-backup/" 2>/dev/null || true
            # Keep directory but clear old logs
            find logs -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
            log_success "Archived old logs to: $ARCHIVE_DIR/logs-backup/"
        else
            log_info "Would archive logs to: $ARCHIVE_DIR/logs-backup/"
            log_info "Would delete logs older than 7 days"
        fi
    fi
fi

# Clean uploader logs older than 7 days
if [[ -d ".run" ]]; then
    if [[ "$DRY_RUN" == false ]]; then
        find .run -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
        log_success "Cleaned old .run/ logs"
    else
        log_info "Would clean old .run/ logs (>7 days)"
    fi
fi

echo ""

#
# 4. REMOVE GENERATED QR CODES
#
echo "🎨 Step 4: Cleaning generated QR codes..."
echo ""

qr_files=$(find . -maxdepth 1 -name "dashboard-*.png" 2>/dev/null || true)
if [[ -n "$qr_files" ]]; then
    for qr in $qr_files; do
        if [[ "$DRY_RUN" == false ]]; then
            rm -f "$qr"
            log_success "Deleted: $qr"
        else
            log_info "Would delete: $qr"
        fi
    done
else
    log_info "No QR code files found"
fi

echo ""

#
# 5. CLEAN OLD PID FILES
#
echo "🔧 Step 5: Cleaning stale PID files..."
echo ""

if [[ -d "logs" ]]; then
    pid_files=$(find logs -type f -name "*.pid" 2>/dev/null || true)
    if [[ -n "$pid_files" ]]; then
        for pid_file in $pid_files; do
            if [[ -f "$pid_file" ]]; then
                pid=$(cat "$pid_file" 2>/dev/null || echo "")
                if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
                    if [[ "$DRY_RUN" == false ]]; then
                        rm -f "$pid_file"
                        log_success "Deleted stale PID file: $pid_file"
                    else
                        log_info "Would delete stale PID file: $pid_file"
                    fi
                else
                    log_warning "Keeping active PID file: $pid_file"
                fi
            fi
        done
    fi
fi

echo ""

#
# 6. SUMMARY
#
echo "════════════════════════════════════════════════════════════"
echo "  Cleanup Summary"
echo "════════════════════════════════════════════════════════════"
echo ""

if [[ "$DRY_RUN" == false ]]; then
    log_success "Cleanup completed successfully!"
    echo ""
    log_info "Archive location: $ARCHIVE_DIR"
    echo ""
    log_info "To restore archived files:"
    echo "  cp -r \"$ARCHIVE_DIR\"/* ."
    echo ""
    log_info "Essential files preserved - see ESSENTIAL_FILES.md for details"
else
    echo "✓ Dry run completed - no changes made"
    echo ""
    log_info "Run without --dry-run to apply changes:"
    echo "  ./cleanup-repo.sh"
fi

echo ""
