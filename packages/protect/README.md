# @nodatachat/protect

Encrypt your `.env` secrets. Run your app safely. Real keys never touch disk.

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
Before:  OPENAI_API_KEY=sk-proj-Ax7Q...        (plaintext — stealable)
After:   OPENAI_API_KEY=ndc_enc_7f3a8b...      (encrypted — useless if stolen)

Runtime: npx @nodatachat/protect run -- npm start
         → decrypts in memory only → your app gets real values
         → secrets never written to disk
```

## Commands

| Command | What it does |
|---------|-------------|
| `npx @nodatachat/protect init` | Create API key, save to `~/.nodata/config.json` |
| `npx @nodatachat/protect encrypt` | Encrypt secrets in .env file |
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

| State | Without NoData | With NoData |
|-------|---------------|-------------|
| On disk (.env) | Plaintext | Encrypted (`ndc_enc_`) |
| In Git (accident) | Catastrophic | Harmless |
| In CI/CD logs | Can leak | `ndc_enc_` only |
| In memory (runtime) | Plaintext | Plaintext (same) |
| Stolen by malware | Full access | Nothing useful |

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
- `NODATA_SERVER` — Server URL (default: `https://www.nodatachat.com`)

## Free Tier

100 encryptions/month. No credit card. No signup form. Just run `npx @nodatachat/protect init`.
