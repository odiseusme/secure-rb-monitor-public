# Cloudflare Sync Setup Guide

This guide explains how to set up and use the `cloudflare-sync.js` script to automatically upload your Rosen Bridge Monitor status data to Cloudflare KV storage.

## Prerequisites

1. **Cloudflare Account** with KV namespace configured
2. **API Token** with KV:edit permissions  
3. **Node.js** version 18 or higher

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables:

```bash
# Cloudflare sync configuration
BASE_URL=https://api.cloudflare.com/client/v4
WRITE_TOKEN=your-cloudflare-api-token
DASH_PASSPHRASE=your-secure-passphrase-minimum-8-chars
DASH_SALT_B64=your-base64-encoded-salt

# Optional settings (defaults shown)
WATCH_INTERVAL=5000      # Check interval in milliseconds
FETCH_TIMEOUT=30000      # Network timeout in milliseconds  
MAX_RETRIES=3            # Maximum retry attempts
```

### 2. Cloudflare Configuration

Create and configure the Cloudflare settings file:

```bash
cp .cloudflare-config.json.example .cloudflare-config.json
```

Edit `.cloudflare-config.json` with your Cloudflare details:

```json
{
  "endpoint": "https://api.cloudflare.com/client/v4",
  "accountId": "your-cloudflare-account-id",
  "namespaceId": "your-kv-namespace-id", 
  "keyName": "rosen-bridge-status",
  "encryption": {
    "algorithm": "aes-256-gcm",
    "keyDerivation": "pbkdf2"
  }
}
```

### 3. Cloudflare KV Setup

1. **Create KV Namespace**: Log into Cloudflare Dashboard → Workers & Pages → KV
2. **Create API Token**: My Profile → API Tokens → Create Token
   - Template: "Custom token"
   - Permissions: Zone:Zone:Read, Zone:Zone Settings:Read, Account:Cloudflare Workers:Edit
   - Account Resources: Include your account
   - Zone Resources: Include your zones (if any)

### 4. Getting Your Configuration Values

**Account ID**: Found in Cloudflare Dashboard → Right sidebar  
**Namespace ID**: Workers & Pages → KV → Click your namespace → Namespace ID  
**API Token**: My Profile → API Tokens → Create Token (save securely)

## Usage

### Running the Sync Script

```bash
# Start the sync daemon
node cloudflare-sync.js

# Or use npm script  
npm run cloudflare-sync

# Run with custom environment
WATCH_INTERVAL=10000 node cloudflare-sync.js
```

### Integration with Monitor

The script automatically watches `public/status.json` and uploads changes. To integrate:

1. **Start the status updater**:
   ```bash
   npm run update  # Generates status.json periodically
   ```

2. **Start the sync script** (in another terminal):
   ```bash
   npm run cloudflare-sync  # Watches for changes and syncs
   ```

3. **For production**, use a process manager like systemd or PM2:
   ```bash
   # Example with PM2
   pm2 start status-updater.js --name "rosen-status"
   pm2 start cloudflare-sync.js --name "rosen-sync"
   ```

## Understanding the Logs

The script provides detailed logging for troubleshooting:

- **`[ENV]`**: Environment variable validation
- **`[CONFIG]`**: Configuration file loading  
- **`[WATCH]`**: File monitoring activity
- **`[HASH]`**: File change detection
- **`[UPLOAD]`**: Cloudflare upload attempts
- **`[SYNC]`**: Synchronization results
- **`[ERROR]`**: Error conditions

### Example Log Output

```
[2025-09-23T15:22:48.197Z] [WATCH] Changes detected - preparing to sync
[2025-09-23T15:22:48.197Z] [WATCH] Previous hash: none
[2025-09-23T15:22:48.197Z] [WATCH] Current hash:  769e01636fa1c283...
[2025-09-23T15:22:48.197Z] [WATCH] Status data size: 213 bytes
[2025-09-23T15:22:48.197Z] [UPLOAD] Uploading data to Cloudflare...
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Check that all required variables in `.env` are set
   - Ensure `.env` file is in the correct directory

2. **"Cloudflare config file not found"**
   - Script will create `.cloudflare-config.json` example automatically
   - Configure it with your actual Cloudflare settings

3. **"Failed to upload to Cloudflare"**
   - Verify API token has KV:edit permissions
   - Check account ID and namespace ID are correct
   - Ensure network connectivity

4. **"Status file not found"**
   - Normal if `write_status.js` hasn't run yet
   - Run `npm run start` to generate initial status.json

### Testing the Setup

1. **Test environment validation**:
   ```bash
   node cloudflare-sync.js
   # Should show validation errors if misconfigured
   ```

2. **Test file change detection**:
   ```bash
   # Terminal 1: Start sync script
   npm run cloudflare-sync
   
   # Terminal 2: Generate new status
   npm run start
   
   # Watch logs for change detection and sync attempts
   ```

3. **Test with fake credentials** (safe testing):
   ```bash
   BASE_URL=https://api.cloudflare.com/client/v4 \
   WRITE_TOKEN=test-token \
   DASH_PASSPHRASE=test-passphrase \
   DASH_SALT_B64=dGVzdC1zYWx0 \
   node cloudflare-sync.js
   ```

## Security Considerations

- **Never commit** `.env` or `.cloudflare-config.json` to version control
- **Restrict API token** permissions to minimum required (KV:edit only)
- **Use strong passphrase** (minimum 8 characters, recommended 16+)
- **Rotate tokens** periodically for security
- **Monitor logs** for unauthorized access attempts

## Advanced Configuration

### Custom File Paths

Edit the `CONFIG` object in `cloudflare-sync.js`:

```javascript
const CONFIG = {
  statusFile: path.join(__dirname, 'custom', 'status.json'),
  cloudflareConfigFile: path.join(__dirname, 'custom-cloudflare.json'),
  // ... other settings
};
```

### Production Deployment

For production environments:

1. **Use environment variables** instead of `.env` file
2. **Set up monitoring** for the sync process
3. **Configure log rotation** if needed
4. **Set up alerts** for upload failures
5. **Test disaster recovery** procedures

## Integration Examples

### Docker Integration

Add to your `docker-compose.yml`:

```yaml
services:
  rosen-monitor:
    # ... existing config
    
  cloudflare-sync:
    build: .
    command: node cloudflare-sync.js
    environment:
      - BASE_URL=${BASE_URL}
      - WRITE_TOKEN=${WRITE_TOKEN}
      - DASH_PASSPHRASE=${DASH_PASSPHRASE}
      - DASH_SALT_B64=${DASH_SALT_B64}
    volumes:
      - ./public:/app/public:ro
      - ./.cloudflare-config.json:/app/.cloudflare-config.json:ro
    depends_on:
      - rosen-monitor
```

### Systemd Service

Create `/etc/systemd/system/rosen-cloudflare-sync.service`:

```ini
[Unit]
Description=Rosen Bridge Cloudflare Sync
After=network.target
Wants=rosen-monitor.service

[Service]
Type=simple
User=rosen
WorkingDirectory=/opt/rosen-monitor
ExecStart=/usr/bin/node cloudflare-sync.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/rosen-monitor/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable rosen-cloudflare-sync
sudo systemctl start rosen-cloudflare-sync
sudo systemctl status rosen-cloudflare-sync
```