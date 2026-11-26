# Mycelium receipts: what they prove and how to check them

NoData Mycelium connects two organisations. Every command that crosses between them leaves two kinds of evidence, and this package checks both offline: no network, no NoData server, no secret.

## 1. The relay receipt

NoData signs one on every envelope it carries. The sender gets it in the answer to its send. The recipient gets it with the envelope when it opens it.

```json
{
  "payload": {
    "schema": "nodata.shield-relay-receipt/v1",
    "blob_id": "<envelope id>",
    "sender_kid": "<16 hex>",
    "recipient_kid": "<16 hex>",
    "route_taken": "capsule",
    "ciphertext_sha256_hex": "<sha256 of the ciphertext the relay stored>",
    "size_bytes": 1234,
    "ttl_at": "<ISO time>",
    "max_fetches": 1,
    "created_at": "<ISO time>",
    "released_sha256": "<sha256 of what the sender sealed, when it filed one>"
  },
  "signature_hex": "<Ed25519 over canonical(payload)>",
  "signing_pubkey_hex": "<hint only>",
  "signing_kid": "<hint only>"
}
```

`canonical` sorts object keys at every depth and keeps array order. It is the same rule as the evidence pack (EVIDENCE-PACK-FORMAT.md).

```
npx @nodatachat/protect@3 verify-relay-receipt receipt.json [--opened command.json]
```

| Check | What it proves |
|---|---|
| Shape | It is a v1 relay receipt for one envelope, sender address and recipient address. |
| Signed by NoData's published keys | A key pinned in `NODATA-KEYS.json` signed this payload. The key the receipt names is never trusted on its own. |
| What you opened is what the sender committed to (with `--opened`) | The sha256 of the bytes you opened equals the sender's `released_sha256`. For a command, those bytes are its canonical JSON. |

## 2. The decision on both chains

Before the relay stores or hands over anything, the decision is written as a signed receipt on each organisation's own chain:
- `surface: "fabric.send"`;
- `subject.blob_id`: the envelope;
- `data.side`: `"sender"` or `"recipient"`, or `"both"` inside one organisation.

A refusal is written the same way, with `decision: "deny"`.

Each organisation exports its own evidence pack: `GET /api/v1/proofs?format=pack&surface=fabric.send&blob=<envelope id>`, with its own key or console session. It contains only that organisation's decision scope. Then:

```
npx @nodatachat/protect@3 verify-both-sides sender-pack.json recipient-pack.json --blob <envelope id>
```

| Check | What it proves |
|---|---|
| Each pack verifies | All the evidence-pack checks hold on both packs, and both were signed by the pinned keys. That covers the payload hashes, signatures, chain links, external clock and inclusion. |
| On both chains | The first pack holds the sender's side for this envelope and the second holds the recipient's side, or the other way round. |
| Same decision | Both sides record the same decision (`allow` or `deny`). |

## 3. A file from a connection folder

When a partner's computer serves a file from a folder it exposed, the receiver has approved a projection of that folder: one Merkle root over one leaf per file (RFC 6962: leaf `sha256(0x00 | leaf)`, node `sha256(0x01 | left | right)`, an odd node promoted, never duplicated). The door checks the file against that root before carrying it. Since 2026-11-08 the evidence of that check travels in the relay receipt, signed:

```json
"folder": {
  "root": "<the approved root>",
  "leaf": { "v": 1, "ph": "<salted path hash>", "h": "<sha256 of the approved file>", "n": 1234, "mh": "<hash of the scan verdict>" },
  "proof": [ { "sibling": "<hex>", "sibling_is_right": true } ]
}
```

The leaf hash is `sha256("nodata.folder.leaf.v1|" + ph + "|" + h + "|" + n + "|" + mh)`. A clean copy also carries `source_sha256`, the original it was made from: the projection names originals.

```
npx @nodatachat/protect@3 verify-relay-receipt receipt.json --approval receiver-pack.json
```

| Check | What it proves |
|---|---|
| A member of the folder the receiver approved | The leaf climbs the proof to the root. |
| The approved file is the one released | The leaf's `h` is the released file, or for a clean copy its `source_sha256`. |
| The receiver approved this root (with `--approval`) | The receiver's own evidence pack verifies and holds its signed `fabric.grant` receipt for `folder_approve` naming this root. Export it with `GET /api/v1/proofs?format=pack&surface=fabric.grant`. |

The leaf holds the SENDER's scan verdict (`mh`). Membership proves the file is one of those the receiver approved. It does not prove the scan was right, which is why the receiving computer scans on arrival.

## 4. What an AI agent received

The same commitment rides every release to an agent, not only the Mycelium: the agent read (`v1.decrypt`, event `dal_key_release`, since 2026-11-24) and `access/retrieve` (table, document, folder) sign `data.released_sha256` over what the agent received in the response body: `sha256(canonical(rows))` for a read, `sha256(canonical(context))` for a table retrieve and `sha256(canonical(documents))` for a folder; for a document, `sha256` of the chunks' `text` joined by a blank line (`\n\n`). A document projected on the holder's side (`computed_by: holder`) commits the same way: the server signs the hashes and never receives the text. The read response returns it as `audit.released_sha256` beside `audit.release_receipt_id`. The same signed receipt names what was withheld: `columns_withheld`, `columns_requested_not_granted`, `keys_never_derived`, `rows_withheld_by_policy` (names and counts, never values).

```
npx @nodatachat/protect@3 verify-released org-pack.json --receipt <release_receipt_id> --received response.json
```

`response.json` is the response body the agent kept (`rows`, `context` or `documents`), or the bare array. The organisation exports the pack with `GET /api/v1/proofs?format=pack`.

| Check | What it proves |
|---|---|
| The organisation's pack verifies | Every evidence-pack check, and that NoData's pinned keys signed it. |
| What the agent received is what the receipt released | The hash of what you hold, in the form above, equals the signed `released_sha256`. |
| The same signed receipt states what was withheld | Lists the withheld columns, never-derived keys and held-back row counts the receipt signs. |

This proves what was released through the door. It does not prove what a model absorbed by another path (a cache, another tool, a copy already held in the clear): that bypass is closed only where the data is sealed at rest.

## What this does not prove

- **That the content was true or complete.** It proves what was sealed and carried, not that it was right.
- **That no other copy exists.** It covers what passed through the relay. A party can still copy what it opened.
- **The identity behind an address.** The receipt binds sender and recipient addresses. An organisation-signed sender identity is a separate, later step.
- **That every envelope is in your pack.** A pack holds what was exported. Inclusion in the hourly seals, which are anchored outside NoData, shows that a receipt existed at that time. It does not show that nothing was left out of the export.
