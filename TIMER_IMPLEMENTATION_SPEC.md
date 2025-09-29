# DUAL TIME KEEPING SYSTEM - SIMPLIFIED SPECIFICATION

## DEVELOPMENT METHODOLOGY

**CRITICAL: Step-by-Step Development Process**

When implementing this specification, development must proceed in a controlled, incremental manner:

1. **One Step at a Time**: The developer (Claude) provides ONE specific command or code change at a time
2. **Wait for Confirmation**: After each step, STOP and wait for the user to:
   - Execute the command
   - Paste the results
   - Confirm with "done" before proceeding
3. **Frequent Commits**: Commit work every few logical changes to prevent loss of progress
4. **Update Documentation**: After each commit, update this specification to reflect completed work
5. **Complete Commands**: All commands must include the full path from the project root (`~/projects/secure-rb-monitor-public/`)
6. **No Assumptions**: Never assume a step succeeded - always wait for confirmation

This methodology exists because AI sessions can terminate unexpectedly, the user is a non-dev, though otherwise highly intelligent and creative, and incremental progress with commits ensures work is never lost.

---

## SYSTEM OVERVIEW

A monitoring system that reads `status.json` written by `write_status.js`, processes it via `cloudflare-sync.js`, and displays health status on a web dashboard via `dashboard_html.ts` using Cloudflare Workers for data transport.

**Key Simplifications:**
- Single hash system (data only, use filesystem mtime for liveness)
- Time-based uploads (no counter state to manage)
- Sequence numbers for audit trail
- UTC clock-synchronized timing (deterministic, no drift)

---

## 1. DATA STRUCTURES

### 1.1 Variables (Backend - cloudflare-sync.js)

```javascript
// Hash tracking
dataHash = null         // Hash of status.json excluding lastUpdate field
prevDataHash = null     // Previous dataHash value for comparison

// Timestamps
monitorStartTime = null       // ISO timestamp when monitor came online/restarted
lastDataChangeTime = null     // ISO timestamp of last actual data change
lastUploadTime = null         // ISO timestamp of last upload (any type)

// Sequence tracking
sequenceNumber = 0            // Monotonically increasing upload counter (never resets)

// Intervals - synchronized to UTC clock
WRITE_TIMES = [0, 30]         // Seconds past each minute when write_status writes
CHECK_TIMES = [2, 32]         // Seconds past each minute when cloudflare-sync checks
HEARTBEAT_INTERVAL = 300000   // 5 minutes in milliseconds
```

### 1.2 Variables (Frontend - dashboard_html.ts)

```javascript
// Received from backend
monitorStartTime        // From uploaded payload
lastDataChangeTime      // From uploaded payload
sequenceNumber          // From uploaded payload (for debugging/audit)

// Local tracking
lastUploadReceivedTime  // Browser timestamp when last upload received
lastSequenceNumber      // Track sequence to detect gaps

// Display states
monitorStatus = "Monitor alive since:" | "Monitor unstable" | "Monitor offline"
dotColor = "green" | "orange" | "red"
```

### 1.3 Upload Payload Format

```javascript
{
  // Encrypted wrapper (existing implementation)
  nonce: "...",
  ciphertext: "...",
  version: 4001,
  issuedAt: "2025-09-29T10:30:00.000Z",
  schemaVersion: 1,
  
  // NEW FIELDS TO ADD:
  monitorStartTime: "2025-09-29T08:00:00.000Z",   // When monitor came online
  lastDataChangeTime: "2025-09-29T10:15:23.000Z", // When data last changed
  uploadType: "data" | "heartbeat",               // Type of upload
  sequenceNumber: 1042                            // Monotonic upload counter
}

// Decrypted inner content remains status.json structure
```

---

## 2. BACKEND LOGIC (cloudflare-sync.js)

### 2.1 Initialization

```javascript
On startup:
1. Load previous state from .last-sync-hash file (if exists):
   - prevDataHash
   - version
   - sequenceNumber
   - lastUploadTime
   
2. Set timestamps to initial values:
   - monitorStartTime = null (will be set on first upload)
   - lastDataChangeTime = null (will be set on first data change)
```

