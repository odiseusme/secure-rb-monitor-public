# Secure Rosen Bridge Monitor


<!-- RBM_ROADMAP_REF:START -->
## Project Overview and Roadmap

For a complete, consolidated description of the project (architecture, security model, flows, deployment, troubleshooting) and a forward-looking roadmap with acceptance criteria, see:
- [RBMonitor_project_description_and_future_plans.md](./RBMonitor_project_description_and_future_plans.md)

This document is the single source of truth for:
- Full project overview and design decisions
- Current capabilities and deployment guidance
- Prioritized roadmap and security hardening steps
- What's shipped vs. planned (with acceptance criteria)

<!-- RBM_ROADMAP_REF:END -->
Zero-knowledge, end-to-end encrypted monitoring for Rosen Bridge watchers. Monitor your nodes locally or remotely with a simple, mobile-friendly dashboard – no privileged access required.

**Key Features:**
- 🔒 **Zero-knowledge encryption** – server never sees your data or passphrase
- 🌐 **Remote monitoring** – access from anywhere via Cloudflare Worker
- 🔐 **Invitation-based access** – admin-controlled user registration
- 🐳 **No privileged Docker access** – API-only monitoring, read-only containers
- 📱 **Mobile-responsive** – monitor from phone, tablet, or desktop
- ⚡ **Automatic discovery** – detects watchers and configures networks

> **Status:** v1.0 – Production ready with security-hardened architecture  
> See [`CHANGELOG.md`](./CHANGELOG.md) for version history and upgrade notes.

---

## Quick Start

Choose your deployment path based on your needs:

### Path A – Local Monitoring Only *(Simplest)*

Monitor watchers on your local machine with a web dashboard.  
**No Cloudflare account needed.**

**1. Clone and setup:**
```bash
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public
./scripts/prepare_build.sh
```

**2. Start monitoring:**
```bash
docker compose up -d --build
```

**3. Access dashboard:**
- Open: `http://localhost:8080` (or the URL shown by setup script)
- *(If 8080 is busy, the script automatically selects a free port and prints it.)*
- View your watcher status in real-time

**That's it!** Your watchers are now being monitored locally.

💡 **Tip:** You can upgrade to Path B (remote monitoring) anytime without reinstalling.

---

### Path B – Remote Monitoring with Cloudflare *(Encrypted)*

Monitor from anywhere with end-to-end encrypted remote access.

⚠️ **Important:** Only the project admin (who deploys the Worker) needs a Cloudflare account. Regular users just receive an invitation code and access their encrypted dashboard – no Cloudflare account required.

