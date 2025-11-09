# Multi-Instance & Dual Boot Scenarios

## Current Limitation

**One User Account = One Dashboard**
- Each user registration gets a unique user ID
- Dashboard URL is tied to that single user ID
- All data uploaded from any instance using the same credentials merges into one dashboard

## Problem Scenarios

### Scenario 1: Dual Boot System
- Same physical PC, different OS installations (Ubuntu / Windows)
- Both OS instances register with same invite code
- Result: Both instances share the same dashboard, watcher data gets mixed

### Scenario 2: Multiple Physical PCs
- Ubuntu PC running watchers A, B, C
- Orit's PC running watchers X, Y, Z  
- Both register with same user account
- Result: Dashboard shows all watchers (A, B, C, X, Y, Z) without distinguishing which PC runs which

### Impact
- Cannot identify which instance/PC a watcher belongs to
- Cannot view instances separately
- Troubleshooting becomes difficult ("Which PC is watcher-02 on?")

---

## Current Workaround (Recommended)

### Use Separate User Accounts Per Instance

```bash
# Ubuntu PC - Register with invite code 1
./scripts/register-user.sh --invite INVITE-UBUNTU

# Orit's PC - Register with invite code 2
./scripts/register-user.sh --invite INVITE-ORIT
```

**Result:**
- Two independent dashboards
- Clear separation of instances
- Each dashboard URL shows only its instance's watchers

**Trade-off:**
- Need to manage multiple invite codes
- Need to open different URLs to view different instances
- Cannot see "whole fleet" in one view

---

## Mobile Access with Multiple Instances

When using multiple dashboards on the same phone:

### Option A: Different Browsers
- Instance 1 → Firefox Focus
- Instance 2 → Chrome

### Option B: Bookmarks (Recommended)
1. Scan first QR code → Opens in browser
2. Bookmark with clear name: "Ubuntu PC Watchers"
3. Scan second QR code → Opens in browser
4. Bookmark with clear name: "Orit's PC Watchers"
5. Quick access from browser menu

### Option C: Browser Tabs
- Open both URLs in different tabs
- Switch between tabs as needed

### Option D: Save URLs in Notes
- Copy URL from each PC using `./scripts/show_monitor_url_and_qr.sh`
- Save in phone notes app with descriptive names
- Open from notes when needed

---

## Future Enhancement Options

### Priority 1: Instance Tagging (Medium Effort)

**Implementation:**
- Add instance identifier to each upload
- Tag format: `{hostname}-{instance-id}` 
- Display in UI: "Watcher A (Ubuntu-PC)" vs "Watcher A (Orits-PC)"
- Filter/group by instance in dashboard

**Benefits:**
- Single dashboard can show all instances with clear identification
- Easy to see which PC each watcher belongs to
- No need for multiple user accounts

**Time Estimate:** 4-6 hours

**Changes Required:**
- Modify uploader to include instance identifier
- Update Worker to store instance info with each status
- Update dashboard UI to show instance tags
- Add filtering/grouping controls

---

### Priority 2: Multi-Instance Dashboard with Filtering (High Effort)

**Implementation:**
- Add instance management to Worker
- UI toggles to show/hide specific instances
- Aggregate view + per-instance views
- Instance health status
- Instance comparison tools

**Benefits:**
- Professional fleet management
- See all instances or drill down to specific one
- Compare performance across instances
- Centralized monitoring

**Time Estimate:** 12-16 hours

**Changes Required:**
- Instance registry in Worker KV
- Enhanced data model with instance metadata
- Advanced UI with filtering controls
- Instance health monitoring
- Cross-instance analytics

---

### Priority 3: Unified Fleet Dashboard (Very High Effort)

**Implementation:**
- Central dashboard managing multiple user accounts
- Cross-instance analytics
- Centralized alerting system
- Instance comparison views
- Historical trends across fleet

**Benefits:**
- Enterprise-grade monitoring
- Single pane of glass for entire fleet
- Advanced analytics and reporting
- Automated alerting
- Capacity planning insights

**Time Estimate:** 40+ hours

**Changes Required:**
- Multi-account architecture
- Enhanced Worker with fleet management
- Complete UI redesign
- Alert system with notification channels
- Analytics engine
- Admin panel for fleet management

---

## Recommendations

### For Now (v1.2.x)
✅ **Use separate user accounts per instance**
- Proven workaround
- No code changes needed
- Works immediately
- Admin creates multiple invite codes

### Next Version (v1.3.0)
🎯 **Implement Priority 1 (Instance Tagging)**
- Provides 80% of the value with 20% of the effort
- Single dashboard with instance identification
- Better user experience
- Foundation for future enhancements

### Future (v2.0+)
🚀 **Consider Priority 2 or 3 based on:**
- User demand
- Number of instances per user
- Use case complexity
- Enterprise vs personal use

---

## Technical Implementation Notes

### Instance Identifier Generation

**Option A: Hostname-based**
```javascript
const instanceId = `${os.hostname()}-${Date.now()}`;
```

**Option B: User-configurable**
```bash
# In .env
INSTANCE_NAME="Ubuntu-PC"
```

**Option C: Hybrid (Recommended)**
```bash
# Auto-generated, user can override
INSTANCE_NAME="${HOSTNAME}-monitor"
```

### Data Model Enhancement

**Current:**
```json
{
  "watcherName": "watcher-01",
  "status": "healthy",
  "lastUpdate": "2025-11-07T10:30:00Z"
}
```

**With Instance Tagging:**
```json
{
  "watcherName": "watcher-01",
  "instanceId": "ubuntu-pc-monitor",
  "instanceName": "Ubuntu PC",
  "status": "healthy",
  "lastUpdate": "2025-11-07T10:30:00Z"
}
```

### UI Filtering Controls

```html
<!-- Instance selector -->
<select id="instance-filter">
  <option value="all">All Instances</option>
  <option value="ubuntu-pc-monitor">Ubuntu PC</option>
  <option value="orits-pc-monitor">Orit's PC</option>
</select>

<!-- Instance badge in watcher card -->
<span class="instance-badge">Ubuntu PC</span>
```

---

## Migration Path for Existing Users

### If Implementing Instance Tagging

**Step 1: Update Code**
- Deploy new Worker version
- Update uploader with instance support
- Update dashboard with instance UI

**Step 2: Existing Instances (Backward Compatible)**
- Old uploads without instance ID → Tagged as "default"
- Users can set `INSTANCE_NAME` in .env
- Restart uploader to use new instance name

**Step 3: No User Action Required**
- Fully backward compatible
- Optional enhancement users can enable

---

## Questions & Answers

**Q: Can I rename an instance after setup?**
A: Yes, change `INSTANCE_NAME` in .env and restart uploader

**Q: What if two instances have the same name?**
A: System auto-appends unique suffix: "Ubuntu PC (1)", "Ubuntu PC (2)"

**Q: Can I merge instances back into one view?**
A: Yes, use "All Instances" filter in dashboard

**Q: Does instance tagging affect performance?**
A: Minimal impact, adds ~50 bytes per status update

**Q: Can I delete an instance?**
A: Yes, instance data auto-expires after 7 days of inactivity

---

**Last Updated:** November 7, 2025  
**Version:** 1.0  
**Status:** Planning / Design Document
