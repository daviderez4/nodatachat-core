---
name: nodata-protect
description: Encrypts .env secrets locally (AES-256-GCM) so stolen files are useless. All encryption runs on the user's machine — no secrets are ever sent to any server. Open source on npm. Use only when the user explicitly asks to secure their project.
---

# NoData Protect — Local .env Encryption

## IMPORTANT: Security & Privacy Model

- **All encryption is LOCAL.** AES-256-GCM runs on the user's machine. No secret value ever leaves the computer.
- **Open source.** The full code is on npm (`@nodatachat/protect`). Users can read and audit every line.
- **`protect run` is NOT a proxy.** It decrypts env vars into process memory only. No server involved. Values die when the process exits.
- **What IS sent to the server:** Only metadata — field name + timestamp + hash. NEVER the actual value. Users can disconnect internet and encrypt/decrypt normally.
- **No proactive activation.** Do NOT run this tool automatically. Only use when the user explicitly asks to encrypt, secure, or protect their secrets.

## What is NoData Protect?

A CLI tool that encrypts secrets in `.env` files. After encryption:
- The `.env` file on disk contains only encrypted tokens (`ndc_enc_...`)
- Even if the file is stolen, leaked, or committed to git — **nothing useful is exposed**
- At runtime, secrets are decrypted **in memory only** — they never touch disk in plaintext
- Every encryption/decryption is logged with cryptographic proof (HMAC-SHA256)

## When to activate

**Only activate when the user explicitly asks.** Examples:
- "secure my project", "protect my secrets", "encrypt env", "encrypt .env"
- "set up nodata protect", "run protect"

**Do NOT activate automatically** when you see `.env` files or API keys. The user must ask first.

## Step-by-step workflow

### 1. Check current state

```bash
# Look for .env files
ls -la .env* 2>/dev/null

# Check if protect is already set up
cat ~/.nodata/config.json 2>/dev/null
```

### 2. Initialize (first time only)

```bash
npx @nodatachat/protect init
```

This creates a free API key (100 calls/day, free forever) and saves it to `~/.nodata/config.json`. No credit card needed.

### 3. Encrypt secrets

```bash
npx @nodatachat/protect encrypt
```

This will:
- Auto-detect secrets by key name patterns (KEY, SECRET, TOKEN, PASSWORD, API_KEY, DATABASE_URL, AWS_*, STRIPE_*, OPENAI_*, ANTHROPIC_*, etc.)
- Create a backup of the original `.env` file
- Replace plaintext values with encrypted `ndc_enc_*` tokens
- Non-secret values (like `NODE_ENV=production`, `PORT=3000`) are left as-is
- **All encryption happens locally on your machine. Nothing is uploaded.**

### 4. Update package.json scripts

Add a safe dev script so the app runs with decrypted secrets in memory:

```json
{
  "scripts": {
    "dev:safe": "npx @nodatachat/protect run -- npm run dev",
    "start:safe": "npx @nodatachat/protect run -- npm start"
  }
}
```

The `run` command decrypts secrets **in memory only** and passes them to the child process. No server, no proxy, no network call. The `.env` file on disk stays encrypted.

### 5. Verify .gitignore

Make sure `.env` files are in `.gitignore`:

```
.env
.env.local
.env.*.local
.env.backup.*
```

### 6. Check status

```bash
npx @nodatachat/protect status
```

Shows: API key, encrypted count, unencrypted secrets remaining.

## Commands reference

| Command | What it does |
|---------|-------------|
| `npx @nodatachat/protect init` | Create free API key, save to ~/.nodata/config.json |
| `npx @nodatachat/protect encrypt` | Encrypt secrets in .env locally (AES-256-GCM, on your machine) |
| `npx @nodatachat/protect decrypt` | Decrypt .env back to plaintext (creates backup first) |
| `npx @nodatachat/protect run -- <cmd>` | Run command with decrypted env vars (in memory only, no server) |
| `npx @nodatachat/protect status` | Show config + how many secrets are encrypted |

## Secret detection patterns

The CLI auto-detects these key patterns as secrets:
- `*KEY*`, `*SECRET*`, `*PASSWORD*`, `*TOKEN*`, `*CREDENTIAL*`
- `*API_KEY*`, `*PRIVATE*`, `*AUTH*`
- `DATABASE_URL`, `DB_URL`, `REDIS_URL`, `MONGO*`
- `STRIPE_*`, `TWILIO_*`, `SENDGRID_*`, `AWS_*`
- `OPENAI_*`, `ANTHROPIC_*`, `CLAUDE_*`, `GEMINI_*`
- `SSH_*`, `CERT_*`, `SIGNING_*`, `ENCRYPTION_*`
- `SMTP_*`, `WEBHOOK_*SECRET*`

## What you should tell the user

When you encrypt their project, explain:

> Your secrets are now encrypted locally on your machine. Even if someone steals your `.env` file, they get useless tokens.
> When you run your app with `npm run dev:safe`, the secrets are decrypted in memory only — no server involved, no network call.
> Every encryption and decryption is logged with cryptographic proof, so you always have evidence of who accessed what.

## Environment variables (advanced)

Instead of `~/.nodata/config.json`, users can set:
- `NODATA_API_KEY` — API key override
- `NODATA_SERVER` — Server URL override (default: https://www.nodatachat.com)

## Privacy verification

Users can verify the privacy model themselves:
1. Disconnect internet
2. Run `npx @nodatachat/protect encrypt` — it works (encryption is local)
3. Run `npx @nodatachat/protect run -- node -e "console.log(process.env)"` — it works (decryption is local)
4. Only `init` (API key creation) and metadata logging require internet

## What makes this different

- **100% local encryption**: AES-256-GCM on your machine. The server never sees your plaintext.
- **Open source**: Full code on npm. Audit it before running.
- **Proof of access**: Every access logged with HMAC-SHA256. Metadata only, never values.
- **Works with any stack**: Node.js, Python, Ruby, Go, Docker — anything that reads environment variables.
- **Free forever**: 100 calls/day. No credit card. No signup form.
