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

> **Stuck on any step?** Run `nodata doctor`. It performs 9 checks (config, API key, network, server heartbeat, device binding, .env state…) and prints the exact command to fix anything that's off — plus a privacy note showing exactly what it touched.

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
| `npx @nodatachat/protect doctor` | Full self-diagnostic (9 checks + suggested next steps + privacy note) |
| `npx @nodatachat/protect doctor --verbose` | Same, plus the full command catalog |
| `npx @nodatachat/protect sign <file>` | Sign a single file → writes `<file>.nodatasig` sidecar |
| `npx @nodatachat/protect sign --dir <path>` | Sign a whole folder (Merkle tree) → one `.nodata-tree.sig` at root |
| `npx @nodatachat/protect sign <file> --region <id>` | Sign a marked region (between `@nodata-sign-begin`/`-end <id>`) |
| `npx @nodatachat/protect verify <file>` | Verify a signed file |
| `npx @nodatachat/protect verify --dir <path>` | Verify the tree manifest — surfaces every added/removed/modified file |
| `npx @nodatachat/protect verify <file> --region <id\|all>` | Verify region(s) — flags any silent edits |

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

**Unlimited encrypt + decrypt** on a single device, with signed receipts on every operation. No credit card, no signup form. Just run `npx @nodatachat/protect init`.

Internal business use is free too — including small businesses, agencies, contractors working on client projects, CI pipelines. The only thing the license forbids is repackaging Protect itself as a competing service. See [LICENSE.md](./LICENSE.md).

Burst protection: 120 calls / minute (per IP). Daily volume: see your tier in `nodata doctor`.

## License

**Functional Source License (Apache 2.0).** Open source. You can read every line on GitHub, audit it, fork it, contribute via PR. Personal and internal-business use is free forever. The one thing forbidden during the active window is offering Protect as a competing hosted service.

The license **auto-converts to Apache 2.0 on 2028-04-25** — every version published before that date becomes fully open source. We're not closing the door, we're delaying it by two years.

Same model used by Sentry, Keygen, Outline.

## Signing code (folders, files, regions)

Beyond `.env` encryption, Protect can also sign source code so any edit is provable:

```bash
# Sign a single file
nodata sign main.ts

# Sign a whole folder — Merkle tree, single sidecar at root
nodata sign --dir src/

# Sign a marked region inside a file
# (in main.ts, wrap the code with markers)
#   // @nodata-sign-begin payment-flow
#   ... your code ...
#   // @nodata-sign-end payment-flow
nodata sign main.ts --region payment-flow

# Verify nothing has been silently edited
nodata verify --dir src/                       # whole tree
nodata verify main.ts --region payment-flow    # single region
nodata verify main.ts --region all             # every region in the file
```

Marker comment styles supported: `//` (JS/TS/C/Go/Rust/Java), `#` (Python/shell/Ruby/YAML), `--` (SQL/Lua), `/* ... */` (CSS), `<!-- ... -->` (HTML).

The bundled Claude Code Skill (`skill/SKILL.md`) tells AI assistants to refuse modifying signed regions without first running `verify` and asking the human — so an over-eager AI rewrite cannot silently break your chain of custody.

## Troubleshooting

If a command fails, the first thing to run is:

```bash
npx @nodatachat/protect doctor
```

It runs 9 checks (config dir, device id, API key from 5 sources, nickname, network, heartbeat, tier + features, device binding, .env detection) and prints the exact command to fix each failing step. The bottom of every run includes a privacy note explaining what doctor read and what (if anything) it transmitted.
