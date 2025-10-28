/**
 * Unit tests for redaction utility
 * Ensures sensitive data is properly redacted from logs
 */

import { describe, it, expect } from 'vitest';
import {
  redactObject,
  redactString,
  redactHeaders,
  containsSensitiveData,
} from './redact';

describe('redactObject', () => {
  it('should redact password fields', () => {
    const input = {
      username: 'alice',
      password: 'secret123',
      email: 'alice@example.com',
    };
    
    const result = redactObject(input);
    
    expect(result.username).toBe('alice');
    expect(result.password).toBe('***REDACTED***');
    expect(result.email).toBe('alice@example.com');
  });
  
  it('should redact nested sensitive fields', () => {
    const obj = {
      user: {
        name: 'Alice',
        credentials: {
          api_key: 'sk_test_FAKE_NOT_A_REAL_KEY_FOR_TESTING_ONLY'
        }
      }
    };
    
    const result = redactObject(obj);
    
    expect(result.user.name).toBe('Alice');
    expect(result.user.credentials.api_key).toBe('***REDACTED***');
  });
  
  it('should redact passphrase fields', () => {
    const input = {
      dashPassphrase: 'MySecretPass123',
      DASH_PASSPHRASE: 'AnotherSecret',
      data: 'public info',
    };
    
    const result = redactObject(input);
    
    expect(result.dashPassphrase).toBe('***REDACTED***');
    expect(result.DASH_PASSPHRASE).toBe('***REDACTED***');
    expect(result.data).toBe('public info');
  });
  
  it('should handle arrays', () => {
    const input = {
      users: [
        { name: 'alice', secret: 'sec1' },
        { name: 'bob', secret: 'sec2' },
      ],
    };
    
    const result = redactObject(input);
    
    expect(result.users[0].name).toBe('alice');
    expect(result.users[0].secret).toBe('***REDACTED***');
    expect(result.users[1].name).toBe('bob');
    expect(result.users[1].secret).toBe('***REDACTED***');
  });
  
  it('should prevent infinite recursion', () => {
    const circular: any = { name: 'test' };
    circular.self = circular;
    circular.deep = { level: circular };
    
    const result = redactObject(circular);
    
    expect(result.name).toBe('test');
    // Should not throw, should handle depth limit
  });
});

describe('redactString', () => {
  it('should redact Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123xyz789';
    const result = redactString(input);
    
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('abc123xyz789');
  });
  
  it('should redact Base64 strings', () => {
    // Realistic JWT-like token (Base64 encoded, 60+ chars)
    const input = 'Data: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
    const result = redactString(input);
    
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });
  
  it('should not redact short strings', () => {
    const input = 'This is a normal log message with ID=123';
    const result = redactString(input);
    
    expect(result).toBe(input);
  });
  
  it('should redact API keys', () => {
    const input = 'Using key: sk-1234567890123456789012345678901234567890123456';
    const result = redactString(input);
    
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('sk-1234567890');
  });
});

describe('redactHeaders', () => {
  it('should redact Authorization header', () => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer secret-token',
      'X-Custom-Header': 'public-value',
    };
    
    const result = redactHeaders(headers);
    
    expect(result['Content-Type']).toBe('application/json');
    expect(result['Authorization']).toBe('***REDACTED***');
    expect(result['X-Custom-Header']).toBe('public-value');
  });
  
  it('should redact cookie headers', () => {
    const headers = {
      'Cookie': 'session=abc123; token=xyz789',
      'Host': 'example.com',
    };
    
    const result = redactHeaders(headers);
    
    expect(result['Cookie']).toBe('***REDACTED***');
    expect(result['Host']).toBe('example.com');
  });
  
  it('should work with Headers object', () => {
    const headers = new Headers();
    headers.set('content-type', 'application/json');  // Headers normalizes to lowercase
    headers.set('x-api-key', 'secret-key-123');
    
    const result = redactHeaders(headers);
    
    expect(result['content-type']).toBe('application/json');
    expect(result['x-api-key']).toBe('***REDACTED***');
  });
  
  it('should handle case-insensitive field matching', () => {
    const headers = {
      'x-auth-token': 'secret',
      'X-Secret-Key': 'another-secret',
      'Content-Length': '1234',
    };
    
    const result = redactHeaders(headers);
    
    expect(result['x-auth-token']).toBe('***REDACTED***');
    expect(result['X-Secret-Key']).toBe('***REDACTED***');
    expect(result['Content-Length']).toBe('1234');
  });
});

describe('containsSensitiveData', () => {
  it('should detect Bearer tokens', () => {
    const value = 'Authorization: Bearer abc123token';
    expect(containsSensitiveData(value)).toBe(true);
  });
  
  it('should detect Base64 encoded data', () => {
    // Realistic JWT token (60+ chars Base64)
    const value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
    expect(containsSensitiveData(value)).toBe(true);
  });
  
  it('should not flag normal text', () => {
    const value = 'This is just a normal log message';
    expect(containsSensitiveData(value)).toBe(false);
  });
  
  it('should detect sensitive data in objects', () => {
    const value = { auth: 'Bearer token123xyz' };
    expect(containsSensitiveData(value)).toBe(true);
  });
});

describe('edge cases', () => {
  it('should handle null and undefined', () => {
    expect(redactObject(null)).toBe(null);
    expect(redactObject(undefined)).toBe(undefined);
  });
  
  it('should handle empty objects', () => {
    expect(redactObject({})).toEqual({});
  });
  
  it('should handle empty arrays', () => {
    expect(redactObject([])).toEqual([]);
  });
  
  it('should handle primitive values', () => {
    expect(redactObject(123)).toBe(123);
    expect(redactObject('test')).toBe('test');
    expect(redactObject(true)).toBe(true);
  });
});
