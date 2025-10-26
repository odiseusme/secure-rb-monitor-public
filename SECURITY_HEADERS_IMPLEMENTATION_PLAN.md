Security Headers Implementation Plan

Date: 2025-10-26
Priority: Critical (Missing security feature documented as implemented)
Estimated Time: 3–5 hours
Status: Ready for implementation

Note: Earlier, an uploaded SECURITY_HEADERS_IMPLEMENTATION_PLAN.md could not be parsed by the system; these documents can only be used in code execution. Common causes: encoding issues, truncated uploads, or non-text/binary markdown exports.

🎯 Objective

Implement comprehensive security headers in the Cloudflare Worker to protect against XSS, clickjacking, MIME sniffing, and related web risks. This closes the critical gap where headers were documented as implemented but were missing at runtime.

📌 Scope and Principles

Apply headers centrally via middleware to cover all responses consistently.

Keep application code changes minimal (prefer secureResponse and addSecurityHeaders helpers).

If needed, validate CSP with a short Report-Only phase before full enforcement.

Avoid inline allowances when possible; if needed, prefer nonces over 'unsafe-inline'.

✅ Final Header Set (Baseline)

These values reflect a strict baseline tuned for the current RBMonitor dashboard and Worker.

Content-Security-Policy (CSP)

Enforced value:
default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'

If you want a two-phase rollout, first use the same value in Content-Security-Policy-Report-Only for 1–2 weeks and fix violations.

X-Frame-Options: DENY

X-Content-Type-Options: nosniff

Referrer-Policy: no-referrer

Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

Only meaningful over HTTPS (production).

Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

Suggested additions (safe and useful):

Cross-Origin-Opener-Policy: same-origin

Cross-Origin-Resource-Policy: same-origin

Cache guidance:

Dynamic endpoints: Cache-Control: no-store

Static assets (if fingerprinted): Cache-Control: public, max-age=31536000, immutable

📋 Implementation Steps
Step 1: Create Security Headers Helper Module (≈5 minutes)

File: worker/mute-mouse-2cd2/src/security.ts

/**
 * Security headers for all responses
 */
export const SECURITY_HEADERS = {
  // Content Security Policy - prevents XSS
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'", // TODO: Replace with nonces once inline CSS is removed
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; '),

  // Prevent clickjacking (legacy and complements CSP frame-ancestors)
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Control referrer information
  'Referrer-Policy': 'no-referrer',

  // HTTPS enforcement (only effective in production over HTTPS)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Disable unnecessary features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

  // Cross-origin hardening (safe defaults)
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

/**
 * Add security headers to any Response
 */
export function addSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value as string);
  }

  return newResponse;
}

/**
 * Create a new Response with security headers
 */
export function secureResponse(body: BodyInit | null, init?: ResponseInit): Response {
  const response = new Response(body, init);
  return addSecurityHeaders(response);
}

/**
 * Optional helper for dynamic endpoints to force no-store
 */
export function noStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers || {});
  headers.set('Cache-Control', 'no-store');
  return { ...init, headers };
}

Step 2: Update Main Worker File (≈20 minutes)

File: worker/mute-mouse-2cd2/src/index.ts

2a. Import helpers at the top:

import { addSecurityHeaders, secureResponse /*, noStore*/ } from "./security";


2b. Add middleware for automatic header injection (after app creation, before routes):

// Add security headers to all responses
app.use('*', async (c, next) => {
  await next();
  if (c.res) {
    c.res = addSecurityHeaders(c.res);
  }
});


2c. Update routes that build raw responses to use helpers:

Health check:

// BEFORE:
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// AFTER:
app.get("/health", (c) => {
  const response = c.json({ status: "ok", timestamp: new Date().toISOString() });
  return addSecurityHeaders(response);
});


CSS:

// BEFORE:
app.get("/style.css", (c) =>
  c.text(STYLE_CSS, 200, { "Content-Type": "text/css; charset=utf-8" })
);

