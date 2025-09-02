# Rosen Bridge Monitor

Remote monitoring dashboard for Rosen Bridge infrastructure - access health and status summaries from any PC or mobile device.

## Purpose & Vision

This project provides **remote monitoring capabilities** for Rosen Bridge Watchers, enabling you to:
- 📱 **Monitor from anywhere**: Access health summaries on remote PCs and mobile devices
- 🌐 **Start local, scale remote**: Begin with local deployment, then deploy to cloud services (Cloudflare, AWS, etc.)
- 📊 **Real-time insights**: Get instant status updates on watcher health and permit levels
- 🔧 **Flexible deployment**: Static architecture supports any hosting solution

## Migration to Static Architecture ✅

This version has been migrated from Express.js to a pure static file approach for better performance, simpler deployment, and reduced dependencies - **perfect for remote hosting scenarios**.

## Prerequisites

### Quick Setup (Recommended)
Run the automated setup script that checks for Node.js 18+ and npm, installing them if needed:

```bash
# Clone the repository
git clone https://github.com/odiseusme/secure-rb-monitor
cd secure-rb-monitor

# Run setup script (checks and installs Node.js 18+ and npm if needed)
./setup.sh

# Install project dependencies
npm install

# Start monitoring
node static-server.js
```

The setup script will:
- ✅ Check if Node.js 18+ is already installed
- ✅ Check if npm is available
- ✅ Install missing dependencies only if needed
- ✅ Work on Ubuntu/Debian, macOS, and other Unix-like systems
- ✅ Provide clear feedback and next steps

### Manual Installation Options

#### Option 1: Node.js (If setup script doesn't work)
Install Node.js 18+ manually:

**Ubuntu/Debian:**
```bash
# Install Node.js 18+ via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or via snap
sudo snap install node --classic
```

**macOS:**
```bash
# Via Homebrew
brew install node

# Or download from: https://nodejs.org/
```

**Windows:**
```bash
# Download installer from: https://nodejs.org/
# Or via chocolatey: choco install nodejs
```

**Verify installation:**
```bash
node --version  # Should show v18.0.0 or higher
npm --version
```

#### Option 2: Docker (No Node.js Required)
If you prefer not to install Node.js or encounter version conflicts:

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # Logout/login required

# Then use Docker deployment (see Docker section below)
docker-compose up -d
```

## Quick Start Guide

### First-Time Setup
If you haven't set up the prerequisites yet, run the automated setup:

```bash
# Clone and setup (first time only)
git clone https://github.com/odiseusme/secure-rb-monitor
cd secure-rb-monitor
./setup.sh          # Installs Node.js 18+ and npm if needed
npm install          # Install project dependencies
```

### Local Development & Testing
Start with local deployment to test functionality before going remote:

#### Option 1: Static Server with Auto-Updates (Recommended)
```bash
node static-server.js
# Serves on http://localhost:8080 with automatic status updates every 30 seconds
# Access from your local network: http://[your-ip]:8080
```

#### Option 2: Pure Static (Manual Updates)
```bash
# Generate status data
node write_status.js

# Serve with any static server
cd public
python3 -m http.server 8080
# Open http://localhost:8080 or http://[your-ip]:8080
```

#### Option 3: Separate Status Updater + Static Server
```bash
# Terminal 1: Run status updater
node status-updater.js

# Terminal 2: Serve static files 
npm run serve
# or: cd public && python3 -m http.server 8080
```

### Remote Deployment Options

Once tested locally, deploy for remote access from any device:

#### Cloud Hosting (Cloudflare Pages, Netlify, Vercel)
```bash
# Generate static files
node write_status.js

