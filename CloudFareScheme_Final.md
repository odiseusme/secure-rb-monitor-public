# Cloudflare Remote Dashboard Scheme - Rosen Bridge Monitor

> **Security Note:**  
> This document does **not** contain any actual credentials, API keys, secrets, or sensitive information.  
> All references to API keys, tokens, and credentials are **examples** or instructions only.

---
_Last updated: 2025-09-13_

---

## Mile-High Overview: Planning & Implementation Process

### 1. Requirements & Decision Making
- User needs: simplicity, minimal burden, mostly public/non-critical data, low cost.
- Security: zero-knowledge server, event-driven updates, minimal attack surface, admin-only backend.
- Operational boundaries: free-tier use, rate limiting, abuse prevention, clear documentation.

### 2. System Architecture & Design
- **Cloudflare Worker:** API endpoints for user creation, data update, dashboard serving. Stores only encrypted blobs.
- **Client Scripts:**
  - **Registration:** Generates encryption key, stores locally, links to code/passphrase (user chooses 8+ digits/letters; minimum length enforced).
  - **Monitor:** Watches data source, encrypts and uploads only on change. Error handling for data source offline; after X failures, sends "offline" status blob.
  - **Dashboard:** Remote viewing, decrypts with code/passphrase, displays formatted data. (Current index.html and style.css are sufficient for mobile/UX. If Cloudflare is down, shows last cached data from browser localStorage with "Last updated X ago - may be stale" warning.)
- **Encryption Library:** AES-GCM (or XChaCha20-Poly1305) for data and key, uses KDF (Argon2id/scrypt) with per-user salt. Explicitly specify KDF baseline parameters in docs (e.g., Argon2id: m=64MB, t=3, p=1).

### 3. Implementation Steps
- API development (Worker endpoints, error responses: 429 for rate limit, 409 for stale revision).
- Script development: registration, monitor (systemd unit example in docs), dashboard.
- Rate limiting and abuse controls in Worker.
- Documentation for users and admins.

### 4. Testing & Iteration
- Test registration, monitor relay, dashboard.
- Simulate edge cases (lost code/passphrase, abuse, quota exceeded, data source offline).
- Refine scripts, Worker logic as needed.

### 5. Deployment & Monitoring
- Deploy Worker and scripts.
- Onboard initial users.
- Monitor usage and Cloudflare analytics.
- Prepare for scaling, paid model, feature updates if needed.

### 6. Maintenance & Evolution
- Update docs/code as needed.
- Respond to feedback.
- Plan for schema migration, billing, admin features as required.

---

## Executive Summary

A secure, user-friendly remote monitoring dashboard using Cloudflare Workers and encrypted data storage. Each user can view node/watcher status via a personal dashboard, protected by a flexible code/passphrase (minimum 8 digits/letters), with all data encrypted end-to-end.

---

## System Components & Technical Details

### 1. Cloudflare Worker (Admin Built)

- **Purpose:** Receives, stores, serves encrypted blobs per user.
- **Routes:**
  - `POST /api/create-user` — Returns `{publicId, writeToken, salt, kdfParams}` (admin-only, protected by API key in Worker Secrets).
  - `POST /api/update` — Requires `Authorization: Bearer <writeToken>`, supports optimistic concurrency via revision/version.
  - `GET /api/blob/{publicId}` — Returns latest `{nonce, ciphertext, tag, rev, schemaVersion}`.
  - `DELETE /api/user/{publicId}` — Admin-only, for privacy/account deletion.
- **Security:**
  - Stores only encrypted data, never sees decrypted content.
  - Authenticates updates with writeToken (never just username).
  - Rate limiting by IP/publicId. 429 for exceed, 409 for stale.
  - CSP: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none';`
  - CORS allowlist.
  - Abuse prevention: 429 discipline, WAF rules, minimal audit logs.
  - KV is used; Durable Objects considered if consistency/staleness issues arise.
  - Audit logs: log IP prefix (/24 IPv4, /48 IPv6), publicId, revision, byteSize, HTTP code.

### 2. User Registration Script

- **Purpose:** Onboard user, set up encryption.
- **Process:**
  - Prompts for code/passphrase (minimum 8 digits/letters).
  - Generates random encryption key and salt.
  - Uses KDF (Argon2id/scrypt, baseline parameters: m=64MB, t=3, p=1) with salt to derive key from code/passphrase.
  - Wraps encryption key with derived key.
  - Stores `{publicId, writeToken, salt, kdfParams, wrappedKey}` locally (0600 perms; script warns users not to sync this file to cloud drives).
  - Provides user with dashboard URL (`/d/{publicId}`).
  - **Key Recovery:** If code/passphrase is lost, user reruns `prepare_build` to reset code if encrypted key is present; script prompts clearly, "Existing key file found. Do you want to set a new code/passphrase for this key? Your old one will no longer work."
  - If both local config and code are lost, **data cannot be recovered** (zero knowledge).

### 3. Data Monitor Script

