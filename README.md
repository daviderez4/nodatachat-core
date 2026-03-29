<div align="center">

<img src="assets/banner.svg" alt="NoData — Local-first security for developers" width="100%"/>

<br/>

**Your code stays on your machine. Your secrets stay encrypted. Every access is proven.**

[![npm](https://img.shields.io/npm/v/@nodatachat/protect?color=%2300ffa3&label=%40nodatachat%2Fprotect)](https://www.npmjs.com/package/@nodatachat/protect)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://typescriptlang.org)
[![Encryption](https://img.shields.io/badge/encryption-AES--256--GCM-green)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

</div>

---

## The Problem

Your `.env` file contains your database password, your API keys, your cloud credentials — **in plain text**.

One poisoned npm package. One `git push` mistake. One stolen laptop. **Game over.**

```
OPENAI_API_KEY=sk-proj-Ax7Q...        ← anyone can read this
DATABASE_URL=postgres://prod:pass@...  ← and this
STRIPE_KEY=sk_live_4eC39...            ← and this
```

## The Fix: One Command

```bash
npx @nodatachat/protect encrypt
```

```
OPENAI_API_KEY=ndc_enc_7f3a8b...      ← useless if stolen
DATABASE_URL=ndc_enc_4c1d7a...         ← useless if stolen
STRIPE_KEY=ndc_enc_c3d9a0...           ← useless if stolen
```

Your app still works. Secrets are decrypted **in memory only** at runtime:

```bash
npx @nodatachat/protect run -- npm start
# Secrets exist only in RAM. Never on disk.
```

---

## Quick Start

```bash
# 1. Setup (creates free API key — no signup, no credit card)
npx @nodatachat/protect init

# 2. Encrypt all secrets in .env
npx @nodatachat/protect encrypt

# 3. Run your app with decrypted secrets (memory only)
npx @nodatachat/protect run -- npm run dev

# 4. Check status
npx @nodatachat/protect status
```

Works with **any stack**: Node.js, Python, Go, Ruby, Docker, docker-compose.

---

## Claude Code Skill

Install once — ask your AI to encrypt your secrets when you need it:

```bash
mkdir -p ~/.claude/skills/nodata-protect && \
curl -sL https://raw.githubusercontent.com/daviderez4/nodatachat-core/main/skill/nodata-protect/SKILL.md \
  -o ~/.claude/skills/nodata-protect/SKILL.md
```

**What happens after install:**
- Ask Claude to encrypt your `.env` — it knows how
- Encryption is local (AES-256-GCM, on your machine)
- Adds `dev:safe` to `package.json`
- Verifies `.gitignore` covers sensitive files
- Works with Claude Code, Cursor, Windsurf

> **The skill does NOT activate automatically.** It only runs when you ask. You're in control — the AI executes.

---

## Cryptographic Proof

Every encryption and decryption generates **HMAC-SHA256 proof**:

| What | Proof |
|------|-------|
| Secret encrypted | Timestamp + device ID + field hash |
| Secret accessed | When, from where, which device |
| Secret destroyed | Proof of deletion with hash chain |

**You don't trust your secrets are safe. You prove it.**

---

## Security Model

| State | Without NoData | With NoData |
|-------|---------------|-------------|
| On disk (.env) | Plaintext | Encrypted (`ndc_enc_`) |
| In Git (accident) | Catastrophic | Harmless |
| In CI/CD logs | Can leak | `ndc_enc_` only |
| In memory (runtime) | Plaintext | Plaintext (same) |
| Stolen by malware | Full access | Nothing useful |

**Design principles:**
- **100% local encryption** — AES-256-GCM runs on your machine. No secret ever leaves your computer.
- **Open source** — full code on npm. Read it, audit it, verify every line before running.
- **`run` is not a proxy** — decrypts to process memory only. No server, no network call. Values die with the process.
- **What IS sent:** only metadata (field name + timestamp + hash). Never the actual value. Disconnect internet and verify.
- **Audit-ready** — cryptographic proof chain for compliance (SOC 2)

---

## How We're Different

| | NoData | HashiCorp Vault | AWS Secrets Manager | SOPS | GitGuardian |
|---|---|---|---|---|---|
| Setup time | **10 seconds** | Hours | 30 min | 15 min | 10 min |
| Free tier | **100/day forever** | Self-host | Paid | Self | Free (scan) |
| Access proof | **HMAC-SHA256** | Audit log | CloudTrail | No | No |
| AI-native skill | **Yes** | No | No | No | No |
| Zero knowledge | **Yes** | No | No | Partially | No |
| Fixes issues | **Yes** | No | No | No | No |

---

## Packages

```
nodatachat-core/
  packages/
    crypto/      Low-level encryption (AES-256-GCM, RSA-OAEP, PBKDF2)
    core/        Identity, seed phrases, zero-data drops
    cli/         CLI tools — nodata-send, nodata-proof
  skill/
    nodata-protect/   Claude Code Skill for automatic .env protection
```

## Full Protection: NoData Agent

This repo is the **open-source core** — encryption, basic scanning, CLI tools.

**For full protection:**
- 46+ SOC controls deep scan
- Automatic vulnerability fixes
- Continuous monitoring daemon
- Slack/Telegram alerts
- Compliance certificates

**[Run NoData Agent](https://www.nodatachat.com/protect)**

---

## Links

- **Website:** [nodatachat.com](https://www.nodatachat.com)
- **Protect page:** [nodatachat.com/protect](https://www.nodatachat.com/protect)
- **npm:** [@nodatachat/protect](https://www.npmjs.com/package/@nodatachat/protect)
- **Claude Code Skill:** [Install instructions](#claude-code-skill-ai-native-security)
- **SOC Scanner:** [nodatachat.com/soc-scanner](https://www.nodatachat.com/soc-scanner)

---

<div align="center">

**Open code builds trust. Closed logic builds advantage.**

Your secrets encrypted. Your control. Your proof.

[Get Started](https://www.nodatachat.com/protect) · [npm](https://www.npmjs.com/package/@nodatachat/protect) · [Docs](packages/core/src/README.md) · [Examples](packages/core/examples/)

</div>
