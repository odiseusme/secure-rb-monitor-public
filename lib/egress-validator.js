/**
 * Network Egress Validator for RBMonitor
 * Ensures all outbound network requests only go to allowlisted destinations
 * 
 * Security Features:
 * - Hostname-based allowlisting with optional port specification
 * - IP literal blocking (configurable)
 * - HTTPS enforcement (configurable for dev)
 * - Normalization and deduplication
 * - Standardized error codes for monitoring
 */

// Define error codes for consistent error handling
const EgressError = {
  INVALID_SCHEME: 'E_EGRESS_SCHEME',
  INVALID_PORT: 'E_EGRESS_PORT',
  BLOCKED_IP: 'E_EGRESS_IP',
  UNAUTHORIZED_HOST: 'E_EGRESS_HOST',
  CONFIG_ERROR: 'E_EGRESS_CONFIG',
  REDIRECT_LOOP: 'E_EGRESS_REDIRECT',
  MISSING_LOCATION: 'E_EGRESS_NO_LOCATION',
};

// Lazy-load net module only when needed
function isIpLiteral(hostname) {
  const net = require('net');
  return net.isIP(hostname) !== 0;
}

function normalizeHostEntry(entry) {
  const raw = entry.trim();
  if (!raw) return null;
  if (raw.includes('://')) {
    const err = new Error(`[${EgressError.CONFIG_ERROR}] Remove scheme from ALLOWED_EGRESS_HOSTS entry: ${raw}`);
    err.code = EgressError.CONFIG_ERROR;
    throw err;
  }

  const cleaned = raw.replace(/\.$/, '').toLowerCase();
  const [hostname, port] = cleaned.split(':');

  if (!hostname) {
    const err = new Error(`[${EgressError.CONFIG_ERROR}] Invalid host entry: ${raw}`);
    err.code = EgressError.CONFIG_ERROR;
    throw err;
  }

  return {
    hostname,
    port: port ?? null,
    isIpLiteral: isIpLiteral(hostname),
  };
}

function parseAllowedHosts(env = process.env) {
  // Support both BASE_URL (set by register-user.sh) and CLOUDFLARE_BASE_URL
  const baseUrl = env.CLOUDFLARE_BASE_URL || env.BASE_URL;
  if (!baseUrl) {
    const err = new Error(`[${EgressError.CONFIG_ERROR}] CLOUDFLARE_BASE_URL (or BASE_URL) is required`);
    err.code = EgressError.CONFIG_ERROR;
    throw err;
  }

  // Always include the Cloudflare Worker domain from CLOUDFLARE_BASE_URL
  const workerHost = (() => {
    const parsed = new URL(baseUrl);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  })();

  // Hardcoded allowlist: Worker + Ergo Explorer API (required for balance fetching)
  // Users cannot add custom domains via ALLOWED_EGRESS_HOSTS (security by design)
  const entries = [
    workerHost,
    'api.ergoplatform.com'
  ];

  const normalized = entries.map(normalizeHostEntry).filter(Boolean);

  if (normalized.length === 0) {
    const err = new Error(`[${EgressError.CONFIG_ERROR}] ALLOWED_EGRESS_HOSTS resolved to an empty list`);
    err.code = EgressError.CONFIG_ERROR;
    throw err;
  }  const deduped = Array.from(
    new Map(normalized.map(h => [`${h.hostname}:${h.port ?? ''}`, h])).values(),
  );

  return deduped;
}

function isInternalDockerService(hostname) {
  // Match Docker Compose service naming: <service>_<container>-<number>
  // Examples: watcher_ergo-service-1, watchme_first-service-1
  const dockerPattern = /^[a-z0-9_-]+(-[a-z0-9_-]+)?-\d+$/i;
  
  // Also allow .internal suffix and host.docker.internal
  const internalDns = hostname.endsWith('.internal') || hostname === 'host.docker.internal';
  
  return dockerPattern.test(hostname) || internalDns;
}

function assertSchemeAndPort(urlObj, { allowHttp }) {
  const isHttps = urlObj.protocol === 'https:';
  const isInternalDocker = isInternalDockerService(urlObj.hostname);
  
  if (!isHttps && !allowHttp && !isInternalDocker) {
    const err = new Error(`[${EgressError.INVALID_SCHEME}] HTTP egress blocked (external). Target: ${urlObj.href}`);
    err.code = EgressError.INVALID_SCHEME;
    throw err;
  }

  // Allow any port for internal Docker services
  if (urlObj.port && !isInternalDocker) {
    const allowedPort = isHttps ? '443' : '80';
    if (urlObj.port !== allowedPort) {
      const err = new Error(`[${EgressError.INVALID_PORT}] Nonstandard port blocked: ${urlObj.port}`);
      err.code = EgressError.INVALID_PORT;
      throw err;
    }
  }
}

function isAllowedTarget(urlObj, allowedHosts) {
  const normalizedHost = urlObj.hostname.toLowerCase();
  
  // Always allow internal Docker services
  if (isInternalDockerService(normalizedHost)) {
    return true;
  }
  
  const normalizedPort = urlObj.port || '';

  return allowedHosts.some(entry => {
    const portMatch =
      (entry.port ?? '') === normalizedPort ||
      (!entry.port && !normalizedPort);
    return entry.hostname === normalizedHost && portMatch;
  });
}

function validateEgressTarget(targetUrl, allowedHosts, { allowHttp = false, allowIp = false } = {}) {
  const urlObj = new URL(targetUrl);

  assertSchemeAndPort(urlObj, { allowHttp });

  const hostname = urlObj.hostname.toLowerCase();
  if (isIpLiteral(hostname) && !allowIp) {
    const err = new Error(`[${EgressError.BLOCKED_IP}] IP literal egress blocked: ${hostname}`);
    err.code = EgressError.BLOCKED_IP;
    throw err;
  }

  if (!isAllowedTarget(urlObj, allowedHosts)) {
    const err = new Error(`[${EgressError.UNAUTHORIZED_HOST}] Unauthorized network egress to ${hostname}`);
    err.code = EgressError.UNAUTHORIZED_HOST;
    throw err;
  }

  return urlObj;
}

function logEgressPolicy(allowedHosts, { allowHttp }) {
  // Skip logging in test environment to reduce noise
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('[EGRESS SECURITY] Network Egress Allowlist Active');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Allowed destinations (${allowedHosts.length}):`);
  allowedHosts.forEach(host => {
    const port = host.port ? `:${host.port}` : '';
    console.log(`  ✓ ${host.hostname}${port}`);
  });
  console.log(`HTTP allowed: ${allowHttp ? 'yes (dev)' : 'no (production)'}`);
  console.log('All other network connections will be BLOCKED');
  console.log('═══════════════════════════════════════════════════');
}

module.exports = {
  normalizeHostEntry,
  parseAllowedHosts,
  validateEgressTarget,
  logEgressPolicy,
  assertSchemeAndPort,
  EgressError,
};
