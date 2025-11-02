# Invitation Code Retry Logic

## Feature Added

The `register-user.sh` script now allows up to **3 attempts** to enter a valid invitation code, with helpful guidance when all attempts are exhausted.

## User Experience

### First Attempt (Invalid/Used Code)
```
ℹ Starting registration...
Invitation code: INVITE-ALREADY-USED

Registration failed: HTTP 409
{"error":"Invitation code already used"}

⚠ Registration failed due to invalid or used invitation code.

⚠ Attempt 2 of 3
Enter invitation code (or press Ctrl+C to cancel): _
```

### Second Attempt (Still Invalid)
```
ℹ Trying registration with new code...

Registration failed: HTTP 400
{"error":"Invalid invitation code"}

⚠ Registration failed due to invalid or used invitation code.

⚠ Attempt 3 of 3
Enter invitation code (or press Ctrl+C to cancel): _
```

### Third Attempt Failed (Max Attempts Reached)
```
ℹ Trying registration with new code...

Registration failed: HTTP 409
{"error":"Invitation code already used"}

✗ All 3 registration attempts failed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Please contact your administrator to request a fresh
  invitation code. Invitation codes can only be used once.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Successful Registration (Valid Code)
```
ℹ Trying registration with new code...

✓ Registration successful
```

## Technical Details

### Retry Logic

**Retries allowed for:**
- HTTP 400 (Invalid invitation code)
- HTTP 409 (Invitation code already used)
- Any error containing "Invalid invitation" or "already used"

**No retry for:**
- Network errors (worker unreachable)
- Server errors (HTTP 500, etc.)
- Missing dependencies
- File system errors

These fail immediately with actionable error messages.

### Implementation

**Location:** `perform_registration()` function in `scripts/register-user.sh`

**Key Changes:**
1. Added `max_attempts=3` and `attempt` counter
2. Wrapped registration in a `while` loop
3. Clear `INVITE_CODE` on retry to prompt for new input
4. Show attempt counter: "Attempt 2 of 3"
5. Detect invite-related errors with `grep`
6. Show helpful admin contact message after max attempts

**Code Flow:**
```
Attempt 1: User enters code
  ↓
  Success? → Exit with success
  ↓
  Invite error? → Clear code, retry
  ↓
  Other error? → Exit with error
  ↓
Attempt 2: Prompt for new code
  ↓
  (repeat)
  ↓
Attempt 3: Last chance
  ↓
  Success? → Exit with success
  ↓
  Failure? → Show admin contact message, exit
```

## Testing

### Test Invalid Code (3 attempts)
```bash
./scripts/register-user.sh --base-url https://your-worker.workers.dev

# Enter invalid code 3 times
# Expected: Retry prompts, then admin message
```

### Test Valid Code on Retry
```bash
./scripts/register-user.sh --base-url https://your-worker.workers.dev

# Enter invalid code
# Then enter valid code on attempt 2
# Expected: Success message
```

### Test Non-Interactive Mode (No Retry)
```bash
./scripts/register-user.sh --invite INVALID-CODE --base-url URL --generated

# Expected: Fails immediately (no retry in non-interactive mode)
```

## Exit Codes

- `0` - Registration successful
- `1` - User cancelled (Ctrl+C)
- `3` - All retry attempts exhausted (invite code issue)
- Other - System/network errors

## Backup

Original file backed up to: `scripts/register-user.sh.before-retry-logic`

## Files Changed

- `scripts/register-user.sh` - `perform_registration()` function (lines 987-1076)

---

**Result:** Users can now recover from typos or used codes without restarting the entire registration process! 🎉
