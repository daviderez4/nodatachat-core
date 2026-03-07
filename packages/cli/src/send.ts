#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// nodata-send — Send encrypted, self-destructing secrets
// Uses the Zero-Data Delivery Protocol by NoDataChat
// ═══════════════════════════════════════════════════════════

const NODATA_API = process.env.NODATA_API || 'https://nodatachat.com';
const NODATA_WEB = process.env.NODATA_WEB || 'https://nodatachat.com';

// ── Helpers (no external deps — uses Node.js built-in crypto) ──

async function encrypt(plaintext: string): Promise<{ encrypted: string; iv: string; key: string }> {
  const { webcrypto } = await import('node:crypto');
  const subtle = webcrypto.subtle;

  // Generate random AES-256 key
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  // Generate random IV
  const iv = webcrypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    encoded
  );

  // Export key as raw bytes → base64url
  const rawKey = await subtle.exportKey('raw', aesKey);

  return {
    encrypted: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    key: Buffer.from(rawKey).toString('base64url'),
  };
}

// ── CLI ──

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let secret = '';
  let ttl = 24;
  let noBurn = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--expire' && args[i + 1]) {
      const val = args[i + 1];
      if (val.endsWith('m')) ttl = Math.max(1, Math.ceil(parseInt(val) / 60));
      else if (val.endsWith('h')) ttl = parseInt(val);
      else ttl = parseInt(val);
      i++;
    } else if (args[i] === '--no-burn') {
      noBurn = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      return;
    } else if (!args[i].startsWith('--')) {
      secret = args[i];
    }
  }

  // Read from stdin if no argument
  if (!secret) {
    if (process.stdin.isTTY) {
      printHelp();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    secret = Buffer.concat(chunks).toString('utf-8').trim();
  }

  if (!secret) {
    console.error('Error: No secret provided.');
    process.exit(1);
  }

  // Step 1: Encrypt locally
  process.stdout.write('\n  Encrypting with AES-256-GCM...');
  const { encrypted, iv, key } = await encrypt(secret);
  console.log(' done');

  // Step 2: Send encrypted blob to server
  process.stdout.write('  Creating zero-data drop...');

  try {
    const res = await fetch(`${NODATA_API}/api/burn/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_blob: encrypted,
        iv,
        ttl_hours: ttl,
        burn_after_read: !noBurn,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.error(` failed\n\n  Error: ${(err as { error?: string }).error || res.statusText}`);
      process.exit(1);
    }

    const data = await res.json() as { drop_id: string; expires_at: string };
    console.log(' done\n');

    // Step 3: Build secure link (key is in fragment — never sent to server)
    const link = `${NODATA_WEB}/burn/${data.drop_id}#${key}`;

    console.log(`  Secure link: ${link}`);
    console.log('');
    console.log(`  ${noBurn ? 'Expires' : 'View once'} | ${ttl}h TTL | Zero storage`);
    console.log('');
    console.log('  The decryption key is in the URL fragment (#...)');
    console.log('  The server never sees it.\n');
    console.log('  Powered by NoDataChat — https://nodatachat.com\n');
  } catch (err) {
    console.error(` failed\n\n  Could not reach ${NODATA_API}`);
    console.error('  Set NODATA_API env var if using a custom server.\n');
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
  nodata-send — Encrypted, self-destructing secrets

  Usage:
    nodata-send "your secret message"
    echo "secret" | nodata-send
    nodata-send "DB_PASSWORD=abc123" --expire 1h

  Flags:
    --expire <time>   Expiry time: 10m, 1h, 24h (default: 24h)
    --no-burn         Don't delete after first read
    --help, -h        Show this help

  How it works:
    1. Your secret is encrypted locally (AES-256-GCM)
    2. Only the encrypted blob is sent to the server
    3. The decryption key is in the URL fragment (#...)
    4. The server NEVER sees your plaintext or key

  Zero-Data Delivery Protocol by NoDataChat
  https://nodatachat.com
`);
}

main();
