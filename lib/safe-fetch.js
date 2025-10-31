/**
 * Safe Fetch Wrapper for RBMonitor
 * Wraps native fetch with egress validation, redirect handling, and timeouts
 * 
 * Security Features:
 * - Validates every request (including redirects) against allowlist
 * - Enforces redirect limits to prevent loops
 * - Configurable timeouts to prevent hanging
 * - Caching with TTL to reduce overhead
 */

const { parseAllowedHosts, validateEgressTarget, logEgressPolicy, EgressError } = require('./egress-validator');

function resolveAllowedHosts(env, allowHttp) {
  const signature = [env.ALLOWED_EGRESS_HOSTS || '', env.CLOUDFLARE_BASE_URL || ''].join('|');
  const now = Date.now();
  const cacheTTL = Number(env.EGRESS_CACHE_TTL_MS || 300000); // 5 min default

  if (!safeFetch._cache || 
      safeFetch._cache.signature !== signature ||
      (now - safeFetch._cache.timestamp) > cacheTTL) {
    const hosts = parseAllowedHosts(env);
    safeFetch._cache = { signature, hosts, timestamp: now };
    logEgressPolicy(hosts, { allowHttp });
  }
  return safeFetch._cache.hosts;
}

function withTimeout(promise, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.race([
    promise(controller.signal).finally(() => clearTimeout(timeout)),
  ]);
}

async function safeFetch(url, options = {}, { env = process.env, maxRedirects = 5 } = {}) {
  const allowHttp = env.ALLOW_HTTP === 'true' || env.NODE_ENV === 'development';
  const allowIp = env.ALLOW_IP_EGRESS === 'true';
  const allowedHosts = resolveAllowedHosts(env, allowHttp);

  const execute = async (targetUrl, redirectsRemaining) => {
    const urlObj = validateEgressTarget(targetUrl, allowedHosts, { allowHttp, allowIp });

    const response = await withTimeout(
      signal => fetch(urlObj, { ...options, redirect: 'manual', signal }),
      Number(env.FETCH_TIMEOUT_MS || 15000),
    );

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectsRemaining <= 0) {
        const err = new Error(`[${EgressError.REDIRECT_LOOP}] Too many redirects during egress validation`);
        err.code = EgressError.REDIRECT_LOOP;
        throw err;
      }
      const location = response.headers.get('location');
      if (!location) {
        const err = new Error(`[${EgressError.MISSING_LOCATION}] Redirect missing Location header`);
        err.code = EgressError.MISSING_LOCATION;
        throw err;
      }
      const nextUrl = new URL(location, urlObj);
      return execute(nextUrl.toString(), redirectsRemaining - 1);
    }

    return response;
  };

  return execute(url, maxRedirects);
}

safeFetch._cache = null;

// Utility for clearing cache (useful for testing)
safeFetch.clearCache = () => { 
  safeFetch._cache = null; 
};

module.exports = { safeFetch, clearCache: safeFetch.clearCache };
