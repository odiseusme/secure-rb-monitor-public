# Secure Rosen Bridge Monitor

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

**3. Start the worker locally for development:**
```bash
# Terminal 1 – start worker
cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local

# Terminal 2 – register and start encrypted sync
cd ../..
./scripts/register-user.sh --invite YOUR-INVITE-CODE
DASH_PASSPHRASE='your-strong-passphrase' ./start-monitoring.sh &
```

**4. Access your encrypted dashboard:**
- URL shown after registration (e.g., `https://your-worker.workers.dev/d/YOUR-USER-ID`)
- Enter your passphrase to decrypt and view data
- Works from any device, anywhere

**Security:** All data encrypted before upload – only you can decrypt it.

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

Send invitation codes securely to users (email, encrypted chat, etc.).

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

## For Users

### Registration

1️⃣ **Get invitation code from admin**

2️⃣ **Register:**
```bash
./scripts/register-user.sh --invite INVITE-YOUR-CODE-HERE
```

3️⃣ **Choose a strong passphrase:**
- 20+ characters or 4-6 random words
- Examples: `correct-horse-battery-staple-47` or `MyS3cur3Pass!2025`
- ⚠️ **Critical:** System refuses weak passphrases like `TestPassphrase123!`
- **Save it:** Use a password manager – if lost, data cannot be recovered

4️⃣ **Save your credentials:**
- Dashboard URL (shown after registration)
- Your passphrase (never sent to server)

---

### Starting and Stopping

**Start everything:**
```bash
# 1. Start local monitor
docker compose up -d

# 2. Start Cloudflare sync (required for remote monitoring)
DASH_PASSPHRASE='your-passphrase' ./start-monitoring.sh &
```

⚠️ **Critical:** Always set `DASH_PASSPHRASE` when starting the sync script. If omitted, encryption will use a default passphrase and your dashboard won't be able to decrypt the data.

**Stop everything:**
```bash
# Stop Cloudflare sync
pkill -f cloudflare-sync.js

# Stop local monitor
docker compose down
```

**Check status:**
```bash
# Docker container
docker ps | grep rosen-bridge-monitor

# Cloudflare sync
ps aux | grep cloudflare-sync.js | grep -v grep

# View logs
docker compose logs -f
```

**Restart after changes:**
```bash
# Restart Docker
docker compose restart

# Restart Cloudflare sync (always with passphrase!)
pkill -f cloudflare-sync.js
DASH_PASSPHRASE='your-passphrase' ./start-monitoring.sh &
```

---

### Accessing Your Dashboard

**Local (Path A):**
- URL: `http://localhost:8080` or IP shown by setup script
- No passphrase needed (local access only)

**Remote (Path B):**
- URL: `https://your-worker.workers.dev/d/YOUR-USER-ID`
- Enter your passphrase to decrypt
- Works on any device with internet

**Mobile access:**
- Use QR code from setup script (if enabled)
- Or manually enter the URL on your phone

---

## Advanced Configuration

### Setup Script Options

Customize the automatic setup:

```bash
BIND_ALL=1 ./scripts/prepare_build.sh   # LAN access
SHOW_QR=1 ./scripts/prepare_build.sh    # Show QR for mobile
OPEN_BROWSER=1 ./scripts/prepare_build.sh
FORCE=1 ./scripts/prepare_build.sh      # Regenerate config
```

### Adding/Removing Watchers

When watcher containers change:

```bash
./scripts/prepare_build.sh
docker compose up -d --build
```

Auto-discovers new watchers and updates configuration.

### Manual Configuration

Override automatic discovery by editing `config.json`:

```json
{
  "watchers": [
    {
      "name": "watcher_ergo",
      "ui_name": "watcher_ergo-ui-1",
      "ui_port": 3030,
      "service_name": "watcher_ergo-service-1",
      "service_url": "http://watcher_ergo-service-1:3000/info",
      "network": "ergo"
    }
  ]
}
```

---

## Development

### Local Development Setup

**Install dependencies:**
```bash
npm install
cd worker/mute-mouse-2cd2 && npm install
```

**Start components:**
```bash
# Terminal 1 – Worker
cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local

# Terminal 2 – Docker monitor
docker compose up -d --build

# Terminal 3 – Cloudflare sync (optional)
DASH_PASSPHRASE='test' ./start-monitoring.sh
```

**Make changes and test:**
- Worker auto-reloads on changes
- Restart Docker for container changes
- Re-run setup script when adding watchers

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

### No Privileged Access
- ✅ No Docker socket mounting
- ✅ API-only watcher communication
- ✅ Read-only container filesystem
- ✅ Minimal Linux capabilities (drops ALL, adds only SETUID/SETGID)
- ✅ Non-root user (UID 1000)

### Network Isolation
- ✅ Automatic watcher network discovery
- ✅ No host network access
- ✅ Isolated from non-watcher networks

### Zero-Knowledge Encryption
- ✅ Client-side encryption/decryption only
- ✅ Server never sees passphrases or plaintext
- ✅ Per-user salts prevent attacks
- ✅ Industry-standard crypto (AES-GCM, PBKDF2)

### Secure Defaults
- ✅ HTTPS enforced in production
- ✅ CSP headers prevent XSS
- ✅ Invitation-based registration
- ✅ Rate limiting enabled by default

---

## Troubleshooting

### Watchers Not Discovered

**Symptom:** Setup script finds 0 watchers

**Solution:**
- Ensure watcher containers are running: `docker ps`
- Check container names end with `-ui-1` or `-service-1`
- Verify watchers are healthy: `docker ps -a`

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
- Ensure `cloudflare-sync.js` is running and uploading
- **Verify `DASH_PASSPHRASE` was set when starting the sync script**
- Wait 60 seconds for first upload to complete
- Check worker is running: `curl http://localhost:38472/health`
- Verify correct passphrase in dashboard (case-sensitive, must match exactly)

---

### Docker Container Won't Start

**Symptom:** Container exits immediately or "conflict" errors

**Solution:**
```bash
# Remove stuck container
docker rm -f rosen-bridge-monitor

# Rebuild and restart
docker compose up -d --build
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
- Check process running: `ps aux | grep cloudflare-sync.js`
- **Verify `DASH_PASSPHRASE` environment variable is set**
- Check worker URL is correct in `start-monitoring.sh`
- Review logs for errors

---

## Environment Variables

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

### Upload Script
```bash
BASE_URL=http://localhost:38472              # Worker URL
WRITE_TOKEN=xxx                              # User write token
DASH_PASSPHRASE=your-passphrase             # Encryption passphrase (REQUIRED!)
DASH_SALT_B64=xxx                           # User salt (base64)
```

See [`complete_project_docs.md`](./complete_project_docs.md) for comprehensive configuration details.

---

## Project Structure

```
secure-rb-monitor-public/
├── scripts/
│   ├── prepare_build.sh       # Auto-setup and discovery
│   └── register-user.sh       # User registration helper
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

> **Note:** This is a community project for the Rosen Bridge ecosystem. Feedback from Rosen Bridge maintainers and security reviewers is welcome.
