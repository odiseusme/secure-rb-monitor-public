# Registration Error Handling Fix

## Problem

The `register-user.sh` script was hiding all output from `setup-cloudflare.js`, including helpful error messages. Users only saw:

```
✗ Registration failed (exit code: 1)
```

Without any explanation of WHY it failed.

## Root Cause

Line 1018 in `scripts/register-user.sh` was redirecting both stdout and stderr to `/dev/null`:

```bash
if BASE_URL="$BASE_URL" node setup-cloudflare.js < "$temp_input" > /dev/null 2>&1; then
```

This meant error messages like these were hidden:
- `"Registration failed: HTTP 400"` (invalid invite code)
- `"Registration failed: HTTP 409"` (invite already used)
- `"ERROR: fetch failed"` (worker not reachable)
- Helpful hints about running the worker locally

## Solution

**Changed line 1018** to show error messages while filtering out verbose success messages:

```bash
if BASE_URL="$BASE_URL" node setup-cloudflare.js < "$temp_input" 2>&1 | grep -v "^Cloudflare Registration\|^Registering with Cloudflare\|^Updating .env\|^Updated .env\|^Passphrase Configuration\|^You need a passphrase\|^This should be strong\|^Keep your .env\|^Found existing .env"; then
```

**Improved error message** (line 1030) to reference the actual error shown:

```bash
die "Registration failed. Check the error message above for details."
```

## Result

Now users will see helpful error messages like:

### Invalid Invite Code
```
ℹ Starting registration...
Registration failed: HTTP 400
{"error":"Invalid invitation code"}

✗ Registration failed. Check the error message above for details.
```

### Invite Already Used
```
ℹ Starting registration...
Registration failed: HTTP 409
{"error":"Invitation code already used"}

✗ Registration failed. Check the error message above for details.
```

### Worker Not Reachable
```
ℹ Starting registration...
TypeError: fetch failed
ERROR: connect ECONNREFUSED

HINT: If you are testing locally, make sure your worker is running, e.g.:
  npx wrangler dev --local --port 38472

✗ Registration failed. Check the error message above for details.
```

## Testing

Test with invalid invite code:
```bash
./scripts/register-user.sh --invite "invalid-code" --base-url https://your-worker.workers.dev --generated
```

Expected: Clear error message explaining why registration failed.

## Backup

Original file backed up to: `scripts/register-user.sh.before-error-fix`

To restore: `cp scripts/register-user.sh.before-error-fix scripts/register-user.sh`

## Files Changed

- `scripts/register-user.sh` (lines 1018 and 1030)