**Prerequisites (Admin Only):**
- Cloudflare account ([sign up free](https://dash.cloudflare.com/sign-up))
- Wrangler CLI: `npm install -g wrangler`

**1. Setup and start local monitoring:**
```bash
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public
./scripts/prepare_build.sh
docker compose up -d --build
```

**2. Deploy Cloudflare Worker (admin only):**
```bash
cd worker/mute-mouse-2cd2
wrangler login
wrangler deploy
```

📝 **Save the deployed URL** shown in output – you'll need it for user registration (e.g., `https://your-worker-abc123.workers.dev`).

🛡️ **Tip:** The Worker enforces HTTPS automatically in production and ships with rate-limiting **enabled by default**. You can adjust thresholds in `src/config.ts` if needed.

---

## For Users

### Complete Registration Workflow

**Step 1: Get invitation code from admin**

**Step 2: Register with automatic credential setup**

For production (remote Worker):
```bash
BASE_URL="https://your-worker.workers.dev" ./scripts/register-user.sh --invite INVITE-YOUR-CODE
```

For local development:
```bash
BASE_URL="http://localhost:38472" ./scripts/register-user.sh --invite INVITE-YOUR-CODE
```

**What happens during registration:**
1. ✅ Script validates your invitation code with the Worker
2. ✅ You'll be prompted to choose a passphrase (twice for confirmation)
3. ✅ Minimum 8 characters enforced for security
4. ✅ Credentials automatically saved to `.env` file
5. ✅ Dashboard URL displayed and saved to `.cloudflare-config.json`
6. ✅ Security warnings shown about keeping `.env` secure

**Step 3: Choose a strong passphrase when prompted**
```
Passphrase (min 8 chars): ••••••••••••••••
Confirm passphrase: ••••••••••••••••
```

**Passphrase Guidelines:**
- **Minimum:** 8 characters (enforced)
- **Recommended:** 20+ characters or 4-6 random words
- **Examples:** 
  - `correct-horse-battery-staple-47`
  - `MyS3cur3Pass!2025#RosenBridge`
- ⚠️ **Critical:** Save it in a password manager — if lost, data cannot be recovered

**Step 4: Registration complete!**
```
✓ Registered: abc123def456
✓ Credentials saved to .env
✓ Created: start-monitoring.sh

IMPORTANT: Your passphrase has been saved to .env
Keep this file secure and do not commit it to version control!

Dashboard: https://your-worker.workers.dev/d/abc123def456

To start monitoring: ./scripts/monitor_control.sh start
```

**Step 5: Start monitoring**

Use the monitor control script to manage both the producer (Docker) and uploader (host):

```bash
./scripts/monitor_control.sh start
```

**Step 6: Access your encrypted dashboard**
- Open the dashboard URL shown after registration
- Enter your passphrase to decrypt and view data
- Works from any device, anywhere

**Security:** All data is encrypted before upload – only you can decrypt it with your passphrase.

---

### Monitor Control Script

The `monitor_control.sh` script manages both components of the monitoring system:
- **Producer** (Docker container): Collects watcher status data
- **Uploader** (host process): Encrypts and uploads data to Cloudflare

#### Commands

**Start monitoring:**
```bash
./scripts/monitor_control.sh start
```
Starts both producer container and uploader process.

**Stop monitoring:**
```bash
./scripts/monitor_control.sh stop
```
Gracefully stops both components with proper cleanup.

**Check status:**
```bash
./scripts/monitor_control.sh status
```
Shows current state of producer and uploader.

**Restart monitoring:**
```bash
./scripts/monitor_control.sh restart
```
Stops and starts both components cleanly.

**Interactive menu:**
```bash
./scripts/monitor_control.sh
```
Shows an interactive menu if no command is specified:
```
🛰️  Cloudflare Monitor – What would you like to do?
   [S]tatus   [V] Start   [X] Stop   [R] Restart   [Q] Quit
```

#### Advanced Options

**Start only producer (skip uploader):**
```bash
./scripts/monitor_control.sh start --no-sync
```

**Start only uploader (skip producer):**
```bash
./scripts/monitor_control.sh start --no-docker
```

**Custom Worker URL:**
```bash
BASE_URL="https://custom-worker.workers.dev" ./scripts/monitor_control.sh start
```

#### Status Output Example

```bash
$ ./scripts/monitor_control.sh status

🛰️  Cloudflare Monitor – Status
   🌐  Base URL: http://localhost:38472
   🐳  Producer: running (container=rosen-bridge-monitor)
   ⬆️  Uploader: running (pid=12345)
```

#### How It Works

**Producer (Docker):**
- Runs `write_status.js` inside a Docker container
- Polls watcher APIs every 30 seconds
- Writes status to `public/status.json`
- Managed via `docker compose` for proper restart policies
- Automatically removes stopped containers before starting

**Uploader (Host):**
- Runs `cloudflare-sync.js` as a background process
- Reads credentials from `.env` file (created by `register-user.sh`)
- Encrypts data using your passphrase
- Uploads encrypted data to Cloudflare Worker
- PID tracked in `.run/uploader.pid` for management
- Graceful shutdown with 5-second timeout, then SIGKILL fallback

**Integration:**
- The script ensures `.env` exists and contains required variables
- Worker health check performed before starting uploader
- Adopts externally-started processes where possible
- Supports differently named containers with auto-detection

---

### Registration with QR Code (Mobile-Friendly)

For easy mobile access with optional auto-login, use the QR registration helper:

**Basic registration (passphrase required on login):**
```bash
BASE_URL="https://your-worker.workers.dev" ./scripts/register-with-qr.sh --invite INVITE-XXXX
```

**With embedded passphrase (auto-login):**
```bash
BASE_URL="https://your-worker.workers.dev" ./scripts/register-with-qr.sh \
  --invite INVITE-XXXX \
  --embed-passphrase \
  --passphrase "YourStrongPassphrase123"
```

**What this does:**
- ✅ Registers you with the Worker
- ✅ Saves credentials to `.env` (same as `register-user.sh`)
- ✅ Generates a PNG QR code (`dashboard-USERID.png`)
- ✅ Shows terminal QR code for immediate scanning
- ✅ Optionally embeds passphrase in URL fragment for auto-login

**Options:**
- `--embed-passphrase` - Include passphrase in URL (convenient but less secure)
- `--passphrase VALUE` - Specify passphrase (or prompted securely if omitted)
- `--fragment-key KEY` - Custom fragment key name (default: `p`)
- `--qr-out FILE.png` - Custom output filename
- `--base-url URL` - Override Worker URL (or use `BASE_URL` env var)

**Security Considerations:**

⚠️ **Passphrase Embedding:**
- When using `--embed-passphrase`, the passphrase is placed in the URL fragment (`#p=...`)
- The fragment is NOT sent to the server (client-side only)
- However, anyone who scans the QR can read your passphrase
- **Use only for:** Personal devices, trusted networks, convenience over security
- **Don't use for:** Shared devices, public displays, sensitive data

⚠️ **Browser Autofill Conflicts:**
- If you previously saved a passphrase in your browser, it may conflict with the fragment passphrase
- **Solution:** Use incognito/private mode, or clear saved passwords for the site
- The browser may prefer saved credentials over the URL fragment

---

## For Admins

### Deploying to Cloudflare

**One-time setup:**
```bash
cd worker/mute-mouse-2cd2
wrangler login
wrangler deploy
```

**Set admin key:**
```bash
wrangler secret put ADMIN_API_KEY
# Enter a strong random key when prompted
```

**Create KV namespace:**
```bash
wrangler kv:namespace create USERS_KV
# Update wrangler.toml with the namespace ID
```

**Verify deployment:**
```bash
curl https://your-worker.workers.dev/health
# Should return: {"status":"ok"}
```

---

### Creating Invitations

Generate invitation codes for new users:

```bash
curl -X POST https://your-worker.workers.dev/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 5, "expiresInDays": 30}'
```

**Response:**
```json
{
  "success": true,
  "invitations": [
    {"code": "INVITE-ABC123-XYZ789", "expiresAt": "2025-11-15T10:30:00Z"}
  ]
}
```

**Share invitation codes securely** with users (email, encrypted chat, etc.).

**Example workflow:**
```bash
# 1. Admin creates invite
curl -X POST https://your-worker.workers.dev/api/admin/create-invite \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 7}'

# 2. Admin shares INVITE-CODE with user securely

# 3. User registers
BASE_URL="https://your-worker.workers.dev" ./scripts/register-user.sh --invite INVITE-CODE

# 4. User starts monitoring
./scripts/monitor_control.sh start

# 5. User accesses dashboard from anywhere
```

---

### Monitoring Usage

```bash
curl https://your-worker.workers.dev/api/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Key metrics:**
- Total users and activity
- Request counts per user
- Rate-limit violations
- Suspicious-activity detection

**Cloudflare Free Tier Limits:**
- 100,000 requests/day
- ≈57 users max at default polling rate

See [`complete_project_docs.md`](./complete_project_docs.md) for detailed admin guidance, rate-limiting, user-management, and scaling strategies.

---

## Development

### Local Development Setup

**Prerequisites:**
- Node.js 18+ and npm
- Docker and Docker Compose
- jq, curl (typically pre-installed on Linux/macOS)

**Install dependencies:**
```bash
npm install
cd worker/mute-mouse-2cd2 && npm install
```

**Start components:**
```bash
# Terminal 1 – Worker (local development)
cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local

# Terminal 2 – Producer (Docker)
cd ../..
docker compose up -d --build

# Terminal 3 – Register and start uploader
BASE_URL="http://localhost:38472" ./scripts/register-user.sh --invite YOUR-INVITE-CODE
./scripts/monitor_control.sh start --no-docker  # Skip Docker since already running
```

**Make changes and test:**
- Worker auto-reloads on changes
- Restart Docker for container changes: `docker compose restart`
- Re-run setup script when adding watchers: `./scripts/prepare_build.sh`
- Use `monitor_control.sh status` to check component states

### CI/CD

Baseline GitHub Actions workflow included. Customize for your needs.

---

## Architecture

### System Components

```
┌─────────────────┐
│ Docker Container│  Runs write_status.js
│ (write_status)  │  Polls watcher APIs
└────────┬────────┘
         │ Generates status.json
         ↓
┌─────────────────┐
│  Host Process   │  Runs cloudflare-sync.js
│ (cloudflare-    │  Encrypts and uploads
│  sync.js)       │  (Optional for remote)
└────────┬────────┘
         │ Encrypted upload
         ↓
┌─────────────────┐
│ Cloudflare      │  Stores encrypted data
│ Worker + KV     │  Serves dashboard
└────────┬────────┘
         │ Fetch + decrypt
         ↓
┌─────────────────┐
│   Browser       │  Decrypts client-side
│  (Dashboard)    │  Displays status
└─────────────────┘
```

### Data Flow

1. **Collection:** `write_status.js` polls watcher APIs every 30 seconds
2. **Local Storage:** Status saved to `public/status.json`
3. **Encryption:** `cloudflare-sync.js` encrypts with AES-GCM (PBKDF2-SHA256)
4. **Upload:** Encrypted data sent to Cloudflare Worker
5. **Storage:** Worker stores in KV (never sees decrypted data)
6. **Retrieval:** Browser fetches encrypted blob
7. **Decryption:** Client-side decryption with user passphrase
8. **Display:** Dashboard renders watcher status

### Security Model

**Zero-Knowledge Architecture:**
- Passphrase never transmitted to server
- Server stores only encrypted blobs
- Decryption happens entirely in browser
- Per-user salt prevents rainbow table attacks

**Encryption Specs:**
- Algorithm: AES-GCM 256-bit
- Key Derivation: PBKDF2-SHA256 (100,000 iterations)
- Nonce: Random 12-byte IV per encryption
- Authentication: Included in GCM mode

---

## 🛡️ Security Features

### ✅ Currently Implemented Security Features

**No Privileged Access:**
- ✅ No Docker socket mounting
- ✅ API-only watcher communication
- ✅ Read-only container filesystem
- ✅ Minimal Linux capabilities (drops ALL, adds only SETUID/SETGID)
- 🔄 Non-root user configuration (needs cleanup - currently has conflicting user statements)

**Network Isolation:**
- ✅ Automatic watcher network discovery
- ✅ No host network access
- ✅ Isolated from non-watcher networks

**Zero-Knowledge Encryption:**
- ✅ Client-side encryption/decryption only
- ✅ Server never sees passphrases or plaintext
- ✅ Per-user salts prevent attacks
- ✅ Industry-standard crypto (AES-GCM, PBKDF2-SHA256, 100,000 iterations)

**Production Security Defaults:**
- ✅ HTTPS enforced in production
- ✅ Invitation-based registration
- ✅ Rate limiting enabled by default (30 reads/hour per user)
- ✅ Passphrase minimum length (8 chars) with confirmation
- 🔄 Security headers (CSP, X-Frame-Options, etc.) - **planned enhancement**

### 🔄 Security Enhancements in Progress

**Planned Improvements:**
- 🔄 Increase PBKDF2 iterations (100k → 300k) with backward compatibility
- 🔄 Complete security header set (beyond current CSP)
- 🔄 Enhanced passphrase recommendations (12+ characters)
- 🔄 Improved error handling and logging hygiene
- 🔄 Default to not storing passphrases in .env files

> **Note:** The security foundation is solid and production-ready. Planned enhancements focus on incremental improvements and defense-in-depth.

---

## Troubleshooting

### Registration Issues

**Problem:** `Registration failed - config not created`

**Solution:**
- Ensure Worker is running and accessible at BASE_URL
- Check invitation code hasn't expired
- Verify network connectivity to Worker
- For local development, ensure `wrangler dev` is running

---

### Watchers Not Discovered

**Symptom:** Setup script finds 0 watchers

**Solution:**
- Ensure watcher containers are running: `docker ps`
- Check container names end with `-ui-1` or `-service-1`
- Verify watchers are healthy: `docker ps -a`

---

### Monitor Control Issues

**Problem:** `Producer container not present` or `Uploader not running`

**Solution:**
```bash
# Check overall status
./scripts/monitor_control.sh status

# If producer not running
docker compose up -d

# If uploader not running (ensure .env exists first)
./scripts/monitor_control.sh start --no-docker

# Full restart
./scripts/monitor_control.sh restart
```

**Problem:** `Error: BASE_URL not set in .env`

**Solution:**
- Run `register-user.sh` first to create `.env` file
- Or manually add credentials to `.env`:
```bash
BASE_URL=https://your-worker.workers.dev
WRITE_TOKEN=your-write-token
DASH_SALT_B64=your-salt
DASH_PASSPHRASE=your-passphrase
```

---

### Dashboard Shows "Connection Refused"

**Symptom:** Cannot access dashboard URL

**Solution:**
- Check Docker container running: `docker ps | grep rosen-bridge-monitor`
- Verify port not blocked by firewall
- For remote access, check `BIND_ALL=1` was used in setup

---

### Decrypt Errors in Dashboard

**Symptom:** "Cannot access property 'nonce'" or decrypt failures

**Solution:**
- Ensure `cloudflare-sync.js` is running: `./scripts/monitor_control.sh status`
- Verify credentials in `.env` are correct
- Wait 60 seconds for first upload to complete
- Check worker is running: `curl $BASE_URL/health`
- Verify correct passphrase in dashboard (case-sensitive, must match exactly)

---

### Docker Container Won't Start

**Symptom:** Container exits immediately or "conflict" errors

**Solution:**
```bash
# Stop and remove any existing containers
./scripts/monitor_control.sh stop

# Rebuild and restart
docker compose up -d --build

# Or use the control script
./scripts/monitor_control.sh restart
```

---

### Permission Errors

**Symptom:** Cannot write to mounted volumes

**Solution:**
```bash
# Container runs as UID 1000
sudo chown -R 1000:1000 data/ logs/ config/ public/
```

---

### Cloudflare Sync Not Uploading

**Symptom:** Dashboard shows stale data

**Solution:**
```bash
# Check uploader status
./scripts/monitor_control.sh status

# Restart uploader
./scripts/monitor_control.sh restart --no-docker

# Check .env file exists and has correct values
cat .env | grep -E "BASE_URL|WRITE_TOKEN|DASH_SALT_B64|DASH_PASSPHRASE"

# Review worker health
curl $BASE_URL/health
```

---

## Environment Variables

### .env File (Auto-created by register-user.sh)
```bash
# Cloudflare Worker Configuration
BASE_URL=https://your-worker.workers.dev
WRITE_TOKEN=abc123def456...
DASH_SALT_B64=xyz789...
DASH_PASSPHRASE=your-chosen-passphrase
```

⚠️ **Security:** Never commit `.env` to version control! Add to `.gitignore`.

### Docker Deployment
```bash
HOST_PORT=8080          # Dashboard port
HOST_IP=0.0.0.0        # Bind address (0.0.0.0 for LAN access)
DOCKER_GID=984         # Docker group ID
NODE_ENV=production    # Environment mode
```

### Cloudflare Worker
```bash
ADMIN_API_KEY=xxx      # Admin authentication
USERS_KV=xxx          # KV namespace binding
ENVIRONMENT=production # Worker environment
```

See [`complete_project_docs.md`](./complete_project_docs.md) for comprehensive configuration details.

---

## Project Structure

```
secure-rb-monitor-public/
├── scripts/
│   ├── prepare_build.sh       # Auto-setup and discovery
│   ├── register-user.sh       # User registration helper (IMPROVED)
│   ├── register-with-qr.sh    # QR code registration (mobile)
│   └── monitor_control.sh     # Monitoring control script (NEW)
├── worker/
│   └── mute-mouse-2cd2/       # Cloudflare Worker code
│       ├── src/               # Worker endpoints
│       └── wrangler.toml      # Worker configuration
├── public/                    # Dashboard static files
│   ├── index.html            # Dashboard UI
│   ├── style.css             # Styling
│   └── cryptoHelpers.js      # Client-side crypto
├── cloudflare-sync.js        # Encryption & upload
├── write_status.js           # Watcher data collection
├── setup-cloudflare.js       # Registration script
├── docker-compose.yml        # Container orchestration
├── Dockerfile                # Container image
├── .env                      # User credentials (auto-created, gitignored)
└── config.json               # Auto-generated watcher config
```

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for detailed guidelines.

**Security issues:** Report privately to the maintainers.

---

## License

MIT License – see [`LICENSE`](./LICENSE) for details.

---

## Support

- **Documentation:** [`complete_project_docs.md`](./complete_project_docs.md)
- **Issues:** [GitHub Issues](https://github.com/odiseusme/secure-rb-monitor-public/issues)
- **Discussions:** [GitHub Discussions](https://github.com/odiseusme/secure-rb-monitor-public/discussions)

---

> **Note:** This is a community project for the Rosen Bridge ecosystem maintained by @odiseus_me. Feedback from Rosen Bridge maintainers and security reviewers is welcome.
