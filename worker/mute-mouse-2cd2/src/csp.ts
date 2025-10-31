/**
 * Cloudflare Worker CSP helper for RBMonitor (Phase 1: nonce-based CSP)
 * - Generates a per-request nonce
 * - Builds a conservative, non-breaking CSP string
 * - Applies the CSP header to a Response
 *
 * Usage (next steps):
 *   import { generateNonce, buildCsp, applyCsp } from "./csp";
 *   const nonce = generateNonce();
 *   const csp = buildCsp({ connectOrigins: [env.BASE_URL ?? "", "https://your-worker.workers.dev"] }, nonce);
 *   // add nonce="${nonce}" to inline <script> in your HTML template (Step 2)
 *   const res = new Response(html, { headers: { "content-type": "text/html; charset=utf-8" }});
 *   applyCsp(res, csp);
 *   return res;
 */

/** Generate a Base64 (URL-safe) nonce for this request */
export function generateNonce(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  // In Workers, crypto.getRandomValues is available
  crypto.getRandomValues(buf);
  // URL-safe base64 (no padding)
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type CspBuildOptions = {
  /** Exactly which origins your dashboard will call (Worker/API endpoints). Example: ["https://mute-mouse-xxxx.rbmonitor.workers.dev"] */
  connectOrigins: string[];
  /** Allow inline styles temporarily (Phase 1). Default: true */
  allowInlineStyles?: boolean;
  /** Additional img sources if needed (e.g., "data:", "blob:" are included by default). */
  extraImgSrc?: string[];
};

export function buildCsp(opts: CspBuildOptions, nonce: string): string {
  const allowInlineStyles = opts.allowInlineStyles !== false; // default true during Phase 1
  const connectSrc = (opts.connectOrigins || [])
    .filter(Boolean)
    .map(o => o.trim())
    .filter(Boolean);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'none'"],
    "object-src": ["'none'"],
    // Phase 1: allow only same-origin scripts + the specific inline blocks we nonce
    "script-src": ["'self'", `'nonce-${nonce}'`],
    // Forbid inline event handlers (e.g., onclick="") to the extent possible now
    "script-src-attr": ["'none'"],
    // Style policy: keep 'unsafe-inline' initially if you still use inline styles
    "style-src": allowInlineStyles ? ["'self'", "'unsafe-inline'"] : ["'self'"],
    "img-src": ["'self'", "data:", "blob:", ...(opts.extraImgSrc || [])],
    "connect-src": connectSrc.length ? connectSrc : ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    // Progressive hardening (Chromium): DOM sink protection; safe to enable now
    "require-trusted-types-for": ["'script'"],
  };

  // Turn directives into a CSP header string
  const parts = Object.entries(directives).map(([k, vals]) => `${k} ${vals.join(" ")}`);
  return parts.join("; ");
}

/** Apply CSP to a Response (mutates headers; safe in Workers before return) */
export function applyCsp(res: Response, csp: string): void {
  res.headers.set("Content-Security-Policy", csp);
}

/** Optional helper: return a nonce attribute string for use in HTML templates */
export function nonceAttr(nonce: string): string {
  return ` nonce="${nonce}"`;
}
