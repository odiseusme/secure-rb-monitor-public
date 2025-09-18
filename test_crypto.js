const CryptoHelpers = require('./public/cryptoHelpers.js');

(async () => {
  const passphrase = 'testpassword123!';
  const plaintext = 'Hello, encrypted world!';
  const saltB64 = CryptoHelpers.b64encode(crypto.getRandomValues(new Uint8Array(16)));
  const iterations = 100000;

  // Encrypt
  const encrypted = await CryptoHelpers.encryptGCM({
    passphrase,
    saltB64,
    plaintext,
    iterations
  });

  console.log("Encrypted:", encrypted);

  // Decrypt
  const decrypted = await CryptoHelpers.decryptGCM({
    passphrase,
    saltB64, // <-- use the same saltB64 as you generated above!
    nonceB64: encrypted.nonceB64,
    ctB64: encrypted.ctB64,
    iterations
  });

  console.log("Decrypted:", decrypted);
})();
