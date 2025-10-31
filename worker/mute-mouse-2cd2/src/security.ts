/**
 * Security Headers Module
 * 
 * Provides comprehensive HTTP security headers for the Cloudflare Worker
 * to protect against XSS, clickjacking, MIME sniffing, and other attacks.
 * 
 * NOTE (2025-10-31):
 *  - Do NOT override an existing Content-Security-Policy header.
 *    This allows specific routes (e.g., /d/:publicId) to set a per-request,
 *    nonce-based CSP without being clobbered by the global middleware.
 * 
 * References:
 * - OWASP Secure Headers Project: https://owasp.org/www-project-secure-headers/
 */
export interface SecurityHeadersConfig {
  environment?: 'development' | 'production';
}

/**
 * Get security headers based on environment
 */
export function getSecurityHeaders(config: SecurityHeadersConfig = { environment: 'production' }) {
  const headers: Record<string, string> = {
    // Content Security Policy - prevents XSS and injection attacks
    // (Default, global policy for routes that do not set their own CSP)
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",  // blob: added for generated images
      "style-src 'self' 'unsafe-inline'",  // inline styles for dashboard (Phase 1)
      // inline <script> hashes kept for legacy inline blocks on non-dashboard pages
      "script-src 'self' 'sha256-YIz0H6+81FYaZXo8Pxr+HL86FYk5aW13YgfKdqC0zPY=' 'sha256-kjt9UT4+jN3a0VwWH2RXwRQx3QMTQ80EkYunX6IYp+I='",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"  // defense-in-depth with X-Frame-Options
    ].join('; '),

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Control referrer information
    'Referrer-Policy': 'no-referrer',

    // Disable unnecessary browser features
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

    // CORS-like isolation headers
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin'
  };

  // CONDITIONAL HSTS: Only in production to avoid local development issues
  if (config.environment === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }
  return headers;
}

/**
 * Add security headers to a Response
 * Uses Response.clone() to prevent stream locking issues.
 * IMPORTANT: If the response already has a CSP header, we DO NOT override it.
 */
export function addSecurityHeaders(
  response: Response, 
  config?: SecurityHeadersConfig
): Response {
  // Clone the response to avoid stream locking
  const clonedResponse = response.clone();
  
  // Get headers for current environment
  const securityHeaders = getSecurityHeaders(config);
  
  // Create new headers object with existing + security headers
  const newHeaders = new Headers(clonedResponse.headers);

  // Preserve an existing CSP set by a route handler
  const alreadyHasCsp = newHeaders.has('Content-Security-Policy');

  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (key === 'Content-Security-Policy' && alreadyHasCsp) {
      // Skip: a route (e.g., /d/:publicId) set a specific CSP (e.g., with nonce)
      return;
    }
    newHeaders.set(key, value);
  });
  
  // Return new response with security headers
  return new Response(clonedResponse.body, {
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers: newHeaders
  });
}

/**
 * Create a new Response with security headers
 */
export function secureResponse(
  body: any, 
  init?: ResponseInit,
  config?: SecurityHeadersConfig
): Response {
  const response = new Response(body, init);
  return addSecurityHeaders(response, config);
}

/**
 * Optional helper for dynamic endpoints to force no-store
 */
export function noStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers || {});
  headers.set('Cache-Control', 'no-store');
  return { ...init, headers };
}
