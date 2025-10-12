#!/bin/bash
#
# register-user.sh - Unified user registration helper
#
# Handles the complete registration flow:
# 1. Admin creates invitation code
# 2. User registers with invitation
# 3. Displays instructions for starting monitoring
#
# Usage:
#   ./scripts/register-user.sh                    # Interactive mode
#   ADMIN_MODE=1 ./scripts/register-user.sh       # Admin creates invitation only
#   INVITE_CODE=XXX ./scripts/register-user.sh    # Register with existing invitation
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEFAULT_BASE_URL="http://localhost:38472"
BASE_URL="${BASE_URL:-$DEFAULT_BASE_URL}"
CONFIG_FILE=".cloudflare-config.json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Rosen Bridge Monitor Registration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if worker is running
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}[ERROR]${NC} Worker not responding at $BASE_URL"
  echo ""
  echo "Start the worker first:"
  echo "  cd worker/mute-mouse-2cd2"
  echo "  npm exec wrangler -- dev --port 38472 --local"
  exit 1
fi

# Check for existing configuration
if [ -f "$CONFIG_FILE" ]; then
  EXISTING_PUBLIC_ID=$(jq -r '.publicId' "$CONFIG_FILE" 2>/dev/null || echo "unknown")
  EXISTING_DASHBOARD=$(jq -r '.dashboardUrl' "$CONFIG_FILE" 2>/dev/null || echo "unknown")
  
  echo -e "${YELLOW}[INFO]${NC} Found existing user configuration"
  echo ""
  echo "Existing User ID: $EXISTING_PUBLIC_ID"
  echo "Dashboard URL: $EXISTING_DASHBOARD"
  echo ""
  echo "What would you like to do?"
  echo "  1) Use existing user (show credentials)"
  echo "  2) Register NEW user (creates fresh credentials)"
  echo ""
  read -p "Choice (1/2): " user_choice
  echo ""
  
  if [ "$user_choice" = "1" ]; then
    # Show existing credentials
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Existing User Credentials${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    PUBLIC_ID=$(jq -r '.publicId' "$CONFIG_FILE")
    WRITE_TOKEN=$(jq -r '.writeToken' "$CONFIG_FILE")
    SALT=$(jq -r '.salt' "$CONFIG_FILE")
    DASHBOARD_URL=$(jq -r '.dashboardUrl' "$CONFIG_FILE")
    
    echo -e "${BLUE}Dashboard URL:${NC}"
    echo "  $DASHBOARD_URL"
    echo ""
    echo -e "${BLUE}User ID:${NC} $PUBLIC_ID"
    echo ""
    echo -e "${BLUE}To start monitoring:${NC}"
    echo ""
    echo -e "${YELLOW}BASE_URL=$BASE_URL \\"
    echo "WRITE_TOKEN=$WRITE_TOKEN \\"
    echo "DASH_PASSPHRASE=<your-passphrase> \\"
    echo "DASH_SALT_B64=$SALT \\"
    echo -e "node cloudflare-sync.js${NC}"
    echo ""
    echo -e "${GREEN}✅ Credentials displayed${NC}"
    exit 0
  fi
  
  # User chose option 2 - register new user
  REGISTER_NEW_USER=true
else
  # No existing config
  REGISTER_NEW_USER=true
fi

# Step 1: Create or get invitation code
if [ -n "$INVITE_CODE" ]; then
  echo -e "${GREEN}[INFO]${NC} Using provided invitation code: $INVITE_CODE"
  INVITATION_CODE="$INVITE_CODE"
elif [ "$ADMIN_MODE" = "1" ]; then
  # Admin mode - create invitation and exit
  echo -e "${BLUE}[ADMIN]${NC} Creating invitation code..."
  
  # Check for .dev.vars to get admin key
  if [ -f "worker/mute-mouse-2cd2/.dev.vars" ]; then
    ADMIN_KEY=$(grep ADMIN_API_KEY worker/mute-mouse-2cd2/.dev.vars | cut -d'=' -f2)
  else
    read -p "Enter admin API key: " ADMIN_KEY
  fi
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/create-invite" \
    -H "x-admin-key: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{"count": 1, "expiresInDays": 30}')
  
  if echo "$RESPONSE" | grep -q "success"; then
    INVITATION_CODE=$(echo "$RESPONSE" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo -e "${GREEN}✅ Invitation created successfully!${NC}"
    echo ""
    echo "Invitation Code: $INVITATION_CODE"
    echo "Expires: 30 days"
    echo ""
    echo "Share this code with the user for registration."
    exit 0
  else
    echo -e "${RED}[ERROR]${NC} Failed to create invitation:"
    echo "$RESPONSE"
    exit 1
  fi
else
  # Interactive mode - create invitation
  echo -e "${BLUE}[STEP 1/3]${NC} Creating invitation code..."
  echo ""
  
  # Check for .dev.vars to get admin key
  if [ -f "worker/mute-mouse-2cd2/.dev.vars" ]; then
    ADMIN_KEY=$(grep ADMIN_API_KEY worker/mute-mouse-2cd2/.dev.vars | cut -d'=' -f2)
    echo -e "${GREEN}[INFO]${NC} Using admin key from .dev.vars"
  else
    read -p "Enter admin API key: " ADMIN_KEY
  fi
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/create-invite" \
    -H "x-admin-key: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{"count": 1, "expiresInDays": 30}')
  
  if echo "$RESPONSE" | grep -q "success"; then
    INVITATION_CODE=$(echo "$RESPONSE" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Invitation created: $INVITATION_CODE${NC}"
    echo ""
  else
    echo -e "${RED}[ERROR]${NC} Failed to create invitation:"
    echo "$RESPONSE"
    exit 1
  fi
fi

# Step 2: Register user
echo -e "${BLUE}[STEP 2/3]${NC} Registering new user..."
echo ""

# Auto-answer the setup script prompts
if [ "$REGISTER_NEW_USER" = true ]; then
  # Registering new user - answer 'y' to create new registration
  BASE_URL="$BASE_URL" node setup-cloudflare.js <<EOF
y
$INVITATION_CODE
EOF
else
  # First time registration
  BASE_URL="$BASE_URL" node setup-cloudflare.js <<EOF
$INVITATION_CODE
EOF
fi

# Check if registration succeeded
if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}[ERROR]${NC} Registration failed - config file not created"
  exit 1
fi

# Extract credentials
PUBLIC_ID=$(jq -r '.publicId' "$CONFIG_FILE")
WRITE_TOKEN=$(jq -r '.writeToken' "$CONFIG_FILE")
SALT=$(jq -r '.salt' "$CONFIG_FILE")
DASHBOARD_URL=$(jq -r '.dashboardUrl' "$CONFIG_FILE")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Registration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Dashboard URL:${NC}"
echo "  $DASHBOARD_URL"
echo ""
echo -e "${BLUE}User ID:${NC} $PUBLIC_ID"
echo ""

# Step 3: Instructions for starting monitoring
echo -e "${BLUE}[STEP 3/3]${NC} Start monitoring"
echo ""
echo "Run this command to start monitoring:"
echo ""
echo -e "${YELLOW}BASE_URL=$BASE_URL \\"
echo "WRITE_TOKEN=$WRITE_TOKEN \\"
echo "DASH_PASSPHRASE=<your-passphrase> \\"
echo "DASH_SALT_B64=$SALT \\"
echo -e "node cloudflare-sync.js${NC}"
echo ""
echo -e "${BLUE}Or save to a script:${NC}"
echo ""
cat > start-monitoring-$PUBLIC_ID.sh <<SCRIPT_EOF
#!/bin/bash
# Auto-generated monitoring script for user: $PUBLIC_ID

BASE_URL=$BASE_URL \\
WRITE_TOKEN=$WRITE_TOKEN \\
DASH_PASSPHRASE=\${DASH_PASSPHRASE:-TestPassphrase123!} \\
DASH_SALT_B64=$SALT \\
node cloudflare-sync.js
SCRIPT_EOF

chmod +x start-monitoring-$PUBLIC_ID.sh

echo "Created: start-monitoring-$PUBLIC_ID.sh"
echo ""
echo "Run with:"
echo "  DASH_PASSPHRASE=<your-passphrase> ./start-monitoring-$PUBLIC_ID.sh"
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