### 2.2 Clock-Synchronized Timing

```javascript
function scheduleNextCheck():
  const now = new Date()
  const currentSeconds = now.getUTCSeconds()
  
  // Find next check time (either :02 or :32)
  let nextCheckSeconds
  if (currentSeconds < 2):
    nextCheckSeconds = 2
  else if (currentSeconds < 32):
    nextCheckSeconds = 32
  else:
    nextCheckSeconds = 62  // Next minute's :02
  
  const secondsUntilNext = (nextCheckSeconds - currentSeconds + 60) % 60
  const msUntilNext = secondsUntilNext * 1000 - now.getUTCMilliseconds()
  
  setTimeout(checkAndSync, msUntilNext)
```

### 2.3 Main Check Logic (At :02 and :32 of each minute)

```javascript
async function checkAndSync():
  
  1. READ status.json file and get file stats
     const stats = fs.statSync(STATUS_FILE)
     const fileMtime = stats.mtime
     const statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
  
  2. CALCULATE DATA HASH (excluding lastUpdate):
     const dataForHash = { ...statusData }
     delete dataForHash.lastUpdate
     const dataHash = SHA256(normalizeJson(dataForHash))
  
  3. DETERMINE UPLOAD TYPE:
  
     const now = Date.now()
     const timeSinceLastUpload = now - lastUploadTime
     const dataChanged = (dataHash !== prevDataHash)
     
     let uploadType = null
     
     IF dataChanged:
       uploadType = "data"
       lastDataChangeTime = now
       IF monitorStartTime === null:
         monitorStartTime = now
     
     ELSE IF timeSinceLastUpload >= HEARTBEAT_INTERVAL:
       // 5+ minutes since last upload, send heartbeat
       uploadType = "heartbeat"
       IF monitorStartTime === null:
         monitorStartTime = now
     
     ELSE:
       uploadType = null  // No upload needed
  
  4. EXECUTE UPLOAD IF NEEDED:
  
     IF uploadType !== null:
       a. Increment sequence number:
          sequenceNumber = sequenceNumber + 1
       
       b. Build encrypted payload including:
          - Full status.json data
          - monitorStartTime
          - lastDataChangeTime
          - uploadType
          - sequenceNumber
       
       c. POST to Cloudflare Worker /api/update
       
       d. IF upload successful:
          - prevDataHash = dataHash
          - lastUploadTime = now
          - version = version + 1
          - Save state to .last-sync-hash file
  
  5. SCHEDULE next check:
     scheduleNextCheck()
```

### 2.4 Recovery After Outage

```javascript
WHEN monitor comes back online after 630+ second outage:
  - First check will detect either data change or 5+ minute gap
  - Upload will occur with fresh monitorStartTime = NOW()
  - This resets TimerA on dashboard to 00:00
  - Sequence number continues incrementing (never resets)
```

### 2.5 Persistent State File Format

```json
{
  "prevDataHash": "a1b2c3d4...",
  "version": 4015,
  "sequenceNumber": 1042,
  "lastUploadTime": "2025-09-29T10:30:02.000Z",
  "monitorStartTime": "2025-09-29T08:00:02.000Z",
  "lastDataChangeTime": "2025-09-29T10:15:32.000Z",
  "timestamp": "2025-09-29T10:30:02.000Z"
}
```

---

## 3. FRONTEND LOGIC (dashboard_html.ts)

### 3.1 Data Reception

```javascript
WHEN new data received from /api/blob/${PUBLIC_ID}:
  
  1. Decrypt payload
  
  2. Extract metadata:
     monitorStartTime = payload.monitorStartTime
     lastDataChangeTime = payload.lastDataChangeTime
     sequenceNumber = payload.sequenceNumber
  
  3. Check for missing sequences (optional diagnostic):
     IF lastSequenceNumber exists AND sequenceNumber > lastSequenceNumber + 1:
       const missed = sequenceNumber - lastSequenceNumber - 1
       console.warn(`Missed ${missed} upload(s). Sequence gap detected.`)
     lastSequenceNumber = sequenceNumber
  
  4. Update local tracking:
     lastUploadReceivedTime = NOW()
  
  5. Render watcher data (existing implementation)
  
  6. Update status display (see 3.2)
```

