# @nodatachat/core

**Send secrets without storing them.**

No database. No accounts. View-once secure links. AES-256-GCM encryption.

Perfect for sending:
- Passwords & credentials
- API keys & tokens
- SSH keys
- `.env` files

```bash
npx nodata-send "AWS_SECRET_KEY=wJalr..."
```

```
  Encrypting with AES-256-GCM... done
  Creating zero-data drop... done

  Secure link: https://www.nodatacapsule.com/burn/Ab7K2m#x9f2...

  View once | 24h TTL | Zero storage
```

**Stop sending passwords in chat. Send a burner link instead.**

---

## How it works

```
You                          Server                      Recipient
 |                             |                            |
 |-- encrypt locally -------->|                            |
 |   (AES-256-GCM)            |                            |
 |                             |-- store encrypted blob -->|
 |                             |   (can't read it)         |
 |                             |                            |
 |-- send link with #key ---->|   (key never reaches       |
 |   (via any channel)        |    the server)             |
 |                             |                            |
 |                             |<-- fetch blob ------------|
 |                             |-- delete blob ----------->|
 |                             |                            |
 |                             |   decrypt in browser ----->|
```

The decryption key is in the URL fragment (`#...`) — **never sent to the server**.

---

## Quick start

```typescript
import {
  generateSeedPhrase,
  deriveBillingSerial,
  validateSeedPhrase,
  NoDataCrypto,
} from '@nodatachat/core';

// Generate a new identity
const seed = generateSeedPhrase();
// => ['abandon', 'ability', 'able', ...]

// Derive billing serial (one-way hash)
const serial = await deriveBillingSerial(seed);

// Encrypt a message
const keys = await NoDataCrypto.generateKeyPair();
const encrypted = await NoDataCrypto.encryptMessage('secret', keys.publicKeyJwk);
const decrypted = await NoDataCrypto.decryptMessage(encrypted, keys.privateKeyJwk);
// => 'secret'
```

## Use cases

**DevOps / Engineering**
- Send production database passwords to teammates
- Share API tokens without Slack/email
- Transfer SSH keys to new team members
- Deliver `.env` files securely

**Agencies / Client work**
- Send admin credentials to clients
- Share temporary login access
- Deliver API keys for integrations

**IT / Helpdesk**
- WiFi passwords for visitors
- Temporary access codes
- Onboarding credentials

## Security model

| What | How |
|------|-----|
| Encryption | AES-256-GCM (per-message ephemeral keys) |
| Key exchange | RSA-OAEP-4096 |
| Key derivation | PBKDF2-SHA256, 310,000 iterations |
| Hashing | SHA-256 with domain separation |
| Anti-spam | Proof of Work (SHA-256 nonce) |

**Zero knowledge** — server never sees plaintext or keys.
**No accounts** — identity is a 12-word seed phrase, generated on device.
**Burn after read** — secrets self-destruct after first view.
**Open code** — security comes from the keys, not from hiding the code.

## For auditors

This package is designed to be independently auditable:
- No network calls
- No filesystem access
- No side effects
- Only dependency: Web Crypto API (W3C standard)

---

## Merkle witness verification

NoData publishes an hourly **public witness feed** of all operator receipts at [github.com/proofbydefault/witness-feed](https://github.com/proofbydefault/witness-feed). Every UTC hour, all receipts in that window are sealed into a Merkle tree, the root is signed with Ed25519, and the commitment is written as a JSON file to that public repo.

The feed contains **only commitments** · receipt counts, Merkle roots, timestamps, prev-epoch chain links. No proof refs, no receipt ids, no tenant ids, no payloads. Zero business detail.

A receipt holder can prove inclusion **without trusting NoData servers**:

```typescript
import { verifyInclusion, type InclusionStep } from '@nodatachat/core';

// 1. Get your inclusion proof from your receipt page on www.nodatacapsule.com
//    (https://www.nodatacapsule.com/verify/ref/<your-ref> → expand sibling chain)
const leaf = 'a3f2b1c8...';                   // your receipt's event_hash
const proof: InclusionStep[] = [/* ... */];   // the sibling chain

// 2. Get the merkle_root for that hour from the public witness feed:
//    https://github.com/proofbydefault/witness-feed/blob/main/epochs/2026-05/2026-05-11-18.json
const expectedRoot = '9c8a4d...';

// 3. Verify locally · pure SHA-256 math, no network calls
const ok = await verifyInclusion(leaf, proof, expectedRoot);
// → true if the receipt was included in that epoch
```

**Why this matters** · once a seal is published, NoData cannot retroactively alter the receipt without forking GitHub history (which everyone would see). The witness feed is append-only third-party storage; the verifier runs in your environment with no NoData involvement.

Even if NoData disappears tomorrow, the GitHub feed + this verifier together still prove what existed at sealing time. Trust depends on Merkle math + GitHub, not on us staying honest, online, or alive.

See `examples/verify-inclusion.ts` for a runnable example.

---

## NoData Platform

This is the source-available cryptographic core of [**NoData**](https://www.nodatacapsule.com) — a zero-data secret delivery platform.

| Source-available (this repo) | Closed source (platform) |
|-------------------------|--------------------------|
| Encryption primitives | Web & mobile apps |
| Identity / seed phrase | Server infrastructure |
| Proof of work | User management |
| CLI tools | Payment / billing |
| | Report boxes |
| | Enterprise features |

**Website:** [www.nodatacapsule.com](https://www.nodatacapsule.com)

**CLI:**
```bash
npx nodata-send "your secret"       # send encrypted secret
npx nodata-proof                     # show architecture claims
```
