# @nodatachat/protect

Encrypt your `.env` secrets. Run your app safely. **A stolen `.env` file alone is useless ciphertext.**

> Default since `1.3.0` (Apr 20 2026). Older v1 `.env` files keep working — upgrade them in place with `nodata encrypt --upgrade`. The `--legacy` flag forces the old key-bundled-in-file behavior if you need it for a specific environment.

## Quick Start

```bash
# Setup (creates free API key — no signup, no credit card)
npx @nodatachat/protect init

# Encrypt all secrets in .env
npx @nodatachat/protect encrypt

# Run your app with decrypted env vars (in memory only)
npx @nodatachat/protect run -- npm run dev
```

## How It Works

```
Before:  OPENAI_API_KEY=sk-proj-Ax7Q...                   (plaintext — matches scraper regex)
After:   OPENAI_API_KEY=aes256gcm:v2:x8Kd:cipher:wrapId   (encrypted — key wrapped server-side¹)

Runtime: npx @nodatachat/protect run -- npm start
         → calls NoData server with API key + device_id → server unwraps DEK → returns plaintext
         → CLI injects into subprocess RAM → secrets never written to disk
```

## Commands

| Command | What it does |
|---------|-------------|
| `npx @nodatachat/protect init` | Create API key, save to `~/.nodata/config.json` |
| `npx @nodatachat/protect encrypt` | Encrypt secrets in .env file (v2 by default) |
| `npx @nodatachat/protect encrypt --legacy` | Encrypt as v1 (key bundled in file) — emergency fallback |
| `npx @nodatachat/protect encrypt --upgrade` | Re-encrypt existing v1 entries as v2 (in-place, with backup) |
| `npx @nodatachat/protect decrypt` | Decrypt .env back to plaintext |
| `npx @nodatachat/protect run -- <cmd>` | Run command with decrypted env vars (memory only) |
| `npx @nodatachat/protect status` | Show config + encrypted count |

## What Gets Encrypted?

Auto-detects secrets by key name:
- `*_API_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`
- `DATABASE_URL`, `REDIS_URL`, `MONGO_*`
- `AWS_*`, `STRIPE_*`, `OPENAI_*`, `ANTHROPIC_*`
- And 20+ more patterns...

Non-secret values (`PORT`, `NODE_ENV`, etc.) are left as-is.

## Security Model

| State | Without NoData | With NoData (v2, **default**) |
|-------|---------------|-------------------------------|
| On disk (.env) | Plaintext | `aes256gcm:v2:iv:cipher:wrapId` (key not in file) |
| In Git (accident) | Bots scrape in seconds | Bots skip; targeted attacker also stuck — needs API key + matching device_id |
| In CI/CD logs | `sk-proj-...` leaks | `aes256gcm:v2:...` leaks (just an opaque ID — useless without server) |
| In memory (runtime) | Plaintext | Plaintext (same) |
| Automated scraper bot | Full access | Skipped — 95% of real leaks |
| Targeted technical attacker | Full access | Cannot decode without an authenticated server call from the owning device |
| Server (NoData) | N/A | Never persists plaintext; audit metadata only; server-held KEK wraps every per-encrypt DEK |

> Legacy v1 (`aes256gcm:v1:iv:cipher:KEY`) bundled the AES key inside the file, so a motivated attacker with the file alone could decrypt it. v1 is still supported for decrypt and via `--legacy` for emergency encrypt; upgrade existing v1 files with `nodata encrypt --upgrade`.

## Changelog

- **1.3.0** (Apr 20 2026) — v2 server-held KEK is the default. New `--upgrade` migrates v1 → v2 in place. New `--legacy` flag forces v1 if needed.
- **1.2.0** — Recognized v2 ciphertext on decrypt; encrypt still defaulted to v1.
- **1.1.0** — Initial public release.

## Cryptographic Proof

Every encryption and decryption is logged with HMAC-SHA256 proof:
- **Proof of encryption** — you know when each secret was encrypted
- **Proof of access** — every decryption leaves a signed receipt
- **Proof of control** — your data is yours, even after it leaves your machine

## Claude Code Integration

Add the NoData security skill to Claude Code so it automatically protects your projects:

```bash
# Create the skill directory
mkdir -p ~/.claude/skills/nodata-protect

# Download the skill
curl -sL https://raw.githubusercontent.com/daviderez4/nodatachat-core/main/skill/nodata-protect/SKILL.md \
  -o ~/.claude/skills/nodata-protect/SKILL.md
```

Once installed, Claude Code will:
- Detect unprotected `.env` files in your projects
- Suggest encrypting secrets automatically
- Add `dev:safe` scripts to your `package.json`
- Verify `.gitignore` covers sensitive files

## Environment Variables

Override config with environment variables:
- `NODATA_API_KEY` — API key (overrides `~/.nodata/config.json`)
- `NODATA_SERVER` — Server URL (default: `https://www.nodatacapsule.com`)

## Free Tier

100 encryptions/month. No credit card. No signup form. Just run `npx @nodatachat/protect init`.