# Deploy the public/ directory to any static hosting service
# Use status-updater.js with cron/scheduler for periodic updates
```

#### Self-Hosted Remote Server
```bash
# On your remote server
git clone https://github.com/odiseusme/secure-rb-monitor
cd secure-rb-monitor
node static-server.js
# Access from anywhere: http://your-domain.com:8080
```

#### Docker Remote Deployment
```bash
# Deploy with Docker for easy remote server setup
docker-compose up -d
# Access remotely: http://your-server-ip:8080
```

## Generate status.json

From project root:
```bash
node write_status.js
# writes to: public/status.json
```

## Remote Access & Mobile Monitoring

### Access from Any Device
The static architecture ensures your Rosen Bridge monitoring dashboard is accessible from:
- 📱 **Mobile devices** (iOS, Android) via web browser
- 💻 **Remote PCs** and laptops 
- 📺 **Tablets** for larger dashboard view
- 🌐 **Any location** with internet access

### Deployment Progression
1. **Start Local**: Test with `node static-server.js` on your local network
2. **Go Remote**: Deploy to cloud hosting for global access
3. **Scale Up**: Add multiple instances, load balancing, CDN as needed

### Recommended Remote Hosting
- **Cloudflare Pages**: Free tier, global CDN, automatic SSL
- **Netlify**: Easy deployment, branch previews, forms
- **Vercel**: Fast builds, serverless functions for advanced features
- **AWS S3 + CloudFront**: Enterprise-grade, highly scalable
- **Self-hosted VPS**: Full control, custom domain

## Community & Support

### Consulting with Rosen Bridge Developers
For questions about optimal remote monitoring approaches or integration with Rosen Bridge infrastructure:

- **GitHub Issues**: Create an issue in the [Rosen Bridge repositories](https://github.com/rosen-bridge)
- **Discord**: Join the Rosen Bridge community Discord for real-time discussions
- **Documentation**: Check [Rosen Bridge docs](https://docs.rosen.tech/) for latest recommendations
- **Community Forums**: Engage with other developers using Rosen Bridge monitoring

When reaching out:
1. Describe your remote monitoring use case (mobile access, cloud deployment, etc.)
2. Share your deployment environment (VPS, cloud provider, etc.)
3. Ask about recommended architectures for your scale and requirements

## Troubleshooting

### Node.js Installation Issues

If you encounter problems with Node.js installation:

```bash
# Run the setup script for automated resolution
./setup.sh

# Or check manually
node --version  # Should show v18.0.0 or higher
npm --version   # Should be available
```

**Common Issues:**
- **"Command 'node' not found"**: Run `./setup.sh` to install Node.js 18+
- **Node.js too old**: The setup script will detect and upgrade old versions
- **npm missing**: Usually comes with Node.js; the setup script will verify and fix
- **Permission errors**: On Ubuntu/Debian, you may need `sudo` for system-wide installation

**Alternative Installation Methods:**
```bash
# Via NVM (recommended for development)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
nvm use --lts

# Via Docker (no Node.js installation needed)
docker-compose up -d
```

### Monitor Not Starting

If `node static-server.js` fails:
1. Ensure Node.js 18+ is installed: `./setup.sh`
2. Install dependencies: `npm install`
3. Check for port conflicts: `lsof -i :8080`
4. Review error messages for specific issues

### Remote Access Issues

- **Local network access**: Use `http://[your-ip]:8080` instead of `localhost`
- **Cloud deployment**: Ensure status data is generated before deployment
- **Mobile access**: Check that the hosting service supports HTTPS for full functionality

## Docker Deployment

The Docker setup now uses the static architecture:

```bash
# Build and run
docker-compose up -d

# Check status
curl http://localhost:8080/health
curl http://localhost:8080/status.json
```

## Scripts

- `npm start` - Generate status.json once
- `npm run serve` - Start static server only
- `npm run serve:python` - Use Python's built-in server
- `npm run update` - Run periodic status updates
- `npm run dev` - Run both updater and server for development

## Architecture

