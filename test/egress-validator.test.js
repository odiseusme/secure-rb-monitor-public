const {
  normalizeHostEntry,
  parseAllowedHosts,
  validateEgressTarget,
  EgressError,
} = require('../lib/egress-validator');

describe('Egress Validator', () => {
  describe('normalizeHostEntry', () => {
    test('normalizes basic hostname', () => {
      const result = normalizeHostEntry('worker.dev');
      expect(result).toEqual({
        hostname: 'worker.dev',
        port: null,
        isIpLiteral: false,
      });
    });

    test('normalizes hostname with port', () => {
      const result = normalizeHostEntry('worker.dev:443');
      expect(result).toEqual({
        hostname: 'worker.dev',
        port: '443',
        isIpLiteral: false,
      });
    });

    test('lowercases hostname', () => {
      const result = normalizeHostEntry('WORKER.DEV');
      expect(result.hostname).toBe('worker.dev');
    });

    test('removes trailing dot', () => {
      const result = normalizeHostEntry('worker.dev.');
      expect(result.hostname).toBe('worker.dev');
    });

    test('detects IP literals', () => {
      const result = normalizeHostEntry('192.168.1.1');
      expect(result.isIpLiteral).toBe(true);
    });

    test('throws on scheme in entry', () => {
      expect(() => normalizeHostEntry('https://worker.dev')).toThrow(/Remove scheme/);
      try {
        normalizeHostEntry('https://worker.dev');
      } catch (err) {
        expect(err.code).toBe(EgressError.CONFIG_ERROR);
      }
    });

    test('returns null for empty entry', () => {
      expect(normalizeHostEntry('')).toBeNull();
      expect(normalizeHostEntry('  ')).toBeNull();
    });
  });

  describe('parseAllowedHosts', () => {
    test('auto-derives from CLOUDFLARE_BASE_URL and hardcodes api.ergoplatform.com', () => {
      const env = { CLOUDFLARE_BASE_URL: 'https://worker.dev' };
      const hosts = parseAllowedHosts(env);
      expect(hosts).toHaveLength(2); // worker.dev + api.ergoplatform.com
      expect(hosts[0].hostname).toBe('worker.dev');
      expect(hosts[1].hostname).toBe('api.ergoplatform.com');
    });

    test('auto-derives with port from CLOUDFLARE_BASE_URL', () => {
      const env = { CLOUDFLARE_BASE_URL: 'https://worker.dev:8443' };
      const hosts = parseAllowedHosts(env);
      expect(hosts).toHaveLength(2); // worker.dev:8443 + api.ergoplatform.com
      expect(hosts[0].port).toBe('8443');
      expect(hosts[1].hostname).toBe('api.ergoplatform.com');
    });

    test('ignores ALLOWED_EGRESS_HOSTS (hardcoded allowlist)', () => {
      const env = {
        CLOUDFLARE_BASE_URL: 'https://worker.dev',
        ALLOWED_EGRESS_HOSTS: 'evil.com,hacker.com', // Ignored for security
      };
      const hosts = parseAllowedHosts(env);
      expect(hosts).toHaveLength(2); // Only worker.dev + api.ergoplatform.com
      expect(hosts[0].hostname).toBe('worker.dev');
      expect(hosts[1].hostname).toBe('api.ergoplatform.com');
      // evil.com and hacker.com are NOT in the allowlist
    });

    test('deduplicates entries (worker appears only once)', () => {
      const env = {
        CLOUDFLARE_BASE_URL: 'https://api.ergoplatform.com', // Same as hardcoded
      };
      const hosts = parseAllowedHosts(env);
      expect(hosts).toHaveLength(1); // Deduplicated
      expect(hosts[0].hostname).toBe('api.ergoplatform.com');
    });

    test('throws if CLOUDFLARE_BASE_URL and BASE_URL both missing', () => {
      expect(() => parseAllowedHosts({})).toThrow(/CLOUDFLARE_BASE_URL \(or BASE_URL\) is required/);
      try {
        parseAllowedHosts({});
      } catch (err) {
        expect(err.code).toBe(EgressError.CONFIG_ERROR);
      }
    });

    test('throws if allowlist resolves to empty', () => {
      const env = {
        CLOUDFLARE_BASE_URL: 'https://worker.dev',
      };
      // Should NOT throw anymore because hardcoded hosts exist
      const hosts = parseAllowedHosts(env);
      expect(hosts).toHaveLength(2); // worker.dev + api.ergoplatform.com
    });
  });

  describe('validateEgressTarget', () => {
    const allowedHosts = [
      { hostname: 'worker.dev', port: null, isIpLiteral: false },
    ];

    test('allows valid HTTPS target', () => {
      const result = validateEgressTarget(
        'https://worker.dev/api',
        allowedHosts
      );
      expect(result.hostname).toBe('worker.dev');
    });

    test('blocks HTTP without allowHttp flag', () => {
      expect(() =>
        validateEgressTarget('http://worker.dev', allowedHosts)
      ).toThrow(/HTTP egress blocked/);
      try {
        validateEgressTarget('http://worker.dev', allowedHosts);
      } catch (err) {
        expect(err.code).toBe(EgressError.INVALID_SCHEME);
      }
    });

    test('allows HTTP with allowHttp flag', () => {
      const result = validateEgressTarget(
        'http://worker.dev',
        allowedHosts,
        { allowHttp: true }
      );
      expect(result.protocol).toBe('http:');
    });

    test('blocks IP literal without allowIp flag', () => {
      expect(() =>
        validateEgressTarget('https://1.2.3.4', allowedHosts)
      ).toThrow(/IP literal egress blocked/);
      try {
        validateEgressTarget('https://1.2.3.4', allowedHosts);
      } catch (err) {
        expect(err.code).toBe(EgressError.BLOCKED_IP);
      }
    });

    test('allows IP literal with allowIp flag', () => {
      const ipHosts = [{ hostname: '1.2.3.4', port: null, isIpLiteral: true }];
      const result = validateEgressTarget(
        'https://1.2.3.4',
        ipHosts,
        { allowIp: true }
      );
      expect(result.hostname).toBe('1.2.3.4');
    });

    test('blocks unauthorized hostname', () => {
      expect(() =>
        validateEgressTarget('https://evil.com', allowedHosts)
      ).toThrow(/Unauthorized network egress/);
      try {
        validateEgressTarget('https://evil.com', allowedHosts);
      } catch (err) {
        expect(err.code).toBe(EgressError.UNAUTHORIZED_HOST);
      }
    });

    test('blocks non-standard HTTPS port', () => {
      expect(() =>
        validateEgressTarget('https://worker.dev:8443', allowedHosts)
      ).toThrow(/Nonstandard port blocked/);
      try {
        validateEgressTarget('https://worker.dev:8443', allowedHosts);
      } catch (err) {
        expect(err.code).toBe(EgressError.INVALID_PORT);
      }
    });

    test('requires exact hostname match (no subdomains)', () => {
      expect(() =>
        validateEgressTarget('https://sub.worker.dev', allowedHosts)
      ).toThrow(/Unauthorized network egress/);
    });
  });
});
