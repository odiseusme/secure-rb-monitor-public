# Rosen Bridge Monitor - Future Enhancements

## UI/UX Improvements
- [ ] Show unreachable watcher status in UI (red indicator, error badge)
- [ ] Desktop shortcut/launcher for prepare_build.sh script
- [ ] Interactive watcher add/remove from UI
- [ ] Y/n prompts for building after discovery
- [ ] Progress bars for permit utilization
- [ ] Mobile-responsive layout improvements
- [ ] Dark mode toggle

## Monitoring & Alerts
- [ ] change registration to cloudflare service to self-serve
- [ ] Email/webhook alerts for watcher failures
- [ ] Historical status tracking and charts
- [ ] Performance metrics (response times, uptime %)
- [ ] Configurable alert thresholds
- [ ] Status change notifications

## Technical Enhancements  
- [ ] TypeScript migration
- [ ] Structured logging with log rotation
- [ ] Prometheus metrics export
- [ ] Health check endpoint improvements
- [ ] Configuration validation
- [ ] Automated testing suite
- [ ] CI/CD pipeline improvements
- [ ] load-balancing of cloudflare calls

## Operations
- [ ] Backup/restore procedures
- [ ] Multi-environment support (dev/staging/prod)
- [ ] Load balancing for multiple monitor instances
- [ ] Database persistence option
- [ ] Configuration management improvements

# TODO more

- [ ] **Frontend Robustness:** Patch index.html to safeguard against non-object or missing permitStatus (see last Copilot suggestion for ready code)
- [x] **Backend Normalization:** Always output permitStatus as an object in status.json (**DONE**)
- [ ] **Debug Watcher Down UI:** Once above fixes are live, re-test UI and status for down/unknown watchers
- [ ] **General Testing:** After next session, verify overall system health and dashboard accuracy
