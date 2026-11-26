# @nodatachat/protect: NoData's verification layer

This package lets you check NoData's claims without trusting NoData, and (agent-check) what your AI agent did, without trusting anyone. It does not
run NoData, has no CLI for the product and makes no network calls. It holds the
formats, their specs, test vectors, and the code that checks them. The code is
shipped readable (not minified) because it is meant to be read.

> Looking for the old `protect` CLI (`init`, `encrypt`, `run`)? It moved to
> `@nodatachat/nodata`: `npm i -g @nodatachat/nodata`.

## What you can check today

### "NoData holds only half a key" (split-key format v1)

An API key or a secret is split on your computer into two 1024-byte halves.
NoData stores one; your computer keeps the other and joins them in memory.

- [`SPLIT-KEY-FORMAT.md`](SPLIT-KEY-FORMAT.md): the whole format, what it proves
  and what it does not.
- `dist/split-key.js`: the implementation (about 70 lines). NoData's software
  runs this same module.
- Check that the code matches the published format:

  ```bash
  npx @nodatachat/protect@3 check-vectors
  ```

  It recomputes the vectors from the spec and prints `PASS` or `FAIL`. It needs
  nothing but Node.

What this proves: NoData's half is random bytes drawn apart from the value, so on
its own it says nothing about the value, not even its length. What it does not
prove on its own: that the software on your computer never also sends your half.
You can watch that in the traffic: the only split material that leaves is the
1024-byte `server` half.

### "We do not see it, and we hold no key that opens it" (seal format v3, 3.4.0)

A secret or a file you seal with `nodata` or the NoData MCP is encrypted on your
computer with a fresh AES-256-GCM key per item. That key is HPKE-sealed
(RFC 9180) to public keys whose private halves stay with you: your device, your
other computers, and your organisation's master key.

- [`SEAL-FORMAT.md`](SEAL-FORMAT.md): the device key, the sealed key's bytes,
  the `.env` token, the `.ndc` file, what this proves, and what it does not.
  That includes what a `.ndc` shows in the clear.
- `dist/seal-v3.js`: a readable reference implementation that uses Node's
  crypto only. NoData's software seals with a different HPKE library, and both
  produce the same vectors.
- `check-vectors` (above) now also recomputes the seal vectors, starting with
  RFC 9180's own vector for this suite.
- See whom a sealed file of yours opens for, from its structure, with no key:

  ```bash
  npx @nodatachat/protect@3 inspect-seal report.pdf.ndc
  ```

What it does not prove on its own: that the `nodata` and MCP builds you ran are
this code (trust debt G1). You can watch the traffic instead: only ciphertext,
sealed keys, public keys and key ids leave your computer.

### "Every decision leaves a proof you can check" (evidence pack format v1)

Every release, open, revoke or policy decision writes a signed receipt into a
chain. An evidence pack is a JSON export of those receipts with their signatures
and public keys.

- [`EVIDENCE-PACK-FORMAT.md`](EVIDENCE-PACK-FORMAT.md): the format, the exact
  bytes each signature covers (Ed25519, and ML-DSA-65 for the
  quantum-resistant half), the seven checks, and what a pack does not prove.
- [`EVIDENCE-PACK-EXAMPLE.json`](EVIDENCE-PACK-EXAMPLE.json): a complete pack
  signed with public test keys, so you can see every check pass and then break it.
- Verify a pack you were given, or the example:

  ```bash
  npx @nodatachat/protect@3 verify-pack pack.json
  ```

  It prints PASS or FAIL for each check and exits 0 only if all of them hold.
  The last check is **who signed**: every signing key must be one of NoData's
  keys pinned in [`NODATA-KEYS.json`](NODATA-KEYS.json). A published npm version
  cannot change, so NoData cannot swap a key quietly. The example pack is signed
  with test keys, so check it with
  `--keys node_modules/@nodatachat/protect/EVIDENCE-PACK-EXAMPLE-KEYS.json`.

### Receipt signing contexts (3.3.0)

Since 2026-10-19 every NoData receipt chain signs `<context>|...` and names the
context in `sig_suite` (`;ctx=nd-decision-receipt.v1`, `nd-operator-receipt.v1`,
`nd-protect-receipt.v1`); a decision receipt also binds its scope (`scope_ref`).
**Versions before 3.3.0 do not know this and report such receipts as "signature
does NOT verify".** Use 3.3.0 or later for packs exported after that date; 3.3.1
pins the active key's `receipt_context_since` (2026-10-19T09:50:04.571Z). When a
release pins a key's `receipt_context_since`, a context-free receipt that key
signed after it fails too.

### Mycelium: one transfer, both organisations (3.4.0; connection-folder membership 3.5.0)

[`FABRIC-RECEIPT-FORMAT.md`](FABRIC-RECEIPT-FORMAT.md) describes the two kinds of evidence a transfer between two organisations leaves, and what they do not prove.

```bash
# The receipt NoData signs on the envelope; with --opened, what you opened is what the sender committed to.
npx @nodatachat/protect@3 verify-relay-receipt receipt.json --opened command.json
# A file from a connection folder: a member of the projection the receiver approved, and the receiver's own receipt approving it.
npx @nodatachat/protect@3 verify-relay-receipt receipt.json --approval receiver-pack.json
# The same decision on both organisations' chains: one pack exported by each side.
npx @nodatachat/protect@3 verify-both-sides sender-pack.json recipient-pack.json --blob <envelope id>
```