// AFTER:
app.get("/style.css", (c) => {
  return secureResponse(STYLE_CSS, {
    status: 200,
    headers: { "Content-Type": "text/css; charset=utf-8" }
  });
});


Favicon:

// BEFORE ... (manual Uint8Array response)

// AFTER:
app.get("/favicon.ico", (c) => {
  const binaryString = atob(FAVICON_ICO_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return secureResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=86400"
    }
  });
});


Icons:

// AFTER:
app.get("/icons/owlHeadA_180.png", (c) => {
  return secureResponse(
    Uint8Array.from(atob(OWL_ICON_180_BASE64), ch => ch.charCodeAt(0)),
    { status: 200, headers: { "Content-Type": "image/png" } }
  );
});


Manifest:

// AFTER:
app.get("/site.webmanifest", (c) => {
  return secureResponse(MANIFEST_JSON, {
    status: 200,
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" }
  });
});


Optional: ensure dynamic JSON endpoints are no-store:

// Example for a JSON API route
app.get("/api/status", (c) => {
  const body = { ok: true, ts: Date.now() };
  // return secureResponse(JSON.stringify(body), noStore({ status: 200, headers: { "Content-Type": "application/json" }}));
  return c.json(body); // middleware will add security headers; caching can be handled upstream
});

Step 3: Backup Original File (≈1 minute)
cp worker/mute-mouse-2cd2/src/index.ts worker/mute-mouse-2cd2/src/index.ts.backup

Step 4: Validate Endpoint Modules (≈60–90 minutes)

Directory: worker/mute-mouse-2cd2/src/endpoints/

Files:

adminStats.ts

createInvite.ts

createUser.ts

deleteUser.ts

getBlob.ts

registerUser.ts

serveDashboard.ts

updateData.ts

Verify:

No manual header sets that conflict with the middleware.

JSON responses use c.json() (middleware adds headers).

Raw responses use secureResponse(...).

Sensitive endpoints do not accidentally set permissive CORS or caching headers.

Quick scan:

grep -nriE "headers|cors|cache-control|content-security-policy" worker/mute-mouse-2cd2/src/endpoints/

Step 5: Local Testing (≈30–60 minutes)

5a. Start local dev:

cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local


5b. Run header tests (if present):

./worker/mute-mouse-2cd2/test-security-headers.sh


5c. Manual checks:

curl -I http://localhost:38472/health
curl -I http://localhost:38472/d/test123
curl -I http://localhost:38472/style.css
curl -I http://localhost:38472/favicon.ico


Expected key headers:

Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'

X-Frame-Options: DENY

X-Content-Type-Options: nosniff

Referrer-Policy: no-referrer

Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

Cross-Origin-Opener-Policy: same-origin

Cross-Origin-Resource-Policy: same-origin

Optional validation script snippet:

