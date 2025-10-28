# Changelog

All notable changes to RBMonitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Security Enhancements (October 28, 2025)

#### Passphrase Storage Security
- **Default OFF**: Passphrase storage now defaults to OFF for security
- **Double Confirmation**: Requires two explicit confirmations to enable passphrase storage
- **File Permissions**: Automatic `chmod 600` on sensitive configuration files (`start-monitoring.sh`)
- **Clear Warnings**: User-visible warnings about plaintext passphrase storage risks

#### Worker Logging Redaction
- **Redaction Utility** (`worker/src/utils/redact.ts`): Comprehensive credential redaction library
  - `redactObject()`: Redacts sensitive fields in nested objects and arrays
  - `redactString()`: Pattern-based redaction for tokens, keys, and Base64 data
  - `redactHeaders()`: Safe HTTP header logging
  - `safeLogError()`: Safe error logging with automatic redaction
  - `safeLogRequest()`: Safe HTTP request logging
  - `containsSensitiveData()`: Validation utility for sensitive data detection

- **Sensitive Field Detection**: Automatic redaction of 17 sensitive field names
  - `password`, `passphrase`, `token`, `secret`, `key`, `api_key`, `apikey`
  - `authorization`, `cookie`, `session`, `credentials`, `salt`, `privatekey`
  - `private_key`, `auth`, `signature`, `bearer`

- **Pattern-Based Redaction**: Detects and redacts common credential formats
  - Bearer tokens (`Bearer abc123...`)
  - JWT tokens (`eyJhbGci...`)
  - API keys (`sk-abc123...`, OpenAI format)
  - GitHub tokens (`ghp_...`)
  - Google API keys (`AIza...`)
  - Long Base64 strings (60+ characters)

- **Safe Logging Applied**: All 8 Worker endpoint files updated
  - `registerUser.ts`, `createUser.ts`, `createInvite.ts`, `deleteUser.ts`
  - `adminStats.ts`, `updateData.ts`, `getBlob.ts`, `serveDashboard.ts`
  - Replaced all `console.error()` with `safeLogError()`
  - Removed DEBUG logs exposing sensitive `userData`

- **Comprehensive Testing**: 21 unit tests covering all redaction scenarios
  - Password/passphrase redaction, nested objects, arrays
  - Bearer tokens, Base64/JWT detection, API key patterns
  - HTTP Headers object, edge cases, infinite recursion prevention
  - All tests passing (21/21)

#### CI/CD Security Scanning
- **Credential Leak Scanner** (`scripts/test-log-hygiene.sh`)
  - Scans scripts and Worker code for hardcoded credentials
  - Detects passwords, tokens, API keys, private keys, database URLs
  - Excludes legitimate configuration patterns
  - Exit code 1 on critical findings

- **GitHub Actions Integration** (`.github/workflows/security.yml`)
  - Runs credential leak scanner on every push/PR
  - Checks for accidental `.env` file commits
  - Enforces log hygiene in CI/CD pipeline

#### ESLint Enforcement
- **No Console Rule** (`.eslintrc.json`)
  - Blocks all `console.*` calls to prevent accidental credential logging
  - Forces use of safe logging wrappers (`safeLogError`, `safeLogRequest`)
  - Zero exceptions allowed

### Changed
- `scripts/register-user.sh`: Passphrase storage now defaults to OFF with double confirmation
- Worker endpoints: All error logging now uses `safeLogError()` instead of `console.error()`
- `SECURITY.md`: Updated with new security implementations and best practices
- Security roadmap: Moved 4 items from "Planned" to "Completed"

### Deprecated
- Direct `console.*` usage in Worker code (now enforced by ESLint)

### Removed
- DEBUG `console.log` statements in `updateData.ts` that exposed sensitive `userData`
- Unsafe error logging in all Worker endpoints

### Fixed
- Credential leak risk from passphrase storage (now defaults OFF)
- Potential credential exposure in Worker logs (now redacted)
- Missing file permissions on sensitive configuration files (now `chmod 600`)

### Security
- **HIGH**: Passphrase storage defaults to OFF, preventing plaintext credential storage
- **HIGH**: Comprehensive Worker log redaction prevents credential leaks
- **MEDIUM**: CI/CD scanning detects accidental credential commits
- **MEDIUM**: ESLint enforcement prevents future credential logging vulnerabilities

## [0.1.0] - 2025-10-XX

### Added
- Initial release with zero-knowledge encryption
- Invitation-based user registration
- Rate limiting (30 reads/hour)
- Comprehensive HTTP security headers
- Container hardening (non-root user, read-only filesystem)

---

**Note**: Security implementations follow OWASP Logging Cheat Sheet and Cloudflare Workers Security Best Practices.