### 3.2 Status Display Update (runs every 1 second via setInterval)

```javascript
EVERY 1 second:
  
  const now = NOW()
  
  // Calculate elapsed times
  const uptimeMs = now - monitorStartTime
  const dataAgeMs = now - lastDataChangeTime
  const commHealthMs = now - lastUploadReceivedTime
  
  // Update TimerA (Monitor Uptime)
  document.getElementById('timerA').textContent = formatDuration(uptimeMs)
  
  // Update TimerB (Last Data Update)
  document.getElementById('timerB').textContent = formatDuration(dataAgeMs)
  
  // Update dot color and monitor status
  IF commHealthMs < 330000:  // 0-329 seconds
    dotColor = "green"
    monitorStatus = "Monitor alive since:"
  
  ELSE IF commHealthMs < 630000:  // 330-629 seconds
    dotColor = "orange"
    monitorStatus = "Monitor unstable"
  
  ELSE:  // 630+ seconds
    dotColor = "red"
    monitorStatus = "Monitor offline"
  
  // Update DOM elements
  document.getElementById('statusDot').className = dotColor
  document.getElementById('monitorStatus').textContent = monitorStatus
```

### 3.3 Duration Formatting

```javascript
function formatDuration(milliseconds):
  
  const totalSeconds = Math.floor(milliseconds / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)
  
  IF totalMinutes < 60:
    // Format: MM:SS
    const mm = String(totalMinutes).padStart(2, '0')
    const ss = String(totalSeconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  
  ELSE IF totalHours < 24:
    // Format: HH:MM
    const hh = String(totalHours).padStart(2, '0')
    const mm = String(totalMinutes % 60).padStart(2, '0')
    return `${hh}:${mm}`
  
  ELSE:
    // Format: Dd HHh
    const d = totalDays
    const h = totalHours % 24
    return `${d}d ${h}h`
```

### 3.4 Dashboard Display Structure

```html
<div class="monitor-status-line">
  <span class="status-dot" id="statusDot"></span>
  <span id="monitorStatus">Monitor alive since:</span>
  <span id="timerA">00:00</span>
  <span class="separator">|</span>
  <span>Last data update:</span>
  <span id="timerB">00:00</span>
  <span>ago</span>
</div>
```

---

## 4. IMPLEMENTATION PROGRESS TRACKING

### Completed Steps:
- [x] Branch created: `monitor-timers-claude`
- [ ] Specification file created

### Backend Implementation (cloudflare-sync.js):
- [ ] Add new state variables
- [ ] Implement clock-synchronized timing
- [ ] Update hash calculation (single hash)
- [ ] Add sequence number tracking
- [ ] Modify payload structure
- [ ] Update state persistence

### Frontend Implementation (dashboard_html.ts):
- [ ] Add HTML for timer display
- [ ] Implement formatDuration function
- [ ] Add timer update setInterval
- [ ] Extract new payload fields
- [ ] Implement dot color logic
- [ ] Add CSS for status display

### Testing:
- [ ] Test normal operation
- [ ] Test data changes
- [ ] Test heartbeat uploads
- [ ] Test offline detection
- [ ] Test recovery from outage

---

## 5. CONSTANTS REFERENCE

```javascript
// Timing (UTC clock-synchronized)
WRITE_TIMES = [0, 30]              // Seconds past minute when writes occur
CHECK_TIMES = [2, 32]              // Seconds past minute when checks occur
HEARTBEAT_INTERVAL = 300000        // 5 minutes (time-based, not count-based)
UNSTABLE_TIMEOUT = 330000          // 5.5 minutes
OFFLINE_TIMEOUT = 630000           // 10.5 minutes

// Timer Display Breakpoints
TIMER_FORMAT_HOUR = 60 minutes
TIMER_FORMAT_DAY = 24 hours
```