set -euo pipefail
URL=${1:-http://localhost:38472/health}
curl -sI "$URL" | awk 'BEGIN{IGNORECASE=1}
  /content-security-policy/ {csp=1}
  /x-frame-options/ {xfo=1}
  /x-content-type-options/ {xcto=1}
  /referrer-policy/ {rp=1}
  /strict-transport-security/ {hsts=1}
  /permissions-policy/ {pp=1}
  /cross-origin-opener-policy/ {coop=1}
  /cross-origin-resource-policy/ {corp=1}
  END{
    if(!csp||!xfo||!xcto||!rp||!pp||!coop||!corp){exit 2}
  }'
echo "All expected headers present"

Step 6: Production Deployment (≈30 minutes)

6a. Deploy:

cd worker/mute-mouse-2cd2
wrangler deploy


6b. Test production:

WORKER_URL="https://your-worker.workers.dev"
curl -I $WORKER_URL/health
curl -I $WORKER_URL/style.css


6c. Functional smoke test:

Register test user.

Load dashboard and verify decryption flow.

Check DevTools Network tab for headers (and CSP violations console).

🛡️ Security Headers Explained (Quick Reference)

Content-Security-Policy: Primary XSS defense; restricts resource loading.

X-Frame-Options: Clickjacking protection (legacy complement to CSP's frame-ancestors).

X-Content-Type-Options: Disables MIME sniffing.

Referrer-Policy: Prevents referrer leakage.

Strict-Transport-Security: Enforces HTTPS for subsequent requests.

Permissions-Policy: Disables unneeded browser features.

Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy: Safer cross-origin defaults.

🔍 CSP Rollout Strategy (Optional but Recommended)

Phase 1 (Report-Only for 1–2 weeks):

Add Content-Security-Policy-Report-Only with the same directives and a report-to endpoint (see "Overkill" section for report ingestion).

Phase 2 (Enforce):

Switch to Content-Security-Policy, keep report-only for a short overlap.

Phase 3:

Replace 'unsafe-inline' styles with nonces or external CSS to tighten CSP.

Example CSP-RO:

Content-Security-Policy-Report-Only: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'

✅ Validation Checklist

Pre-Deployment

security.ts created and exported correctly

index.ts imports and middleware added

Static routes switched to secureResponse(...)

Local Wrangler dev runs without errors

Header tests pass on key endpoints

Manual curls show expected headers

Dashboard loads and works with headers

Post-Deployment

Production endpoints return headers

Dashboard, registration, decryption flows succeed

No CSP violations impacting UX

No sensitive info exposed in headers

HSTS present (HTTPS)

Security Verification

CSP blocks unauthorized sources

No caching of dynamic sensitive responses (where applicable)

No permissive CORS unexpectedly enabled

No inline script/style unless justified

🚨 Rollback Plan
Immediate rollback:
cd worker/mute-mouse-2cd2
cp src/index.ts.backup src/index.ts
wrangler deploy

Remove security module if needed:
rm src/security.ts

Verify rollback:
curl -I https://your-worker.workers.dev/health
# Security headers will no longer be present

📝 Notes and Recommendations

'unsafe-inline' in style-src is allowed for now to avoid regressions. Plan to remove it by:

Moving inline styles to CSS files, or

Using nonces: style-src 'self' 'nonce-<dynamic>' and adding nonces at render time.

Add a small CI check that curls staging/prod and asserts headers exist (prevents regressions).

If the app uses third-party resources in the future (analytics/fonts), explicitly list them in CSP and add SRI for scripts/styles.

🔄 Next Steps (After Implementation)

Update documentation to reflect "Implemented" status.

Run a security scan (e.g., Mozilla Observatory / OWASP ZAP) and capture before/after.

Monitor for CSP console violations during real usage.

Plan removal of 'unsafe-inline' for styles with nonces or external CSS.

Reassess Permissions-Policy based on actual features needed.

🧭 What may be Overkill (Keep listed for future, not required now)

These are valuable in larger, more complex deployments, but may be beyond current needs. Retain for roadmap:

CSP Reporting Pipeline:

A report-to endpoint with rate limiting, PII scrubbing, and dashboards.

Cloudflare Worker endpoint or Logpush to storage + analytics.

COOP/COEP for Cross-Origin Isolation:

Needed only for features like SharedArrayBuffer.

Enabling COEP: require-corp implies third-party resources must serve CORP/CORS headers.

Fine-grained Permissions-Policy:

Enumerate many features (e.g., fullscreen, hid, serial, usb, vr, bluetooth) to empty sets.

Current baseline is adequate; expand only if features are introduced.

Per-Route Header Variants:

Different CSPs for dashboard vs. API vs. static assets.

Adds maintenance overhead; centralized policy is simpler for now.

Automated SRI enforcement for third-party assets:

Only needed if you adopt third-party scripts/styles.

Nonce/Hash-based CSP immediately:

Worth it eventually, but requires code refactors; phase in later.

Strong caching partitioning and Vary tuning:

Useful at scale/CDN complexity; not necessary immediately.
⏱️ Estimates

Implementation: 1–2 hours

Endpoint validation: 1–1.5 hours

Testing + deploy: 1–1.5 hours

Total: 3–5 hours (Low risk, high impact)
