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

  Secure link: https://nodatachat.com/burn/Ab7K2m#x9f2...

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

## NoDataChat Platform

This is the open-source cryptographic core of [**NoDataChat**](https://nodatachat.com) — a zero-data secret delivery platform.

| Open source (this repo) | Closed source (platform) |
|-------------------------|--------------------------|
| Encryption primitives | Web & mobile apps |
| Identity / seed phrase | Server infrastructure |
| Proof of work | User management |
| CLI tools | Payment / billing |
| | Report boxes |
| | Enterprise features |

**Website:** [nodatachat.com](https://nodatachat.com)

**CLI:**
```bash
npx nodata-send "your secret"       # send encrypted secret
npx nodata-proof                     # show architecture claims
```
