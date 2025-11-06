# Multi-Instance Dashboard Issue

**Date:** November 6, 2025  
**Reporter:** User testing  
**Severity:** Medium (affects users running multiple monitor instances)

---

## Problem

When the same user runs **two or more monitor instances** (e.g., monitoring different watchers on different machines), there's no way to distinguish between them in the dashboard view.

### Current Behavior

1. User registers on Machine A → gets `dashboardUrl` in `.cloudflare-config.json`
2. User registers on Machine B with same credentials → gets same `dashboardUrl`
3. Both monitors upload to the **same dashboard URL**
4. `show_monitor_url_and_qr.sh` only shows **one URL** (from `.cloudflare-config.json`)
5. User cannot select "show me Machine A's dashboard" vs "show me Machine B's dashboard"

### Example Scenario

```
Machine A (Ubuntu PC): Monitoring Ergo watchers
  - publicId: KcFwvqd9vUvgS5QL3HpoJGysVhiuY558
  - dashboardUrl: https://...workers.dev/d/KcFwvqd9vUvgS5QL3HpoJGysVhiuY558

Machine B (Orit's PC): Monitoring Bitcoin watchers  
  - publicId: KcFwvqd9vUvgS5QL3HpoJGysVhiuY558 (same user!)
  - dashboardUrl: https://...workers.dev/d/KcFwvqd9vUvgS5QL3HpoJGysVhiuY558 (same!)
```

**Result:** Both machines show the **same combined data** on the dashboard. User cannot view them separately.

---

## Root Cause

### Design Decision
The system uses **one publicId per user account**, not per monitor instance. This is by design for the use case of "one user monitors one set of watchers from one location."

### Storage
- `.cloudflare-config.json` stores ONE `dashboardUrl`
- Worker KV stores data keyed by `publicId`
- No concept of "monitor instance ID" separate from user ID

---

## Impact

**Who is affected:**
- Users running multiple monitors with the same credentials
- Users wanting to monitor different sets of watchers separately
- Users with monitors on multiple machines

**Current workarounds:**
1. Use different user accounts (different invite codes) for each monitor
2. Accept combined dashboard (see all watchers from all instances together)

---

## Potential Solutions

### Option 1: Multi-Instance Support (Major Feature)
**Changes needed:**
- Add "instance name" during registration
- Store multiple dashboard URLs in `.cloudflare-config.json`
- Update `show_monitor_url_and_qr.sh` to ask "which instance?"
- Update Worker to support `/d/:userId/:instanceId` URLs
- Update upload logic to include instance ID

**Complexity:** High  
**Breaking change:** Yes (requires data migration)

### Option 2: Improved Script UX (Quick Fix)
**Changes needed:**
- Add `--instance-name` flag to `show_monitor_url_and_qr.sh`
- Allow user to manually specify which dashboard to show
- Document that users should use different invite codes for separate instances

**Complexity:** Low  
**Breaking change:** No

### Option 3: Dashboard URL Override (Minimal)
**Changes needed:**
- Add `--url` flag to script: `./scripts/show_monitor_url_and_qr.sh --url https://...`
- User manually provides dashboard URL
- Just generates QR for any arbitrary URL

**Complexity:** Minimal  
**Breaking change:** No

### Option 4: Document Current Behavior (No Code Change)
**Changes needed:**
- Add to README: "One user = one dashboard"
- Explain: "For separate dashboards, use different invite codes"
- Update script help text

**Complexity:** None  
**Breaking change:** No

---

## Recommendation

**Short term:** Option 4 (documentation) + Option 3 (URL override flag)
- Quick to implement
- Doesn't break existing functionality  
- Gives power users flexibility

**Long term:** Consider Option 1 if user demand is high
- Requires architectural changes
- Would be v2.0 feature

---

## Proposed Quick Fix

Add to `show_monitor_url_and_qr.sh`:

```bash
# New flag: --url
--url URL            Override dashboard URL (for multi-instance setups)

# Usage example:
./scripts/show_monitor_url_and_qr.sh --url https://worker.dev/d/USER123 --embed-passphrase
```

This lets users with multiple instances manually specify which dashboard URL to show/generate QR for.

---

## Status

- [x] Issue identified
- [ ] Solution chosen
- [ ] Implementation
- [ ] Documentation
- [ ] Testing
