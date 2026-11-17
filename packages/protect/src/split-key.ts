// Half a key: the reference implementation of the split NoData keeps.
//
// A secret or an API key is XOR-split on the person's computer into two halves
// of a fixed size. NoData holds one, the computer the other; neither alone says
// anything, not even the length. This file is the format, in the open, so the
// claim "NoData holds only half a key" can be checked by reading it instead of
// trusting us. The format is written out in SPLIT-KEY-FORMAT.md, with vectors
// anyone can recompute. The NoData MCP uses this very module.

import { createHash, randomBytes } from "node:crypto";

/** Both halves have this size, whatever the key's length (as the server expects). */
export const SHARE_BYTES = 1024;

/** 2 bytes length + 4 bytes check. */
export const HEAD = 6;

function xor(a: Buffer, b: Buffer): Buffer {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = a[i] ^ b[i];
  return out;
}

/** The first 4 bytes of SHA-256(value): two halves that do not belong together
 *  are refused instead of joining into garbage that looks like a value. */
function check(v: Buffer): Buffer {
  return createHash("sha256").update(v).digest().subarray(0, 4);
}

/**
 * The split with its randomness supplied: `random(n)` gives n bytes. Only the
 * published vectors pass anything but real randomness; `splitKey` is what runs.
 * NoData's half is `random(SHARE_BYTES)` itself — drawn before and apart from
 * the value, so on its own it is independent of it.
 */
export function splitKeyWith(key: string, random: (n: number) => Buffer, minBytes = 8): { server: Buffer; client: Buffer } {
  const k = Buffer.from(key, "utf8");
  if (k.length < minBytes || k.length > SHARE_BYTES - HEAD) throw new Error(`the value must be ${minBytes} to ${SHARE_BYTES - HEAD} bytes`);
  const padded = random(SHARE_BYTES);
  padded.writeUInt16BE(k.length, 0);
  check(k).copy(padded, 2);
  k.copy(padded, HEAD);
  const server = random(SHARE_BYTES);
  const client = xor(padded, server);
  padded.fill(0);
  k.fill(0);
  return { server, client };
}

/** value → (NoData's half, this computer's half). Length-prefixed, checked, and
 *  padded with random bytes, so a half does not even reveal how long it is. */
export function splitKey(key: string, minBytes = 8): { server: Buffer; client: Buffer } {
  return splitKeyWith(key, randomBytes, minBytes);
}

/** The two halves → the value. Throws when they do not belong together. */
export function joinKey(client: Buffer, server: Buffer, minBytes = 8): string {
  if (client.length !== SHARE_BYTES || server.length !== SHARE_BYTES) throw new Error("the halves are not the right size");
  const padded = xor(client, server);
  const n = padded.readUInt16BE(0);
  const ok = n >= minBytes && n <= SHARE_BYTES - HEAD && check(padded.subarray(HEAD, HEAD + n)).equals(padded.subarray(2, HEAD));
  if (!ok) {
    padded.fill(0);
    throw new Error("the halves do not belong together");
  }
  const key = padded.subarray(HEAD, HEAD + n).toString("utf8");
  padded.fill(0);
  return key;
}
