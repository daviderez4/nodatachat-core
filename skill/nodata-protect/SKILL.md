---
name: nodata-protect
description: Converts .env secrets to AES-256-GCM ciphertext via NoData's blind-relay server. The default format (v2, since CLI 1.3.0) wraps every per-encrypt key under a server-held KEK — a stolen .env file alone is useless ciphertext. Server never persists plaintext (in-memory only, audit log is metadata-only). Decrypted values live in subprocess RAM at runtime, never on disk. Free tier = unlimited encrypt + decrypt, forever (burst protection only). Open source on npm. Use only when the user explicitly asks to secure their project.
---

# NoData Protect — .env Encryption via Blind Relay

## IMPORTANT: Security & Privacy Model (be precise — users ask)

- **Blind relay architecture.** The plaintext value IS sent over HTTPS to `/api/v1/encrypt` on the NoData server. The server generates a fresh AES-256-GCM key, encrypts, returns the ciphertext, and does NOT persist the plaintext. This is NOT local-only encryption — network access is required.
- **What the server persists:** Zero plaintext. The `field_access_log` table stores metadata only: field name, device_id, timestamp, hashed IP, action. NEVER the value.
- **Runtime decrypt path.** `protect run` calls `/api/v1/decrypt` for each secret. Server returns plaintext over HTTPS → CLI injects into the subprocess's `process.env` → values live in that process's RAM only, never touch disk. Values disappear when the process exits.
- **What the .env looks like after encrypt.**
  - **v2 (default since CLI 1.3.0, Apr 20 2026):** each value becomes `aes256gcm:v2:<iv>:<ciphertext>:<wrapped_dek_id>`. The actual AES key is encrypted under a server-held KEK and stored in `nd_wrapped_deks`; the `.env` carries only the opaque ID. **A stolen `.env` file alone is useless ciphertext** — decryption requires an authenticated `/api/v1/decrypt` call from the owning device. Existing v1 `.env` files: `nodata encrypt --upgrade` converts them in place, with backup.
  - **v1 (legacy, used by `--legacy` flag or pre-1.3.0 installs):** each value becomes `aes256gcm:v1:<iv>:<ciphertext>:<key>`. **v1 limitation:** the AES key is base64-bundled in that same string, so a motivated technical attacker with a stolen .env can decrypt it in a few lines. Still skipped by automated scrapers (see below).
- **Why both v1 and v2 help.** Real-world .env leaks are overwhelmingly automated scraper bots (GitHub secret scanning, pastebin scrapers) and supply-chain stealers (LiteLLM-style `grep "sk-" .env` code). These tools look for known plaintext prefixes (`sk_live_`, `ghp_`, `AKIA`). Neither `aes256gcm:v1:` nor `aes256gcm:v2:` matches, so bots skip the file. That covers ~95% of real-world leaks. v2 additionally defeats targeted attackers with the file but no API access.
- **Open source.** The full CLI code is on npm (`@nodatachat/protect`). Users can read and audit every line.
- **No proactive activation.** Do NOT run this tool automatically. Only use when the user explicitly asks to encrypt, secure, or protect their secrets.

## What is NoData Protect?

