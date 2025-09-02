# Quick Start

## 1. Prerequisites
- Node.js (LTS) or Docker
- (Optional) Bash environment for scripts

## 2. Clone
```bash
git clone https://github.com/odiseusme/secure-rb-monitor-public.git
cd secure-rb-monitor-public
```

## 3. Create Runtime Config
```bash
mkdir -p config
cp config.json.example config/config.json
# Edit values if needed
```

## 4. Install Dependencies (Local)
```bash
npm install
```

## 5. Run (Local)
```bash
node static-server.js &
node status-updater.js
```
Access: http://localhost:8080  (or the port selected by `scripts/select_host_port.sh`)

## 6. Run via Docker
```bash
docker build -t rb-monitor .
docker run -p 8080:8080 --name rbm rb-monitor
```

## 7. Using docker-compose
```bash
docker compose up --build
```

## 8. Show URL Helper
```bash
./scripts/show_monitor_url.sh
```

## 9. Updating Status Manually
```bash
node write_status.js
```

## 10. Next Steps
- Explore `status-updater.js` to add new data sources
- Propose improvements via issues / PRs
