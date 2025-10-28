# Security Policy

## Supported Versions
Current `main` and latest tagged release (e.g. v0.1.x). Older tags may not receive fixes.

## Implemented Security Features

### HTTP Security Headers (Implemented: October 2025)
The Cloudflare Worker implements comprehensive security headers:

- **Content-Security-Policy**: Prevents XSS and injection attacks with strict resource loading policies
- **Strict-Transport-Security (HSTS)**: Enforces HTTPS in production (max-age=1 year, includeSubDomains, preload)
- **X-Frame-Options**: Prevents clickjacking attacks (DENY)
- **X-Content-Type-Options**: Prevents MIME type sniffing (nosniff)
- **Referrer-Policy**: Controls referrer information leakage (no-referrer)
- **Permissions-Policy**: Disables unnecessary browser features (camera, microphone, geolocation, payment)
- **Cross-Origin-Opener-Policy**: Process isolation (same-origin)
- **Cross-Origin-Resource-Policy**: Additional origin isolation (same-origin)

Environment-aware implementation:
- Development (localhost): All headers except HSTS
- Production: Full header set including HSTS

### Credential Protection & Logging Security (Implemented: October 2025)
- **Secure Passphrase Storage**: Default OFF with double confirmation for persistent passphrase storage
- **File Permissions**: Automatic `chmod 600` on sensitive configuration files
- **Log Redaction**: Comprehensive PII and credential redaction in Worker logs
  - Automatic detection of passwords, tokens, API keys, secrets
  - Pattern-based redaction (Bearer tokens, Base64 encoded data, GitHub tokens, API keys)
  - Safe logging wrappers (`safeLogError`, `safeLogRequest`)
- **CI/CD Security Scanning**: Automated credential leak detection in pre-commit and CI workflows
- **ESLint Enforcement**: `no-console` rule prevents accidental credential logging

### Zero-Knowledge Encryption
- Client-side encryption using Web Crypto API (AES-GCM)
- PBKDF2 key derivation (100,000 iterations)
- Server never sees unencrypted data or passphrases

### Access Control
- Invitation-based user registration
- Rate limiting: 30 reads/hour per user
- Token-based authentication for data updates

### Static Asset Optimization
- Cache-Control headers for performance
- Long-term caching for immutable assets (icons: 1 year)
- Short-term caching for updatable assets (CSS/manifest: 1 day)

## Reporting a Vulnerability
1. **DO NOT** open a public issue for an unpatched vulnerability.
2. **Email**: odiseusme@users.noreply.github.com
   
   Include:
   - Description & impact assessment
   - Reproduction steps / Proof of Concept
   - Suggested remediation (if known)
   - Your contact information for follow-up

**Response timeline**: Acknowledgment within 5 business days.

## Handling Process
- Triage & severity assessment
- Patch preparation in private branch
- Coordinated disclosure timing (if applicable)
- Public release notes outlining impact & fix
- Security advisory published when appropriate

## Security Roadmap

### Completed ✅
- Comprehensive HTTP security headers
- Zero-knowledge encryption architecture
- Rate limiting implementation
- Container hardening (non-root user, read-only filesystem, dropped capabilities)
- **Secure passphrase storage defaults (October 2025)**
- **Comprehensive log redaction utility (October 2025)**
- **Automated credential leak scanning (October 2025)**
- **ESLint no-console enforcement (October 2025)**

### Planned Enhancements 🔄
- Increase PBKDF2 iterations (100k → 300k) with backward compatibility
- Enhanced passphrase strength recommendations (12+ characters)
- Automated dependency scanning (Dependabot)
- Comprehensive security test suite expansion

## Out of Scope
- Vulnerabilities in unmodified upstream dependencies
- Social engineering attacks
- Hosting platform (Cloudflare Workers) security issues
- Physical security of user devices

## Security Best Practices for Users

### For Dashboard Users:
- Use a strong, unique passphrase (12+ characters recommended, 8 minimum enforced)
- Never share your passphrase
- Access dashboard only over HTTPS
- Verify the dashboard URL before entering credentials

### For Server Operators:
- **IMPORTANT**: Always decline passphrase storage when prompted (default: OFF)
- Keep dependencies updated
- Rotate API keys and tokens regularly
- Monitor rate limit logs for suspicious activity
- Use invitation codes securely (don't share publicly)
- Review Worker logs for redacted credentials (indicates potential security issues)

## Acknowledgments
Security improvements informed by:
- OWASP Secure Headers Project
- Cloudflare Workers Security Best Practices
- Web Crypto API specifications
- OWASP Logging Cheat Sheet

---

**Thank you for helping keep RBMonitor secure!**

*Last Updated: October 28, 2025*
