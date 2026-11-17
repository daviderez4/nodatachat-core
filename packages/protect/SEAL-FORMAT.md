# Seal format v3: sealed to your key, not to ours

NoData says two things about a secret or a file you seal with `nodata` or the
NoData MCP: **we do not see it** (it is encrypted on your computer before
anything leaves), and **we hold no key that opens it** (its file key is sealed
to public keys whose private halves are on your computer, and on your
organisation's if it adds one). This document is the whole format, so you can
check both claims against the bytes instead of trusting us.

The reference implementation is [`src/seal-v3.ts`](src/seal-v3.ts). It uses only
Node's built-in crypto and follows RFC 9180 line by line. NoData's software
seals with a different HPKE library (hpke-js). The two are separate paths, and
the vectors below come out the same from both. That shows the format is what
this page says, and not a quirk of one library.

## What it covers

| Covered | Not covered here |
|---|---|
| A secret in a `.env`, sealed by `nodata` (the `aes256gcm:v3:` token) | Governed links (`/lock`) and lockbox containers: their own formats |
| A file sealed by `nodata` or the NoData MCP (`<file>.ndc`), local or governed | How the organisation's 12 words become its master key (trust debt G2) |
| The organisation's copy inside a `.ndc` (`org_copy`) | The split-key format: [`SPLIT-KEY-FORMAT.md`](SPLIT-KEY-FORMAT.md) |

## 1. The device key

Your computer holds a 32-byte `seed` (`~/.nodata/device-key.json`, or
`NODATA_DEVICE_SEED` in CI). Everything else is derived from it:

- `secret_key = HKDF-SHA256(salt = empty, ikm = seed, info = "protect.env.x25519.v1", L = 32)`
- `public_key = X25519(secret_key, 9)` (32 bytes)
- `kid = hex(SHA-256(public_key))[0..16]`: the key's address, the same rule
  NoData uses for every X25519 key.

Only `public_key` and `kid` ever leave the computer.

## 2. The sealed DEK

Every value and every file gets its own fresh 32-byte AES key, the **DEK**. The
DEK is sealed to one recipient public key with HPKE (RFC 9180):

- mode base (`0x00`), no PSK, no sender key
- KEM `0x0020` DHKEM(X25519, HKDF-SHA256), KDF `0x0001` HKDF-SHA256,
  AEAD `0x0003` ChaCha20-Poly1305
- `info = "protect.env.v3|" ‖ kid_of_recipient` (UTF-8), `aad` empty, one
  message (sequence number 0)

The info names the recipient's own kid, so a blob sealed to one key does not
open as another key's, even when someone moves it around.

The sealed DEK is these bytes:

| offset | size | content |
|---|---|---|
| 0 | 1 | version `0x01` |
| 1 | 1 | suite `0x01` (the suite above) |
| 2 | 2 | `encLen` = 32, big-endian |
| 4 | 2 | `ctLen` = 48, big-endian |
| 6 | 32 | `enc`: the ephemeral X25519 public key |
| 38 | 48 | `ct`: the DEK encrypted with ChaCha20-Poly1305, then its 16-byte tag |

86 bytes in all. A reader refuses any other version, suite or length.

## 3. The token

The value is encrypted with AES-256-GCM under the DEK, with a fresh 12-byte IV
and no AAD. The token is

    aes256gcm:v3:<base64 iv>:<base64 (ciphertext ‖ 16-byte tag)>:<seal id>

The seal id names where the sealed DEK lives. For a `.env` value, NoData stores
it (`POST /api/v1/seal`) and returns it to the device on each open. For a file,
see below. A local file's id starts with `local-`. Read the token next to the
older versions:

    v1  aes256gcm:v1:iv:cipher:KEY      the key is in the file
    v2  aes256gcm:v2:iv:cipher:wrapId   the key is with NoData
    v3  aes256gcm:v3:iv:cipher:sealId   the key is sealed to you

## 4. The sealed file: `<file>.ndc`

A JSON object:

| field | content |
|---|---|
| `v`, `alg`, `enc` | `3`, `"aes256gcm:v3"`, `"base64"` |
| `kid` | the device key the DEK is sealed to |
| `orig` | the original file name |
| `token` | the token of §3. The encrypted value is the **base64 text** of the file's bytes (that is what `enc: "base64"` says) |
| `sealed_dek` | *local seal only:* the sealed DEK of §2, base64. The device key alone opens the file, with no one asked and nothing recorded |
| `governed` | *governed seal only*, instead of `sealed_dek`: `seal_id`, `principal`, `org_id`, `receipt_id`, `proof_ref`, `also_on`. NoData holds the sealed DEK and returns it to that device after a signed receipt, and never after a revoke. `also_on` lists the owner's other computers: each gets its own copy of the DEK, sealed to its own key |
| `sha256` | SHA-256 of the original file's bytes, hex |
| `sealed_at` | ISO-8601 time |
| `org_copy` | *optional:* `{ kid, sealed_dek }`, the same DEK sealed (§2) to the organisation's master public key. The organisation opens the file with its 12 words, without the computer, the person or NoData |

To open: open the sealed DEK with your key, decrypt the token, base64-decode
the result, and check that its SHA-256 equals `sha256`.

## What this proves

- **The content leaves your computer encrypted.** The `.ndc` and the token hold
  only AES-256-GCM ciphertext. The DEK appears only in sealed form.
- **The format has no NoData key.** Every sealed DEK is HPKE-sealed to a public
  key named by its kid: your device, your other computers, your organisation.
  Opening one needs that key's private half. A governed seal changes **where**
  the sealed DEK is kept (with NoData, which can refuse to hand it back). It does
  not change **who** can open it.
- **Every copy names its recipient.** Run `protect inspect-seal <file.ndc>` to
  see which keys a sealed file opens for, from its structure alone, with no key.
- **Tampering is refused.** ChaCha20-Poly1305 and AES-GCM are authenticated: a
  changed byte, a wrong key or a blob moved to another kid fails to open.

## What it does not prove

- **That the software that ran is this code.** NoData's `nodata` and MCP builds
  are minified. Tying them to this source is trust debt G1. What you can watch
  today is the traffic: only ciphertext, sealed DEKs, public keys and kids
  leave your computer.
- **That the private key stayed on the computer.** That depends on the
  computer.
- **What NoData does with a governed seal.** Handing the DEK back only after a
  receipt, and never after a revoke, is server behaviour. The receipts are
  checked by `verify-pack` (EVIDENCE-PACK-FORMAT.md), not by this format.
- **Secrecy of the metadata.** A `.ndc` holds these in the clear: the file name,
  the time, the key ids, the governed fields, the length (the ciphertext is
  4/3 of the file plus a tag), and the **SHA-256 of the content**. The hash lets
  anyone holding the `.ndc` confirm a guess of the exact content. For a file
  that could be one of a few known versions, treat that as disclosure.

## Test vectors

The block below is what `protect check-vectors` reads. The inputs that are
random in real use (`seed`, `dek`, the ephemeral `ikmE`, `iv`) are fixed here
as `SHA-256("nodata.seal.v3|vector-N|<name>")`, cut to 12 bytes for an IV.
`ikmE` goes through RFC 9180's `DeriveKeyPair` to give the ephemeral key, the
way the RFC's own vectors do. In real use, `ikmE` is 32 fresh random bytes.

- `rfc9180-a.2.1` is the RFC's own vector for this suite. It shows that the
  HPKE here is RFC 9180's, not a look-alike.
- `vector-1` is a `.env` value. `vector-2` is a local `.ndc` with an
  organisation copy. The organisation key here is derived like a device key
  only to have an X25519 key to seal to. How the 12 words make the real one is
  G2.

The check recomputes every expected field from the inputs, opens each sealed
DEK back, and requires the opened content to match.

<!-- seal-vectors -->
```json
[
  {
    "name": "rfc9180-a.2.1",
    "kind": "hpke",
    "source": "RFC 9180 Appendix A.2.1, encryption 0",
    "ikmE": "909a9b35d3dc4713a5e72a4da274b55d3d3821a37e5d099e74a647db583a904b",
    "ikmR": "1ac01f181fdf9f352797655161c58b75c656a6cc2716dcb66372da835542e1df",
    "info": "4f6465206f6e2061204772656369616e2055726e",
    "aad": "436f756e742d30",
    "pt": "4265617574792069732074727574682c20747275746820626561757479",
    "expect": {
      "pkR": "4310ee97d88cc1f088a5576c77ab0cf5c3ac797f3d95139c6c84b5429c59662a",
      "enc": "1afa08d3dec047a643885163f1180476fa7ddb54c6a8029ea33f95796bf2ac4a",
      "shared_secret": "0bbe78490412b4bbea4812666f7916932b828bba79942424abb65244930d69a7",
      "key": "ad2744de8e17f4ebba575b3f5f5a8fa1f69c2a07f6e7500bc60ca6e3e3ec1c91",
      "base_nonce": "5c4d98150661b848853b547f",
      "ct": "1c5250d8034ec2b784ba2cfd69dbdb8af406cfe3ff938e131f0def8c8b60b4db21993c62ce81883d2dd1b51a28"
    }
  },
  {
    "name": "vector-1",
    "kind": "value",
    "seed": "9c47b1268625096665e069080c7a4df9022df92233149799d2622369c96c426f",
    "dek": "00940e84fd97897d4dbf6d0bad2cc414bb1af3379847c26274bc6fffd70d021d",
    "ikmE": "a1f916a53807531b21e58c722e7a6527cf6732e59e437504ec9ae721a687da5c",
    "iv": "50356b03e3b1a26f578db293",
    "value": "postgres://app:s3cret@db.internal:5432/app",
    "seal_id": "seal-vector-1",
    "expect": {
      "public_key": "a9d502693e3fa952ec961cd77666f0b2d681fef21b43adfea7ae0a4e2e87b86d",
      "kid": "2b2b8f28ea7ed1cf",
      "sealed_dek": "010100200030573e55b19d6c837a90d18d7e4775bb443845826e4f73b1fd5f79ae69ed505b3e0a25db0f2046b57853bc3ad7da62d0f1dbc3923799b0f44f92bb880155bd88043cbd1008dcbac90a47f97d4374efd18c",
      "token": "aes256gcm:v3:UDVrA+Oxom9XjbKT:8kFaD3nNSkYpHfUBSs0W6fjIVMzUBReXC5wHWn1K+WHf31URq4fzjiuMiuwW0wdD0eCIAWMM12u7dw==:seal-vector-1"
    }
  },
  {
    "name": "vector-2",
    "kind": "file",
    "seed": "ca86f08bba5537f534d7b8329917174e905a135133fb51c00491da423f167775",
    "org_seed": "e4ab5a4b1d11c2ffa3c7512fded117fbcf631fe9de9e72664cd1c2819893210b",
    "dek": "fa6293b2b6ac8d5370f63ad822ba2f95d2829a1830c6615611580c6faafcaa50",
    "ikmE": "15e6e5492d3455f11955b74d660214bbdbdb09f71df5a624162ea31c50648b69",
    "org_ikmE": "112b7bb531cde5f487d677a3f153debb4eacf5a6ad2c3fa3498e64071155517a",
    "iv": "0fd00ec130474bd0c46cdc87",
    "file_hex": "d7a1d795d79320d79ed7a1d797d7a8d79920c2b7207472616465207365637265740a",
    "orig": "secret.txt",
    "seal_id": "local-vector-2",
    "sealed_at": "2026-10-20T00:00:00.000Z",
    "expect": {
      "public_key": "e45aff2c910776c00da765a1dee8393e2b56e5d6b1bc42897b7dee4321bf675f",
      "org_public_key": "af22a0f00f08c8969c86a39397faff7acc26c006d1f5a23dc3c2131e61ea0741",
      "ndc": {
        "v": 3,
        "alg": "aes256gcm:v3",
        "kid": "dcac9e087d7ff6d5",
        "orig": "secret.txt",
        "enc": "base64",
        "token": "aes256gcm:v3:D9AOwTBHS9DEbNyH:LDj9Bjk6UfnWPlFopNEyTiHRR4tM4tTEkkfIa3Lxx2eyOUvk2tos/voyFAzq0GpviXzyfy7S8+jr78MPnT3VcA==:local-vector-2",
        "sealed_dek": "AQEAIAAw/wcZXGXIOBgX4CDz7LcUBvz0dvY5o/riD/H0NWasFAubDpJOiBVShqnejMyFWCvJaNwesubVkUPerRErx9iogZpARfLkGhxUkxNy6mDM19U=",
        "sha256": "d4341c3530d8d6d3630ef052ec6a9d1195531908e17bfca087472989a45c5a52",
        "sealed_at": "2026-10-20T00:00:00.000Z",
        "org_copy": {
          "kid": "5fba2a05d2fe855f",
          "sealed_dek": "AQEAIAAwk3QkP4IVtM5vEnHTRmG4RNT1cgC2ntYcuKX5JvL22h78W2S6nVG/1jy4fQ8MacH9BZjoJ8OTqI0lSgycOiHsOt/5rvKgf4PU9FpA3aLN+Ps="
        }
      }
    }
  }
]
```
