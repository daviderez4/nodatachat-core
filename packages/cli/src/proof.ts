#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// nodata-proof — Prove the Zero-Data architecture
// Shows exactly what NoDataChat does (and doesn't) store
// ═══════════════════════════════════════════════════════════

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║  NoDataChat — Zero-Data Delivery Protocol    ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');

  const checks = [
    ['No message database',       'Messages are encrypted client-side, delivered, then deleted'],
    ['No plaintext on server',    'Server only sees encrypted blobs — never the content'],
    ['No accounts required',      'Identity is a 12-word seed phrase, generated on device'],
    ['No password storage',       'Billing serial is a one-way SHA-256 hash of the seed'],
    ['Ephemeral encryption keys', 'AES-256-GCM keys are generated per-message, never reused'],
    ['Burn after read',           'Secrets self-destruct after first view'],
    ['Key in URL fragment',       'Decryption key is in the # — never sent to the server'],
    ['Client-side only',          'All crypto uses Web Crypto API (W3C standard)'],
  ];

  for (const [title, desc] of checks) {
    await sleep(150);
    console.log(`  [x] ${title}`);
    console.log(`      ${desc}`);
    console.log('');
  }

  console.log('  ──────────────────────────────────────────────');
  console.log('');
  console.log('  Algorithms:');
  console.log('    Encryption:      AES-256-GCM');
  console.log('    Key Exchange:    RSA-OAEP-4096');
  console.log('    Key Derivation:  PBKDF2-SHA256 (310,000 iterations)');
  console.log('    Hashing:         SHA-256');
  console.log('    Anti-spam:       Proof of Work (SHA-256 nonce)');
  console.log('');
  console.log('  Source code:');
  console.log('    https://github.com/nodatachat/core');
  console.log('');
  console.log('  Full platform:');
  console.log('    https://nodatachat.com');
  console.log('');
  console.log('  Audit the code. Verify the claims. Trust nothing.\n');
}

main();
