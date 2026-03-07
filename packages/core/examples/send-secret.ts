// Example: Encrypt a secret and generate a secure link
// Run: npx tsx examples/send-secret.ts

import { NoDataCrypto } from '@nodatachat/core';

async function main() {
  const secret = 'DB_PASSWORD=super_secret_123';

  // Generate ephemeral keys
  const { publicKeyJwk, privateKeyJwk } = await NoDataCrypto.generateKeyPair();
  console.log('Keys generated (RSA-OAEP-4096)');

  // Encrypt
  const encrypted = await NoDataCrypto.encryptMessage(secret, publicKeyJwk);
  console.log('Encrypted:', encrypted.encrypted_blob.slice(0, 40) + '...');

  // Decrypt (recipient side)
  const decrypted = await NoDataCrypto.decryptMessage(encrypted, privateKeyJwk);
  console.log('Decrypted:', decrypted);
  console.log('Match:', decrypted === secret);
}

main();
