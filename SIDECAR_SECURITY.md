# RBMonitor Sidecar Security Implementation

This document details the security measures implemented in the RBMonitor sidecar to prevent credential leaks and ensure safe operation.

## Table of Contents
1. [Passphrase Storage Security](#passphrase-storage-security)
2. [Worker Logging Redaction](#worker-logging-redaction)
3. [CI/CD Security Scanning](#cicd-security-scanning)
4. [ESLint Enforcement](#eslint-enforcement)

## Passphrase Storage Security

### Default Configuration: OFF
The sidecar **defaults to NOT storing passphrases**. This is the safest option and is recommended for all production deployments.

### Double Confirmation Required
If a user chooses to store the passphrase (for automated restarts), they must:
1. Explicitly answer "yes" to the storage prompt
2. Confirm again with a second "yes" prompt

### File Permissions
All sensitive configuration files are automatically protected with `chmod 600` (owner read/write only).

### Example Registration Flow
```bash
$ ./scripts/register-user.sh

Would you like to save your passphrase for automatic monitoring restarts?
WARNING: This stores your passphrase in plaintext in start-monitoring.sh
Recommended: Answer 'no' and enter passphrase manually when needed
Save passphrase? (yes/no) [default: no]: no

✓ Passphrase will NOT be saved (secure)
You'll need to enter it manually when starting monitoring
```

## Worker Logging Redaction

### Redaction Utility (`worker/src/utils/redact.ts`)
Comprehensive redaction library that prevents credential leaks in Cloudflare Worker logs.

### Sensitive Field Detection
Automatically redacts fields containing:
- `password`, `passphrase`, `token`, `secret`, `key`
- `api_key`, `apikey`, `authorization`, `cookie`
- `session`, `credentials`, `salt`, `privatekey`
- `auth`, `signature`, `bearer`

### Pattern-Based Redaction
Detects and redacts:
- Bearer tokens: `Bearer abc123...` → `***REDACTED***`
- JWT tokens: `eyJhbGci...` → `***REDACTED***`
- API keys: `sk-abc123...` → `***REDACTED***`
- GitHub tokens: `ghp_...` → `***REDACTED***`
- Google API keys: `AIza...` → `***REDACTED***`
- Long Base64 strings (60+ chars)

### Safe Logging Functions

#### `safeLogError(error, context)`
Safe error logging with automatic redaction:

```typescript
import { safeLogError } from "../utils/redact";

try {
  // Risky operation
  await processUserData(userData);
} catch (error) {
  // ❌ UNSAFE: May leak credentials
  // console.error("Error:", error);
  
  // ✅ SAFE: Automatic redaction
  safeLogError(error, { context: "processUserData", userId: publicId });
}
```

**Output Example:**
```
[ERROR] processUserData
Context: {"context":"processUserData","userId":"abc123"}
Error: {"message":"Authentication failed","token":"***REDACTED***"}
```

#### `safeLogRequest(method, url, status, context)`
Safe HTTP request logging:

```typescript
import { safeLogRequest } from "../utils/redact";

async function handleRequest(c: Context) {
  const method = c.req.method;
  const url = c.req.url;
  
  try {
    const result = await processRequest(c);
    safeLogRequest(method, url, 200, { userId: result.userId });
    return c.json(result);
  } catch (error) {
    safeLogRequest(method, url, 500, { error: "Internal error" });
    safeLogError(error, { context: "handleRequest" });
    return c.json({ error: "Internal server error" }, 500);
  }
}
```

#### `redactObject(obj)`
Redact sensitive fields from objects:

```typescript
import { redactObject } from "../utils/redact";

const userMetadata = {
  publicId: "abc123",
  credentials: {
    api_key: "sk_live_abc123...",
    password: "secret123"
  },
  profile: {
    name: "Alice"
  }
};

const safe = redactObject(userMetadata);
// {
//   publicId: "abc123",
//   credentials: {
//     api_key: "***REDACTED***",
//     password: "***REDACTED***"
//   },
//   profile: {
//     name: "Alice"
//   }
// }
```

#### `redactHeaders(headers)`
Redact sensitive HTTP headers:

```typescript
import { redactHeaders } from "../utils/redact";

const headers = {
  "content-type": "application/json",
  "authorization": "Bearer abc123...",
  "x-api-key": "sk_live_abc123..."
};

const safe = redactHeaders(headers);
// {
//   "content-type": "application/json",
//   "authorization": "***REDACTED***",
//   "x-api-key": "***REDACTED***"
// }
```

#### `containsSensitiveData(value)`
Detect if data contains credentials (for validation):

```typescript
import { containsSensitiveData } from "../utils/redact";

const isSafe = !containsSensitiveData(logMessage);
if (!isSafe) {
  console.warn("Attempted to log sensitive data - blocked");
}
```

## CI/CD Security Scanning

### Automated Credential Leak Detection (`scripts/test-log-hygiene.sh`)
Scans codebase for accidental credential exposure.

### Detected Patterns
- Hardcoded passwords: `PASSWORD=`, `PASS=`
- API tokens: `TOKEN=`, `API_KEY=`
- Private keys: `BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`
- AWS credentials: `AKIA`, `aws_access_key_id`
- Database URLs: `postgres://`, `mysql://`
- Bearer tokens in code
- Passphrases in logs or debug output

### GitHub Actions Integration (`.github/workflows/security.yml`)
Runs automatically on every push and pull request:

```yaml
- name: Run credential leak scanner
  run: ./scripts/test-log-hygiene.sh

- name: Check for .env files in repository
  run: |
    if find . -name ".env*" -not -path "./node_modules/*" | grep -q .; then
      echo "Error: .env files found in repository"
      exit 1
    fi
```

### Running Locally
```bash
$ ./scripts/test-log-hygiene.sh
Scanning for credential leaks in scripts and Worker code...
✓ No critical credential leaks detected
```

## ESLint Enforcement

### No Console Rule (`.eslintrc.json`)
Prevents accidental credential logging by blocking all `console.*` calls:

```json
{
  "rules": {
    "no-console": ["error", { "allow": [] }]
  }
}
```

### Enforced Usage
- ❌ `console.log()` → ESLint error
- ❌ `console.error()` → ESLint error
- ❌ `console.warn()` → ESLint error
- ✅ `safeLogError()` → Allowed
- ✅ `safeLogRequest()` → Allowed

### Integration with CI/CD
```bash
# Run linting as part of build process
npm run lint

# Expected output for violations:
# error  Unexpected console statement  no-console
```

## Testing

### Unit Tests (`worker/src/utils/redact.test.ts`)
Comprehensive test suite with 21 test cases covering:

- Password and passphrase redaction
- Nested object handling
- Array redaction
- Bearer token detection
- Base64 encoded data (JWT tokens)
- API key patterns
- HTTP Headers object
- Edge cases (null, undefined, primitives)
- Infinite recursion prevention

### Running Tests
```bash
cd worker/mute-mouse-2cd2
npm test
```

**Expected Output:**
```
✓ src/utils/redact.test.ts (21 tests)
  ✓ redactObject (5)
  ✓ redactString (4)
  ✓ redactHeaders (4)
  ✓ containsSensitiveData (4)
  ✓ edge cases (4)

Test Files  1 passed (1)
Tests  21 passed (21)
```

## Security Checklist

Before deploying:
- [ ] Passphrase storage is OFF (default)
- [ ] Log hygiene scanner passes (`./scripts/test-log-hygiene.sh`)
- [ ] All Worker endpoints use `safeLogError` instead of `console.error`
- [ ] Redaction unit tests pass (21/21)
- [ ] ESLint no-console rule enabled
- [ ] GitHub Actions security workflow enabled
- [ ] `.env` files excluded from git (`.gitignore`)
- [ ] Sensitive configuration files have `chmod 600`

## Reporting Security Issues

See [SECURITY.md](SECURITY.md) for vulnerability reporting process.

---

**Last Updated: October 28, 2025**
