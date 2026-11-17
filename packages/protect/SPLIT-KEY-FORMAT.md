# Split-key format v1: half a key, not the key

NoData says: **we hold only half a key.** An API key or a secret is split on your
computer into two halves. NoData stores one half and releases it by your rules;
your computer keeps the other half and joins the two in memory when a command
needs the value. This document is the whole format, so you can check that claim
yourself instead of trusting us. The reference implementation is
[`src/split-key.ts`](src/split-key.ts); the NoData MCP runs that same module.

## Layout

Both halves are exactly **1024 bytes**, whatever the length of the value.

1. `value` is the UTF-8 bytes of the secret, `L = len(value)`, `0 ≤ L ≤ 1018`
   (the API gateway also requires `L ≥ 8`).
2. `padded` is 1024 bytes:

   | offset | size | content |
   |---|---|---|
   | 0 | 2 | `L`, unsigned big-endian |
   | 2 | 4 | `SHA-256(value)[0..4]` (a check, so that halves which do not belong together are refused instead of joining into garbage) |
   | 6 | `L` | `value` |
   | 6 + L | 1018 − L | random bytes |

3. `server` = 1024 fresh random bytes. **This is the half NoData stores.**
4. `client` = `padded XOR server`. **This is the half your computer keeps.**

Join: `padded = client XOR server`, read `L`, take `value = padded[6 .. 6+L]`,
and accept it only when `SHA-256(value)[0..4]` equals `padded[2..6]` and
`L ≤ 1018`. Otherwise the halves do not belong together, and the value is refused.

## What this proves

- **NoData's half says nothing about the value, including its length.** It is
  drawn at random, independently of the value (step 3). This is a one-time pad:
  every value of every length up to 1018 bytes is equally consistent with it.
- **Your half alone says nothing either.** It is `padded` masked by uniformly
  random bytes of the same length.
- **Both halves give the value.** So what NoData can release is only its half.
  Joining happens where the other half lives, on your computer.

What the format cannot show: that NoData never *also* receives your half. That
depends on the software on your computer. You can observe it in the traffic: the
only split material that leaves your computer is the 1024-byte `server` half.

## Test vectors

The vectors fix the randomness so that anyone can recompute them. The *n*-th call
(counting from 0) for `n` bytes returns the first `n` bytes of

    SHA-256(seed | "|" | n_call  ‖ u32be(0)) ‖ SHA-256(seed | "|" | n_call ‖ u32be(1)) ‖ …

where `seed | "|" | n_call` is the UTF-8 string, for example
`nodata.split-key.v1|vector-1|0`. Call 0 is the padding in step 2 (its first 6
bytes are then overwritten) and call 1 is `server`.

| seed | value | SHA-256(server) | SHA-256(client) |
|---|---|---|---|
| `nodata.split-key.v1\|vector-1` | `sk-test-0123456789abcdef` | `fe11765573f7cfa5501a7100992ea5f0c7df28ad31db456c78d5dfcb5775102a` | `2c9d897a795aef730079a1d2254f49b4fd69ca55dc1cf4eb0a3f05dc4ca44a73` |
| `nodata.split-key.v1\|vector-2` | `סוד-בעברית ✓ unicode` | `a9e98b307b81ea0367b67387269e3cc0a832335597c044c4a79363473b0599f3` | `d0df96825022ec848d05f6ccde266c3dccef0ccabdca9f7593df8b37dad588a2` |
| `nodata.split-key.v1\|vector-3` | `x` × 1018 (the maximum) | `c789b0563ac9a15ecba1da328c87ece5a52b493f894343daa32d6c529158cc20` | `e2fb152777cf5d8adf1a1e8d9c12a84d9bf1e5a38554a564815453a112d29124` |

`splitKeyWith(value, random)` in the reference implementation takes that
randomness as a parameter; `splitKey` passes real randomness.