Both verify only against the keys pinned in [`NODATA-KEYS.json`](NODATA-KEYS.json), never against a key the evidence names.

### What an AI agent received, against the receipt that released it (3.11.0)

The agent read, `access/retrieve` (table, document, folder) and a governed Mycelium send sign `released_sha256` over
what the agent received. With the organisation's evidence pack and the response the agent kept, this checks, offline,
that the two match, and reads back what the same receipt says was withheld (column and key names, counts, never values).

```bash
npx @nodatachat/protect@3 verify-released org-pack.json --receipt <release_receipt_id> --received response.json
```

It proves what was released through the door, not what a model absorbed by another path
([`FABRIC-RECEIPT-FORMAT.md`](FABRIC-RECEIPT-FORMAT.md) §4).

## What did your AI agent touch? (agent-check, 3.6.0)

One command checks your AI coding agent instead of NoData, from the history the
agent already keeps on your computer. No install, no account, nothing sent.

```sh
npx @nodatachat/protect@3 agent-check            # the last 30 days
npx @nodatachat/protect@3 agent-check --days 90 --lang he
```

It reads only `~/.claude/projects` (Claude Code) and `~/.codex/sessions` (Codex),
and reports counts per category: credential files, commands that print a
credential, searches for passwords and keys, data files, and commands that send
data out. For each it keeps three things apart:

- **tried**: the agent asked a tool to touch it;
- **succeeded**: the tool did not report an error (Claude Code records this; Codex does not, so it shows "—");
- **secrets returned**: secret-looking values (a key, a token, `NAME_KEY=value`) came back into the agent's context.

An attempt is not an exposure. The report and the HTML card it writes hold numbers
and category names only: never a path, a command or a value. The card has no
script and loads nothing. It sees only what the agents wrote to their own history,
so it is a floor, not a complete record.

### One set of rules (3.7.0)

The rules are plain patterns in [`src/agent-rules.ts`](src/agent-rules.ts):
which files hold logins, which commands print a credential, which variable
names hold secrets, which searches look for them, and what a provider key looks
like. NoData's read gate imports this same file, so what agent-check counts and
what the gate looks at are classified by one piece of code, and a test in each
holds them to it. Read the rules, and argue with them.

They are a transparent basic layer, not the security boundary and not a list
of everything the gate refuses. The free check counts by file type and open
patterns; the NoData gate also reads the content, finds personal data in it,
applies the organisation's rules, asks a person, and signs a receipt. None of
that is in this package, and a test keeps it out: every shipped module may
import only Node, this package's one dependency, and other shipped modules.

### The event format (3.8.0)

`agent-check --events` prints the **local** report: one finding per line, in the public
event format v1 ([`src/agent-events.ts`](src/agent-events.ts)): source, agent, time to the
minute, action, a general category, outcome, exposure, sample, whether NoData's gate stopped
it, the exact rule, and the location (path, line, and a fingerprint made from the location
only, with a salt that stays on your computer). It is printed and written nowhere else.

The shareable card is built from the same events as counts per category over a window of
days: no time of day, no path, no line, no fingerprint, no rule name. A test holds that.

Exposure is decided by evidence only: **yes** when a key-shaped value is in what came back
to the agent; **no** when nothing came back (the call failed, or the gate stopped it);
**unknown** otherwise, a successful read with no key pattern found included.

This is a reporting format. NoData's gate does not read it and does not decide by it.

### Terms before the first run, and what to do next (3.10.0)

Before it reads anything the first time, agent-check prints the four points of its terms
(the full terms: [whatmyagentsaw.com/terms](https://whatmyagentsaw.com/terms/)), the
sentence you agree to ("I have read and agree to the Terms of Use, including the disclaimer
of warranties and the limitation of liability."), and asks `Agree and continue? [y/N]`.
Anything but `y` or `yes` exits with code 0, having read nothing. The agreement is kept on
your computer only, beside the salt, as `~/.agent-check/consent.json`: the terms version
(a date, the same as the site's), when you accepted, and a hash of the two. No name, no
email, no identifier, and nothing is sent. A new terms version asks again
([`src/agent-terms.ts`](src/agent-terms.ts)).

Without a terminal (CI, a pipe) it never waits: it prints one line and exits with code 2,
unless you pass `--accept-terms`. With `--json` or `--events` the terms and the question go
to stderr, so stdout stays clean.

The report now ends with the next steps, in the order of
[whatmyagentsaw.com/next](https://whatmyagentsaw.com/next/): the five free ones first (see
where with `--events`, rotate what came back, move secrets out of reach, deny the reads in
the agent's own settings, check again next week), then NoData's gate, described only by
what it does by default: it holds and asks, and it warns after outside content. The card
carries the same steps, with no path, no link and no script.

## Coming next

Each release adds only what is needed to verify a claim NoData makes: next is
how the organisation's 12 words become its master key (G2).

Requires Node 20.19 or later. The one dependency is `@noble/post-quantum`, for
ML-DSA-65, which Node does not provide.

## License

Apache-2.0 (since 3.5.1; earlier 3.x versions were FSL-1.1-ALv2). See `LICENSE.md` and `NOTICE`.
Only this verification layer is open source; NoData's product is not part of it.

Source and releases: https://github.com/daviderez4/nodatachat-core. Every version from 3.5.1 on is
published from there by GitHub Actions with an npm provenance attestation.