- **Purpose:** Monitors and relays data.
- **Process:**
  - Watches chosen data source (file, API, etc.).
  - Hashes normalized JSON, compares to last hash saved locally (e.g., last_sent_hash.txt).
  - On change (or if data source offline for X retries), encrypts new data with userKey, includes `{version, issuedAt, prevHash, schemaVersion}` in payload.
  - Uses AES-GCM/XChaCha20-Poly1305 with random nonce per update (nonces must never repeat per key).
  - Posts to Worker with writeToken in Authorization header.
  - Debounce and exponential backoff on errors.
  - Idempotency via HMAC(userKey, nonce|hash) in request header.
  - Local persistence for config/state (0600 perms). Systemd unit example provided in docs.
  - Max blob size per user: 25MB (Cloudflare KV practical limit).

### 4. Dashboard HTML Page

- **Purpose:** User interface for viewing status.
- **Process:**
  - Prompts for code/passphrase (never sent to server).
  - Retrieves encrypted data via `/d/{publicId}`.
  - Decrypts client-side using KDF and local salt (parses kdfParams from API, not hardcoded).
  - Renders data safely (avoid innerHTML, XSS-hardened).
  - Shows issuedAt as "last updated" timestamp, not server clock.
  - If Cloudflare is unreachable, dashboard loads last successful decrypt from browser localStorage and displays warning: "Last updated X ago - may be stale."
  - Accessibility: follows WCAG contrast/fonts guidelines.
  - CSP as above; mobile-first UI.

### 5. Encryption/Decryption Library

- **Purpose:** Handles robust cryptography.
- **Features:**
  - AEAD: AES-GCM/XChaCha20-Poly1305.
  - Per-update random nonce (never repeat per key).
  - KDF: Argon2id/scrypt with per-user salt and admin-configurable parameters.
  - Key wrapping/unwrapping for main data key.
  - Schema versioning and migration support.

---

## User Experience

- User runs registration script, chooses a code/passphrase, receives dashboard URL.
- User customizes monitor script for their data source.
- To view status, user visits dashboard URL and enters code/passphrase.
- All encryption/decryption is seamless and local; only code/passphrase required.
- Mobile UX supported by current dashboard HTML/CSS.
- On failed decryption (wrong passphrase), dashboard gives generic error and increases client-side delay on repeated failures.

---

## Security Model

- **Authentication:** Flexible code/passphrase (minimum 8 digits/letters), never stored or sent in plain text.
- **Encryption:** Random key per user, wrapped with KDF-derived key using salt.
- **Update Authentication:** Write token required for monitor updates.
- **Replay Protection:** Version, issuedAt, prevHash, schemaVersion inside payload; Worker enforces ordering.
- **Dashboard Access:** Served at unguessable publicId URL.
- **Rate Limiting:** Strict limits on update/read endpoints. 429 and 409 documented.
- **Abuse Prevention:** 429s, WAF, admin-only registration, minimal logs.
- **Key Loss:** If code/passphrase lost, user can reset if key file is present; otherwise, must re-register. If both are lost, data cannot be recovered.
- **Data Retention:** Encrypted data/accounts deleted after 6 months of inactivity (clock resets only on write/update, not reads).

---

## Technical Decisions & Minor Considerations

- Minimum 8 digits/letters for code/passphrase.
- Code reset via `prepare_build` if encrypted key file is present; clear user prompt.
- Dashboard mobile/UX: current HTML/CSS sufficient, local cache fallback, WCAG accessibility.
- Max blob size per user: 25MB.
- CSP hardened, explicit policy documented.
- KDF baseline parameters documented; script parses kdfParams from API.
- Audit logs: IP prefix (/24 IPv4, /48 IPv6), publicId, revision, byteSize, HTTP code.
- Admin-only endpoints protected with API key in Worker Secrets.
- Registration: admin-only, no public signup.
- Rate limit strategy: updates (e.g., 5/min), reads (e.g., 30/min).
- KV for now; Durable Objects only if consistency issues arise.
- Token rotation: admin can re-issue writeToken, monitor picks up new token.
- Operational playbook, systemd unit, and user guide included in docs.

---

## Cloudflare Costs & Paid Access Model

- **Current:** Free tier for Workers and KV.
- No payments required; monitor usage and revisit paid model if needed.
- If project grows and costs exceed free tier, paid access may be considered.

---

## Documentation & Operational Playbook

- Threat model: Define scope of defense, expected attacks.
- Key & code policy: Strength, KDF params, rotation/recovery.
- Data schema contract: Stable/optional fields, max sizes, migration.
- Operational playbook: Revoke write tokens, purge accounts, interpret logs, adjust rate limits.
- User guide: Registration, monitor script setup, systemd integration, dashboard use.
- Systemd unit example for monitor script.
- Script warnings for local config sync.
- Decryption failure/lockout flow.

---

## Next Steps

- [ ] Build Worker endpoints and admin controls (with explicit error codes).
- [ ] Script registration, monitor (with error/offline handling), and dashboard (with cache fallback, accessibility).
- [ ] Harden dashboard UX (lockout, CSP, accessibility).
- [ ] Document KDF parameters, schemaVersion, blob size.
- [ ] Finalize retention semantics (writes reset clock).
- [ ] Prepare operational playbook and user guide.

---

_This document will be updated iteratively to reflect design, implementation, and operational decisions as the remote dashboard system evolves._
