# @nodatachat/protect: NoData's verification layer

This package lets you check NoData's claims without trusting NoData. It does not
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
