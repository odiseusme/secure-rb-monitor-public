const { safeFetch, clearCache } = require('../lib/safe-fetch');
const { EgressError } = require('../lib/egress-validator');

describe('safeFetch - Egress Validation', () => {
  beforeEach(() => {
    clearCache();
    process.env.CLOUDFLARE_BASE_URL = 'https://worker.dev';
    delete process.env.ALLOWED_EGRESS_HOSTS;
    delete process.env.ALLOW_IP_EGRESS;
    delete process.env.ALLOW_HTTP;
  });

  afterEach(() => {
    clearCache();
  });

  describe('Blocks Unauthorized Egress', () => {
    test('blocks unauthorized hostname before network call', async () => {
      await expect(safeFetch('https://evil.com')).rejects.toMatchObject({
        code: EgressError.UNAUTHORIZED_HOST,
        message: expect.stringContaining('Unauthorized network egress'),
      });
    });

    test('blocks HTTP protocol without ALLOW_HTTP', async () => {
      await expect(safeFetch('http://worker.dev')).rejects.toMatchObject({
        code: EgressError.INVALID_SCHEME,
        message: expect.stringContaining('HTTP egress blocked'),
      });
    });

    test('blocks IP literals without ALLOW_IP_EGRESS', async () => {
      await expect(safeFetch('https://1.2.3.4')).rejects.toMatchObject({
        code: EgressError.BLOCKED_IP,
        message: expect.stringContaining('IP literal egress blocked'),
      });
    });

    test('blocks non-standard ports', async () => {
      await expect(safeFetch('https://worker.dev:8443')).rejects.toMatchObject({
        code: EgressError.INVALID_PORT,
        message: expect.stringContaining('Nonstandard port blocked'),
      });
    });

    test('blocks subdomain of allowed host', async () => {
      await expect(safeFetch('https://sub.worker.dev')).rejects.toMatchObject({
        code: EgressError.UNAUTHORIZED_HOST,
      });
    });
  });

  describe('Allowlist Caching', () => {
    test('clearCache invalidates cached allowlist', async () => {
      process.env.ALLOWED_EGRESS_HOSTS = 'old.worker.dev';
      clearCache();
      
      // Warm cache
      await safeFetch('https://old.worker.dev').catch(() => {});

      // Change config and clear cache
      process.env.ALLOWED_EGRESS_HOSTS = 'new.worker.dev';
      clearCache();

      // Old host should now be rejected
      await expect(safeFetch('https://old.worker.dev')).rejects.toMatchObject({
        code: EgressError.UNAUTHORIZED_HOST,
      });
    });
  });

  describe('Configuration Options', () => {
    test('allows HTTP when ALLOW_HTTP=true', async () => {
      process.env.ALLOW_HTTP = 'true';
      clearCache();
      
      // Should NOT throw scheme error (will fail with network error)
      const promise = safeFetch('http://worker.dev');
      await expect(promise).rejects.not.toMatchObject({
        code: EgressError.INVALID_SCHEME,
      });
    });
  });

  describe('Auto-Derivation', () => {
    test('auto-derives from CLOUDFLARE_BASE_URL when no explicit list', async () => {
      delete process.env.ALLOWED_EGRESS_HOSTS;
      clearCache();

      // Should block other hosts
      await expect(safeFetch('https://other.com')).rejects.toMatchObject({
        code: EgressError.UNAUTHORIZED_HOST,
      });
    });

    test('hardcoded allowlist includes worker and api.ergoplatform.com', () => {
      const { parseAllowedHosts } = require('../lib/egress-validator');
      
      process.env.CLOUDFLARE_BASE_URL = 'https://my-worker.workers.dev';
      delete process.env.ALLOWED_EGRESS_HOSTS; // Not used anymore
      clearCache();

      // Verify hardcoded allowlist
      const hosts = parseAllowedHosts();
      expect(hosts).toHaveLength(2);
      expect(hosts[0].hostname).toBe('my-worker.workers.dev'); // auto-derived
      expect(hosts[1].hostname).toBe('api.ergoplatform.com'); // hardcoded
    });
  });
});
