/**
 * Redaction utility for safe logging in RBMonitor Worker
 * Prevents credential and sensitive data leaks in logs
 */

// Field names that should always be redacted
const SENSITIVE_FIELDS = [
  'password',
  'passphrase',
  'token',
  'secret',
  'key',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'session',
  'credentials',
  'salt',
  'privatekey',
  'private_key',
  'auth',
  'signature',
  'bearer',
];

// Patterns that indicate sensitive data in strings
const SENSITIVE_PATTERNS = [
  /Bearer\s+[\w-]+/gi,                    // Bearer tokens
  /\beyJ[A-Za-z0-9+/]{20,}={0,2}\b/g,     // JWT tokens (start with eyJ, Base64 encoded, 20+ chars)
  /\b[A-Za-z0-9+/]{60,}={0,2}\b/g,        // Long Base64 strings (60+ chars, word boundaries)
  /sk-[a-zA-Z0-9]{40,}/g,                 // API keys (OpenAI style, 40+ chars)
  /ghp_[a-zA-Z0-9]{36}/g,                 // GitHub tokens
  /AIza[0-9A-Za-z-_]{35}/g,               // Google API keys
];

/**
 * Redact sensitive fields from an object
 */
export function redactObject(obj: any, depth = 0): any {
  if (depth > 10) return '[MAX_DEPTH]'; // Prevent infinite recursion
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Return primitives as-is (don't convert to string)
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return redactString(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }
  
  const redacted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // First handle nested objects/arrays
    if (value !== null && typeof value === 'object') {
      redacted[key] = redactObject(value, depth + 1);
    }
    // Then check if field name itself is sensitive (for primitive values)
    else if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      redacted[key] = '***REDACTED***';
    } else if (typeof value === 'string') {
      redacted[key] = redactString(value);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Redact sensitive patterns from a string
 */
export function redactString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }
  
  let redacted = str;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '***REDACTED***');
  }
  
  return redacted;
}

/**
 * Redact sensitive headers from HTTP headers
 */
export function redactHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  
  const headersToProcess = headers instanceof Headers
    ? Array.from(headers.entries())
    : Object.entries(headers);
  
  for (const [key, value] of headersToProcess) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      redacted[key] = '***REDACTED***';
    } else {
      redacted[key] = redactString(value);
    }
  }
  
  return redacted;
}

/**
 * Safe error logging with automatic redaction
 */
export function safeLogError(
  message: string,
  error: Error | unknown,
  context?: Record<string, any>,
  level: 'error' | 'warn' = 'error'
): void {
  const logFn = level === 'error' ? console.error : console.warn;
  
  const safeContext = context ? redactObject(context) : {};
  
  if (error instanceof Error) {
    logFn(`[${level.toUpperCase()}] ${message}`, {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'), // Limit stack trace
      ...safeContext,
    });
  } else {
    logFn(`[${level.toUpperCase()}] ${message}`, {
      error: String(error),
      ...safeContext,
    });
  }
}

/**
 * Safe request logging with automatic redaction
 */
export function safeLogRequest(
  method: string,
  url: string,
  status?: number,
  context?: Record<string, any>
): void {
  const safeContext = context ? redactObject(context) : {};
  
  // Only log in development or with explicit debug flag
  if (process.env.NODE_ENV === 'production') {
    return; // Minimal logging in production
  }
  
  console.warn(`[REQUEST] ${method} ${url}${status ? ` → ${status}` : ''}`, safeContext);
}

/**
 * Test if a value contains sensitive data (for validation)
 */
export function containsSensitiveData(value: any): boolean {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  
  // Create new regex instances to avoid state issues
  const patterns = [
    /Bearer\s+[\w-]+/gi,
    /[A-Za-z0-9+/]{60,}={0,2}/g,
    /sk-[a-zA-Z0-9]{48}/g,
    /ghp_[a-zA-Z0-9]{36}/g,
    /AIza[0-9A-Za-z-_]{35}/g,
  ];
  
  return patterns.some(pattern => pattern.test(str));
}
