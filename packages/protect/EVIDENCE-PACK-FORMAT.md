# Evidence pack format v1: a file an auditor can check without NoData

Every action NoData decides on (a release, an open, a revoke, a policy decision)
writes a signed **receipt** into a chain. An **evidence pack** is a JSON export of
receipts, with their signatures and public keys, that anyone can verify
offline. You need the pack, this document and maths; you do not need NoData.

```bash
npx @nodatachat/protect@3 verify-pack pack.json
```

The reference verifier is [`src/verify-pack.ts`](src/verify-pack.ts).
[`EVIDENCE-PACK-EXAMPLE.json`](EVIDENCE-PACK-EXAMPLE.json) is a complete pack
signed with **test keys derived from public seeds** (not NoData's keys). Every
check in it passes, and any edit to it fails one.

## Canonical JSON

`canonical(v)`: `null`, numbers, strings and booleans as `JSON.stringify` writes
them; arrays in order; objects with their keys sorted (by UTF-16 code unit) **at
every depth**; no whitespace.

## Shape

```json
{
  "nodata_evidence_pack": {
    "version": 1,
    "generated_at": "…",
    "receipts": [ Receipt, … ],
    "epoch_seals": [ EpochSeal, … ],
    "epoch_seals_error": null,
    "epoch_seals_truncated": false,
    "…": "other descriptive fields (tenant, counts, recipe), all covered by the signature",
    "nodata_signature": "hex",
    "signing_pubkey_hex": "hex, 32 bytes",
    "signing_kid": "…",
    "signed_at": "…"
  }
}
```

**Receipt:** `id`, `chain_index`, `event_type`, `payload`, `event_hash`,
`prev_receipt_id`, `created_at`, `signature_hex`, `signing_pubkey_hex`,
`signing_kid`, `pq_signature_hex`, `pq_pubkey_hex`, `sig_suite`, and optionally
`inclusion` (since 2026-10-19):

```json
"inclusion": {
  "epoch_seal_id": "<id of a seal in epoch_seals>",
  "merkle_version": 2,
  "path": [{ "sibling": "<hex>", "sibling_is_right": true }]
}
```

`path` climbs from the receipt's `event_hash` to the seal's `merkle_root`.
`merkle_version` 1: node = SHA-256(left || right), the leaf used as is.
`merkle_version` 2 (RFC 6962): leaf = SHA-256(0x00 || event_hash bytes), node =
SHA-256(0x01 || left || right), an odd node promoted unchanged. Receipts not yet
sealed carry no `inclusion`. A receipt that names a seal the server could not prove it is under
carries `path: null` and `server_check` (e.g. `leaf_not_in_epoch`), and fails check 8: it is never
presented as merely "not yet sealed". The field is additive: a v1 reader ignores it.

`merkle_version` is not inside the signed root bytes; it only selects the tree construction. A path
cannot reach the same 32-byte root under both constructions, so a wrong version can only fail.

**Epoch seal:** `id`, `epoch_number`, `merkle_root` (hex, 32 bytes), `merkle_version`,
`signed_root_hex`, `signing_pubkey_hex`, `ots_anchored_at`,
`published_to_witness_at`, `published_url`, and more.

## The signed bytes

| What | Algorithm | Bytes signed |
|---|---|---|
| The export (envelope) | Ed25519 | UTF-8 of `canonical(nodata_evidence_pack without nodata_signature, signing_pubkey_hex, signing_kid, signed_at)` |
| A receipt | Ed25519 **and** ML-DSA-65 (FIPS 204) | UTF-8 of `[context + "|"] + event_hash + "|" + (prev_receipt_id or "") + "|" + chainTime(created_at)` |
| An epoch seal | Ed25519 | the **raw 32 bytes** of `merkle_root` (not its hex string) |

`event_hash` = hex `SHA-256(UTF-8 of canonical(payload))`.

**Signing context** (since 2026-10-19): a decision receipt whose `sig_suite` contains
`;ctx=<label>` signed `<label>|` before the chain input. The only label NoData issues is
`nd-decision-receipt.v1`, and NoData's other uses of the same key refuse to sign bytes in that
context, so a signature made for anything else cannot pass as a receipt. The verifier fails a receipt
with any other label, and a context-free signed receipt that follows (in the chain) a receipt that
had one.

`chainTime(t)` is the spelling of the time that was signed. The database may hand
the same instant back differently (`…978+00:00`, `…06.48+00:00` with a trailing
zero trimmed, or with microseconds), so the verifier:

1. accepts `YYYY-MM-DD` + `T` or space + `hh:mm:ss[.fraction]` + optional zone;
2. leaves any non-zero offset as it is, since it is a different spelling of a
   different instant;
3. pads the fraction to **at least** three digits and never truncates it;
4. writes `YYYY-MM-DDThh:mm:ss.fffZ`.

It never parses to a date type, because that would drop microseconds.

## The checks (in order)

1. **Export signature:** proves the file was not edited after it was generated.
   It says nothing yet about the receipts inside.
2. **Payload hashes:** every `event_hash` is recomputed from its payload.
3. **Receipt Ed25519:** this proves that a specific receipt was issued at that
   position and time. A receipt with no signature (issued before its chain was
   signed) is *skipped*, not failed. A pack in which no receipt is signed does
   **not** pass: it proves nothing without NoData.
4. **Receipt ML-DSA-65:** the quantum-resistant signature over the same bytes.
   Absent is skipped. A receipt whose `sig_suite` claims ML-DSA but which carries
   no PQ signature fails.
5. **Chain coherence:** where the pack holds the receipt at `chain_index − 1`,
   `prev_receipt_id` must name it. Gaps are reported; they are expected when the
   export covers only part of the chain. Two signed receipts naming the same
   `prev_receipt_id` are a fork and fail; a repeated `chain_index` (unsigned) is
   only reported.
6. **Zero-Read:** every `lockbox_issued` receipt carries a
   `wrapped_key_envelope` to a customer key, and no payload contains an email,
   an IPv4 address or PEM key material. A pack with no `lockbox_issued` receipt
   gets only the plaintext scan.
7. **External clock:** each epoch seal's root signature verifies, and at least
   one seal is anchored in Bitcoin (`ots_anchored_at`). A signed but unanchored
   seal leaves the time on NoData's word and does not pass. If
   `epoch_seals_error` is set, the anchor status is *unknown*, which is not the
   same as absent, and the check does not pass.

8. **Per-receipt inclusion** (only when some receipt carries `inclusion`): each
   path climbs from the receipt's `event_hash` to the `merkle_root` of the seal it
   names, and that seal is in the pack (its root signature and anchor are check
   7). This ties "the receipt is signed" to "the root is witnessed": the receipt
   was not held back from the sealed set. Receipts with no path are reported. Each seal reached must
   carry a valid root signature, and check 8 passes only if check 7 (the external clock) passes.

9. **Signer:** every key that signs something in the pack is one of NoData's keys
   pinned in [`NODATA-KEYS.json`](NODATA-KEYS.json), **for that role**. Chain keys
   sign receipts and seal roots; envelope signers sign the envelope. A key pinned
   for one role does not count for another. A keys file that pins nothing is not a
   pass. A published npm version cannot change, so NoData cannot swap a key
   quietly: a new key counts only once a new version lists it, publicly, next to
   the old ones. To check the example pack, pass its test keys:
   `verify-pack EVIDENCE-PACK-EXAMPLE.json --keys EVIDENCE-PACK-EXAMPLE-KEYS.json`.

The pack passes only when every check that applies passes. **No check passes on
missing evidence.**

## What a pack does not prove

- **Nothing by itself about who signed.** Every key rides on the pack, so anyone
  can mint a key and sign a flawless pack. That is the signer check above.
- **That a receipt without a path is inside a sealed epoch.** A seal commits to a
  whole epoch; only receipts that carry `inclusion` are tied to it (check 8).
- **That nothing was released without a receipt.** A pack shows what was
  recorded, not what was not. Closing that is trust debt G5.
