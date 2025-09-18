// cryptoHelpers.js
// Works in browsers and Node >=18 (CommonJS). For ESM in Node, replace the require() with `import('crypto')`.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CryptoHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // --- Environment-agnostic WebCrypto + RNG ---
  function getWebCrypto() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return { crypto: globalThis.crypto, subtle: globalThis.crypto.subtle, getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) };
    }
    // Node (CommonJS)
    // eslint-disable-next-line global-require
    const { webcrypto } = require('crypto');
    return { crypto: webcrypto, subtle: webcrypto.subtle, getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  }
  const { subtle, getRandomValues } = getWebCrypto();

  // --- Text enc/dec ---
  const _TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : require('util').TextEncoder;
  const _TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : require('util').TextDecoder;
  const enc = new _TextEncoder();
  const dec = new _TextDecoder();

  // --- Base64 helpers (URL-safe optional) ---
  function b64encode(bytes, urlSafe = false) {
    let s;
    if (typeof Buffer !== 'undefined') s = Buffer.from(bytes).toString('base64');
    else s = btoa(String.fromCharCode(...bytes));
    if (!urlSafe) return s;
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function b64decode(b64) {
    // accept url-safe input
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '=');
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(padded, 'base64'));
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // --- Utility ---
  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof data === 'string') return enc.encode(data);
    throw new TypeError('Expected string or Uint8Array');
  }
  function toString(bytes) {
    return dec.decode(bytes);
  }

  // --- PBKDF2(SHA-256) -> AES key (CBC or GCM) ---
  async function deriveAesKeyPBKDF2(passphrase, saltB64, iterations = 100000, mode = 'CBC') {
    const salt = b64decode(saltB64);
    const keyMaterial = await subtle.importKey(
      'raw',
      toBytes(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const algo = { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' };
    const aesParams = { name: mode === 'GCM' ? 'AES-GCM' : 'AES-CBC', length: 256 };
    return subtle.deriveKey(algo, keyMaterial, aesParams, false, mode === 'GCM' ? ['encrypt', 'decrypt'] : ['encrypt', 'decrypt']);
  }

  // ===================== AES-CBC (no integrity/MAC) =====================
  // NEVER reuse IV with same key. IV is 16 bytes.
  async function encryptCBC({ passphrase, saltB64, plaintext, iterations = 100000 }) {
    const key = await deriveAesKeyPBKDF2(passphrase, saltB64, iterations, 'CBC');
    const iv = new Uint8Array(16);
    getRandomValues(iv);
    const ct = await subtle.encrypt({ name: 'AES-CBC', iv }, key, toBytes(plaintext));
    return {
      // We name it nonce for consistency with your doc; it is the IV.
      nonceB64: b64encode(new Uint8Array(iv)),
      ctB64: b64encode(new Uint8Array(ct)),
      kdf: { iterations, hash: 'SHA-256', kdf: 'PBKDF2' },
      mode: 'AES-CBC'
    };
  }

  async function decryptCBC({ passphrase, saltB64, nonceB64, ctB64, iterations = 100000, asString = true }) {
    const key = await deriveAesKeyPBKDF2(passphrase, saltB64, iterations, 'CBC');
    const iv = b64decode(nonceB64);
    const ct = b64decode(ctB64);
    const pt = await subtle.decrypt({ name: 'AES-CBC', iv }, key, ct);
    const out = new Uint8Array(pt);
    return asString ? toString(out) : out;
  }

  // ===================== AES-GCM (authenticated) =====================
  // NEVER reuse nonce with same key. Nonce is 12 bytes. Optional AAD.
  async function encryptGCM({ passphrase, saltB64, plaintext, iterations = 100000, aadB64 = null }) {
    const key = await deriveAesKeyPBKDF2(passphrase, saltB64, iterations, 'GCM');
    const nonce = new Uint8Array(12);
    getRandomValues(nonce);
    const alg = { name: 'AES-GCM', iv: nonce };
    if (aadB64) alg.additionalData = b64decode(aadB64);
    const ct = await subtle.encrypt(alg, key, toBytes(plaintext));
    return {
      nonceB64: b64encode(new Uint8Array(nonce)),
      ctB64: b64encode(new Uint8Array(ct)), // includes auth tag
      kdf: { iterations, hash: 'SHA-256', kdf: 'PBKDF2' },
      mode: 'AES-GCM',
      aadB64: aadB64 || undefined
    };
  }

  async function decryptGCM({ passphrase, saltB64, nonceB64, ctB64, iterations = 100000, aadB64 = null, asString = true }) {
    const key = await deriveAesKeyPBKDF2(passphrase, saltB64, iterations, 'GCM');
    const nonce = b64decode(nonceB64);
    const ct = b64decode(ctB64);
    const alg = { name: 'AES-GCM', iv: nonce };
    if (aadB64) alg.additionalData = b64decode(aadB64);
    const pt = await subtle.decrypt(alg, key, ct);
    const out = new Uint8Array(pt);
    return asString ? toString(out) : out;
    // Note: if auth fails, this throws DOMException: OperationError
  }

  return {
    encryptCBC, decryptCBC,
    encryptGCM, decryptGCM,
    // exposing helpers in case you need them:
    b64encode, b64decode, toBytes, toString
  };
});
