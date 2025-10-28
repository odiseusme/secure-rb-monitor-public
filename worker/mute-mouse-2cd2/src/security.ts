/**
 * Security Headers Module
 * 
 * Provides comprehensive HTTP security headers for the Cloudflare Worker
 * to protect against XSS, clickjacking, MIME sniffing, and other attacks.
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
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",  // blob: added for generated images
      "style-src 'self' 'unsafe-inline'",  // inline styles for dashboard
      "script-src 'self'",
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
    
    // CORS headers for additional isolation
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
 * Uses Response.clone() to prevent stream locking issues
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
  Object.entries(securityHeaders).forEach(([key, value]) => {
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