A CLI tool that converts `.env` secrets to ciphertext via a blind-relay server. After encryption:
- The `.env` file on disk contains encrypted tokens (`aes256gcm:v2:...` is the default since CLI 1.3.0; `aes256gcm:v1:...` only on `--legacy` or pre-1.3.0 installs)
- v2: a stolen `.env` file alone is useless — the AES key is wrapped under a server-held KEK and only the owning device can request unwrap
- Automated scraper bots and supply-chain stealers skip both formats (they don't match known plaintext patterns)
- At runtime, `protect run` decrypts via HTTPS call and injects into subprocess RAM — never touches disk
- Every encryption/decryption is logged server-side with cryptographic proof of access (metadata only)

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

This creates a free API key (unlimited encrypt + decrypt, forever) and saves it to `~/.nodata/config.json`. No credit card needed.

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

> Your `.env` is now in NoData's encrypted format (`aes256gcm:v2:...` — the default since CLI 1.3.0). Scraper bots and supply-chain stealers skip it — that's ~95% of real-world .env leaks. **v2 also defeats targeted attackers**: the AES key for each value is wrapped under a server-held KEK and stored on our server; a stolen `.env` file alone is useless ciphertext, because decryption requires an authenticated server call from the owning device. (Older v1 files: `nodata encrypt --upgrade` converts them in place, with backup. Free tier = 100 API calls/day.)
> When you run your app with `nodata run -- <your-cmd>`, the CLI calls our server over HTTPS to decrypt each secret, injects them into your subprocess's process.env (RAM only), and those values disappear when the process exits. Our server never persists plaintext — only metadata in the audit log.
> Every encryption and decryption is logged server-side with a cryptographic proof chain, so you always have evidence of who accessed what and when.

## Environment variables (advanced)

Instead of `~/.nodata/config.json`, users can set:
- `NODATA_API_KEY` — API key override
- `NODATA_SERVER` — Server URL override (default: https://www.nodatacapsule.com)

## Privacy verification

Users can verify the privacy model themselves:
1. Disconnect internet
2. Run `npx @nodatachat/protect encrypt` — it works (encryption is local)
3. Run `npx @nodatachat/protect run -- node -e "console.log(process.env)"` — it works (decryption is local)
4. Only `init` (API key creation) and metadata logging require internet

## Integration Hub Commands

Beyond encrypting secrets, NoData offers a full feature ecosystem. These commands connect your project to the NoData Hub for tracking and feature management.

### Connect to Hub

```bash
npx @nodatachat/protect connect
```

Links this project to the NoData Hub. The admin at nodatacapsule.com sees the project in `/admin/integrations`. Requires the API key to be linked to a project in the Hub.

### Check available features

```bash
npx @nodatachat/protect features
```

Shows a table of all NoData features — what's installed, what's available, and what tier is needed:

```
Feature          Status       Tier         Description
──────────────── ──────────── ──────────── ──────────────────────────────
encrypt          ● active     free         AES-256-GCM field-level enc...
burn             ○ available  free         Self-destructing links with...
scan             ○ available  free         Deep compliance scanner — 4...
channel          ○ available  business     Encrypted system-to-system ...
capsule          ○ available  capsule      Daemon: auto-fix, git hooks...
```

### Health check

```bash
npx @nodatachat/protect check
```

Verifies: API key, server connection, heartbeat latency, .env encryption status.

### Integration workflow (step by step)

When a user says "integrate NoData" or "add NoData features", walk them through:

1. **Init** — `npx @nodatachat/protect init` (if no API key yet)
2. **Connect** — `npx @nodatachat/protect connect` (link to Hub)
3. **Features** — `npx @nodatachat/protect features` (see what's available)
4. **Encrypt** — `npx @nodatachat/protect encrypt` (protect secrets)
5. **Check** — `npx @nodatachat/protect check` (verify everything works)

The admin can install/uninstall features from the Hub at `/admin/integrations`. The CLI reflects changes automatically.

### Available features

| Feature | Tier | What it does |
|---------|------|-------------|
| encrypt | free | AES-256-GCM field-level encryption |
| burn | free | Self-destructing links (TTL + read limits) |
| proof | free | HMAC-SHA256 delivery receipts |
| protect | free | .env encryption (this CLI!) |
| scan | free | SOC compliance scanner (46+ controls) |
| channel | business | Encrypted system-to-system transfer |
| nda | business | Digital NDA before document access |
| vault | business | Zero-knowledge document storage |
| guard | business | Dual-report CLI (local + cloud metadata) |
| webhook | business | Encrypted webhook relay |
| deliver | business | Burn-after-read delivery + proof chain |
| capsule | capsule | Daemon: auto-fix, git hooks, CI/CD, alerts |

## What makes this different

- **Stolen `.env` alone = useless** (v2): the per-encrypt key is wrapped server-side; the file on disk holds only an opaque ID.
- **Blind relay**: plaintext transits the server's RAM during encrypt/decrypt but is never persisted.
- **Open source**: full code on npm. Audit it before running.
- **Proof of access**: every access logged with HMAC-SHA256. Metadata only, never values.
- **Works with any stack**: Node.js, Python, Ruby, Go, Docker — anything that reads environment variables.
- **Free forever**: unlimited encrypt + decrypt on every tier. Burst protection only (120/min). No credit card, no signup form, no "upgrade for more calls" wall.