### Current (Static - Optimized for Remote Monitoring)
- **write_status.js**: Collects watcher data and writes `public/status.json`
- **static-server.js**: Simple HTTP server serving static files + periodic updates
- **status-updater.js**: Standalone status updater (alternative to static-server.js)
- **public/**: Static HTML, CSS, and JSON data files (mobile-responsive)

### Benefits of Static Architecture for Remote Monitoring
- ✅ **Remote Access Ready**: Works with any hosting solution (Cloudflare, AWS, etc.)
- ✅ **Mobile Optimized**: Responsive design for phone and tablet access  
- ✅ **Low Resource Usage**: Ideal for VPS and cloud deployments
- ✅ **CDN Compatible**: Fast global access via content delivery networks
- ✅ **No Complex Setup**: Simple deployment to any static host
- ✅ **Network Efficient**: Minimal bandwidth usage for remote monitoring
- ✅ **Easy SSL**: HTTPS setup simplified with static hosting providers

## Migration Notes

- **Removed**: `server.js` (Express-based)
- **Added**: `static-server.js` (lightweight replacement)
- **Added**: `status-updater.js` (standalone updater)
- **Removed**: Express dependency from package.json
- **Updated**: Docker deployment for static architecture

## Notes

* Watcher status: Healthy / Unstable / Broken (from API).
* Permit status: Sufficient / Critical / Exhausted (computed).

## Quickstart (non-destructive)

### Ubuntu / Debian / Linux Mint
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out/in or reboot for group to apply
sudo apt-get update && sudo apt-get install -y jq || true

git clone https://github.com/odiseusme/secure-rb-monitor
cd secure-rb-monitor
echo 'TZ=UTC'         >> .env
echo 'HOST_PORT=8082' >> .env      # pick any free port (host); container stays 8080
docker compose up -d
```

### First-Time Port Selection & Access

The Monitor chooses a free host port starting at 8080 when you run the selector script.  
It writes the chosen port into `.env` (line `HOST_PORT=...`), prints the URL, and can (optionally) show a QR code for phone access.

#### 1. Initial port selection (localhost only)
```bash
scripts/select_host_port.sh
```
Example output:
```
[port-select] Selected HOST_PORT=8080 (internal MONITOR_PORT=8080).
Monitor URL: http://127.0.0.1:8080/
LAN URL:     http://192.168.1.42:8080/
```

#### 2. (Optional) Allow phone (LAN) access + show QR code + open browser
Bind to all interfaces (0.0.0.0), show QR, and open default browser:
```bash
BIND_ALL=1 SHOW_QR=1 OPEN_BROWSER=1 scripts/select_host_port.sh
```
If you only want the QR (no browser):
```bash
SHOW_QR=1 scripts/select_host_port.sh
```

To enable QR codes you need `qrencode`:
- Debian/Ubuntu: `sudo apt-get install -y qrencode`
- macOS (Homebrew): `brew install qrencode`

#### 3. Start (or recreate) the Monitor container
```bash
docker compose up -d --force-recreate
```

#### 4. Visit the UI
- On this machine: `http://127.0.0.1:<HOST_PORT>/`
- On phone (same Wi‑Fi): use the “LAN URL” shown (e.g. `http://192.168.1.42:<HOST_PORT>/`)
  - If it fails, ensure firewall allows the port and that `.env` has `HOST_IP=0.0.0.0`.

#### 5. Show URLs again later (without changing the port)
```bash
scripts/select_host_port.sh
```
(It will just echo the existing URL; use `FORCE=1` only if you want to pick a new port.)

#### 6. Change to a new free port
Remove the line and re-run:
```bash
sed -i '/^HOST_PORT=/d' .env
scripts/select_host_port.sh
docker compose up -d --force-recreate
```

#### 7. Revert to localhost-only (stop exposing to LAN)
Edit `.env` (set `HOST_IP=127.0.0.1`) then:
```bash
docker compose up -d --force-recreate
```

#### Notes
- Internal container port remains fixed at 8080.
- The script only auto-selects when `HOST_PORT` is absent or you use `FORCE=1`.
- Environment flags you can combine:
  - `BIND_ALL=1` → sets/changes `HOST_IP` to `0.0.0.0`
  - `SHOW_QR=1` → prints QR code if `qrencode` installed
  - `OPEN_BROWSER=1` → opens the local URL in your default browser
  - `FORCE=1` → ignore existing `HOST_PORT` and search again
