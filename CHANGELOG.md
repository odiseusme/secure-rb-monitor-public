# Changelog

All notable changes to RBMonitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Security Enhancements (October 2025)


#### Network Egress Security (October 30, 2025)
- **Hostname Allowlisting**: Application-level egress validation prevents unauthorized outbound connections
  - All network requests validated against configurable allowlist
  - Fail-closed security model (process exits on unauthorized connections)
  - Auto-derivation from `CLOUDFLARE_BASE_URL` (zero-config default)
  - Explicit allowlist override via `ALLOWED_EGRESS_HOSTS`
  
- **HTTPS Enforcement**: Blocks HTTP connections by default
  - Configurable via `ALLOW_HTTP=true` for development
  - Auto-enabled in NODE_ENV=development
  
- **IP Literal Blocking**: Prevents connections to raw IP addresses
  - Configurable via `ALLOW_IP_EGRESS=true` for tunnels/development
  - Protects against DNS rebinding attacks
  
- **Redirect Validation**: Validates redirect targets against allowlist
  - Maximum 5 redirect hops to prevent loops
  - Each redirect target validated before following
  - Error codes: `E_EGRESS_REDIRECT`, `E_EGRESS_NO_LOCATION`
  
- **Standardized Error Codes**: 7 structured error codes for monitoring
  - `E_EGRESS_SCHEME`: Invalid protocol (HTTP when disallowed)
  - `E_EGRESS_PORT`: Nonstandard port (not 443/80)
  - `E_EGRESS_IP`: IP literal when blocked
  - `E_EGRESS_HOST`: Hostname not in allowlist
  - `E_EGRESS_CONFIG`: Misconfiguration (missing URL, invalid format)
  - `E_EGRESS_REDIRECT`: Redirect to unauthorized target
  - `E_EGRESS_NO_LOCATION`: Redirect missing Location header
  
- **Performance Optimized**: Minimal overhead
  - Allowlist caching with 300s TTL (signature-based invalidation)
  - Lazy-loading of `net` module
  - < 0.1% performance impact on network calls
  
- **Implementation Files**:
  - `lib/egress-validator.js`: Core validation logic (168 lines, 82% coverage)
  - `lib/safe-fetch.js`: Fetch wrapper with validation (79 lines, 79% coverage)
  - Integrated into `cloudflare-sync.js` and `write_status.js`
  - Comprehensive test suite (30 tests, 81% coverage)
  
- **Infrastructure Support**: Multi-layer defense
  - Docker container configuration examples
  - iptables/ufw firewall rules
  - AWS Security Groups / GCP Firewall Rules
  - Kubernetes NetworkPolicy templates
  - See [SIDECAR_SECURITY.md](SIDECAR_SECURITY.md) for infrastructure hardening

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
- `cloudflare-sync.js`: All `fetch()` calls replaced with `safeFetch()` for egress validation
- `write_status.js`: All `fetch()` calls replaced with `safeFetch()` via `fetchJsonSafe()` wrapper
- `.env.example`: Added comprehensive network egress security configuration documentation
- `docker-compose.yml`: Added `ALLOWED_EGRESS_HOSTS` and Cloudflare environment variables
- `README.md`: Added Network Egress Security section with configuration examples and troubleshooting
- `SECURITY.md`: Updated with network egress security implementation and best practices
- `SIDECAR_SECURITY.md`: Added infrastructure-level egress security hardening guide (238 lines)
- Security roadmap: Moved 5 items from "Planned" to "Completed"

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
- **CRITICAL**: Network egress allowlisting prevents unauthorized outbound connections and data exfiltration
- **HIGH**: Passphrase storage defaults to OFF, preventing plaintext credential storage
- **HIGH**: Comprehensive Worker log redaction prevents credential leaks
- **HIGH**: Redirect validation prevents allowlist bypass via HTTP redirects
- **MEDIUM**: HTTPS enforcement prevents protocol downgrade attacks (configurable for development)
- **MEDIUM**: IP literal blocking prevents DNS rebinding attacks
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
