# Rosen Bridge Monitor — CSP Inline Script Challenge: Plan & Status

**Scope:** Cloudflare Worker dashboard (route `/d/:publicId`).  
**Context doc cited:** CSP_Inline_Script_Issue_and_Solutions.md  (see in-repo). :contentReference[oaicite:0]{index=0}

---

## 1) Problem summary

- The dashboard HTML contained **inline `<script>`** for login/decrypt/auto-refresh.
- Our CSP used **script hashes** to allow inline code. Hashes are **brittle**: any template change breaks them, causing the browser to block the script and the UI to fail.  
- Result: frequent breakage and risky temptation to relax CSP globally (e.g., `'unsafe-inline'`).

**Risk:** Degraded DX and potential weakening of CSP if we workaround incorrectly.

---

## 2) Solution paths we considered

**Path 1 — Nonce-based CSP (chosen now):**
- Generate a **unique nonce per request** in the Worker.
- Add CSP: `script-src 'self' 'nonce-<nonce>'` and `script-src-attr 'none'`.
- Inject `nonce="<nonce>"` into the inline `<script>` in the template at render time.
- Keep `style-src 'self' 'unsafe-inline'` temporarily to avoid CSS refactors.
- Constrain `connect-src` to the Worker origin only.
- Optional hardening: `require-trusted-types-for 'script'` (Chrome/Edge enforce; Firefox ignores, which is fine).

**Path 2 — Externalize scripts (preferred long-term):**
- Move all inline JS into versioned `.js` files served from the Worker (e.g., `/app/dashboard.js`).
- CSP simplifies to `script-src 'self'` (no nonce needed).
- Also remove inline styles → `style-src 'self'`.
- Best for maintainability; requires a small refactor of dashboard code.

(Other options, and why we didn’t choose them now)
- Route-specific weakening with `'unsafe-inline'`: fastest but reduces protection on the most sensitive route.
- Keep updating hashes: operationally fragile.
- Disable CSP / report-only: not acceptable in production.

---

## 3) What we implemented (Path 1)

- **Per-request nonce CSP** for `/d/:publicId`:
  - `script-src 'self' 'nonce-<RANDOM>'`
  - `script-src-attr 'none'`
  - `style-src 'self' 'unsafe-inline'` (temporary)
  - `img-src 'self' data: blob:`
  - `connect-src <worker-origin-only>`
  - `base-uri 'none'`, `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`
  - `require-trusted-types-for 'script'` (Chrome/Edge enforce; Firefox ignores with a benign console note)
- **Template injection:** The Worker injects `nonce="..."` into the single inline `<script>` block at render time.
- **Global security headers** preserved for all other routes (HSTS in prod, XFO=DENY, nosniff, CORP/COOP, Referrer-Policy, Permissions-Policy, etc.).
- **Dev ergonomics (local only):**
  - Localhost can render `/d/:publicId` without KV presence (bypass in dev only).
  - We temporarily added a dev root redirect; **now removed** per request.

**Observed result in dev:**  
- `Content-Security-Policy` for `/d/:publicId` shows `script-src 'self' 'nonce-…'` and a request-scoped nonce value.
- Browser renders dashboard normally; no CSP violations. Firefox logs an “unknown directive” notice for `require-trusted-types-for` (expected/harmless).

---

## 4) Next steps (Path 2 work items)

1. **Externalize the inline script**  
   - Create `src/frontend/dashboard.js` (or similar), move code currently in the inline `<script>` there.  
   - Replace the inline tag with `<script src="/app/dashboard.js" defer></script>`.  
   - Update CSP for `/d/:publicId` to **remove the nonce** and use `script-src 'self'` only.

2. **Remove inline styles**  
   - Move remaining inline style attributes / blocks into `style.css`.  
   - Change CSP to `style-src 'self'` (drop `'unsafe-inline'`).

3. **(Optional) Trusted Types policy**  
   - Add a minimal policy (e.g., `window.trustedTypes.createPolicy('rbmonitor', { createHTML: x => x, createScriptURL: x => x })`) once scripts are externalized.  
   - Keep `require-trusted-types-for 'script'` in CSP.

**Acceptance criteria for Path 2 completion**
- No inline scripts or inline styles remain.
- CSP for dashboard is:
  - `default-src 'self'; script-src 'self'; style-src 'self'; connect-src <worker-origin-only>; img-src 'self' data: blob:; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'`
- No console violations on Chrome/Edge/Firefox/Safari (desktop + mobile).

---

## 5) Files added / modified (for external review)

**Added**
- `worker/mute-mouse-2cd2/src/csp.ts` — helper utilities for **nonce generation**, CSP string assembly, and applying per-response headers.
- `worker/mute-mouse-2cd2/.dev.vars` — dev-only environment vars (loaded by `wrangler dev`), e.g., `PUBLIC_ID=…` (not used in production).

**Modified**
- `worker/mute-mouse-2cd2/src/endpoints/serveDashboard.ts`  
  - Generates a **per-request nonce**.
  - Builds a **strict CSP** for the dashboard route, including `connect-src` limited to the Worker origin.
  - Injects `nonce="…"` into the inline `<script>`.
  - Applies the per-route CSP header to the Response (so global middleware won’t overwrite it).
  - Dev-only behavior: localhost can skip the KV existence check.

- `worker/mute-mouse-2cd2/src/index.ts`  
  - (Dev only) Added `/__dev/env` for quick visibility into env bindings during local runs.
  - **Removed** the temporary dev redirect from `/` to `/d/<PUBLIC_ID>` per request (so `/` no longer points to the dashboard).

- `worker/mute-mouse-2cd2/src/types.ts`  
  - Added optional dev-only fields used during local runs:
    - `PUBLIC_ID?: string`
    - `BYPASS_KV_DASHBOARD?: string`

**Unchanged (by design)**
- `worker/mute-mouse-2cd2/src/security.ts` (global headers remain as before; dashboard route now sets its own CSP per response).

---

## 6) Rollout / verification

**Production deploy checklist (Path 1)**
- Ensure **USERS_KV** binding is present on the Worker in Cloudflare.  
- Deploy code (usual `wrangler deploy` flow).  
- Open the prod dashboard `/d/<publicId>` and verify:  
  - Response headers contain `Content-Security-Policy` with a `nonce-<RANDOM>` in `script-src`.  
  - No CSP violations appear in console; page functions normally (login + decrypt + auto-refresh).

---

## 7) Notes

- Firefox warning “Couldn’t process unknown directive ‘require-trusted-types-for’” is expected; Firefox does not support the directive yet. Chrome/Edge enforce it, which is desirable.  
- The Worker’s global CSP continues to protect all routes; the dashboard route uses a **stricter, request-scoped CSP** that’s non-breaking today and points the way to a fully externalized script model (Path 2).

