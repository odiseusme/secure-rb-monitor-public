# Quick Start Guide

## Canonical Workflow

### Option 1: One-Shot Bootstrap (Recommended)
```bash
# Clone and start everything in one command
git clone https://github.com/odiseusme/secure-rb-monitor.git
cd secure-rb-monitor
scripts/bootstrap.sh
```

This will:
- Auto-select an available port (starting from 8080)
- Create necessary directories
- Build and start the Docker container
- Show you the access URLs

### Option 2: Manual Step-by-Step
```bash
# 1. Select/configure port
scripts/select_host_port.sh

# 2. Start the monitor
docker-compose up -d --build

# 3. Check URLs
scripts/show_monitor_url.sh
```

### Option 3: Advanced Configuration
```bash
# Bind to all interfaces (LAN access) and show QR code
BIND_ALL=1 SHOW_QR=1 scripts/select_host_port.sh

# Start with manual compose
docker-compose up -d --build

# View with QR code for mobile
SHOW_QR=1 scripts/show_monitor_url.sh
```

## Environment Variables

Edit `.env` to customize:
- `HOST_IP`: Interface binding (127.0.0.1 = local, 0.0.0.0 = LAN)
- `HOST_PORT`: External access port (auto-selected if not set)
- `UPDATE_INTERVAL`: Refresh rate in milliseconds (default: 30000)
- `TZ`: Timezone for logs (default: UTC)

## Common Commands

```bash
# View logs
docker-compose logs -f

# Stop monitor
docker-compose down

# Restart with new build
docker-compose up -d --build

# Force new port selection
FORCE=1 scripts/select_host_port.sh

# Open browser automatically
OPEN_BROWSER=1 scripts/select_host_port.sh
```

## Mobile Access

For smartphone/tablet access:
```bash
# Enable LAN binding and show QR code
BIND_ALL=1 SHOW_QR=1 scripts/select_host_port.sh
docker-compose up -d --build
```

Scan the QR code with your phone camera to open the monitor.