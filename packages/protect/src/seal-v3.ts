// Seal format v3, written out so it can be read: the reference implementation of
// SEAL-FORMAT.md. It uses nothing but Node's own crypto (X25519, HMAC-SHA-256,
// ChaCha20-Poly1305, AES-256-GCM), on purpose: the product seals with the hpke-js
// library (src/hpke.ts), and this file reaches the same bytes by a second,
// independent path, line by line from RFC 9180. When both agree on the vectors,
// the format is what the spec says and not what one library happens to do.
//
// It never talks to anyone, and it holds no NoData key: there is none to hold.
//
//   npx @nodatachat/protect@3 check-vectors       recomputes the vectors in SEAL-FORMAT.md
//   npx @nodatachat/protect@3 inspect-seal f.ndc  says whom a sealed file opens for

import { createCipheriv, createDecipheriv, createHash, createHmac, createPrivateKey, createPublicKey, diffieHellman, randomBytes } from "node:crypto";

// ── RFC 9180, base mode: DHKEM(X25519, HKDF-SHA256) · HKDF-SHA256 · ChaCha20-Poly1305 ──

const KEM_ID = 0x0020;
const KDF_ID = 0x0001;
const AEAD_ID = 0x0003;
const MODE_BASE = 0x00;

const u16 = (n: number) => Buffer.from([n >> 8, n & 0xff]);
const KEM_SUITE = Buffer.concat([Buffer.from("KEM"), u16(KEM_ID)]);
const HPKE_SUITE = Buffer.concat([Buffer.from("HPKE"), u16(KEM_ID), u16(KDF_ID), u16(AEAD_ID)]);

const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

/** HKDF-Extract (RFC 5869). An empty salt is HMAC's zero key, as the RFC says. */
function extract(salt: Buffer, ikm: Buffer): Buffer {
  return hmac(salt, ikm);
}

/** HKDF-Expand (RFC 5869). */
function expand(prk: Buffer, info: Buffer, length: number): Buffer {
  const out: Buffer[] = [];
  let t = Buffer.alloc(0);
  for (let i = 1; out.length * 32 < length; i += 1) {
    t = hmac(prk, Buffer.concat([t, info, Buffer.from([i])]));
    out.push(t);
  }
  return Buffer.concat(out).subarray(0, length);
}

/** RFC 9180 §4: every derivation is labelled with the version and the suite. */
function labeledExtract(suite: Buffer, salt: Buffer, label: string, ikm: Buffer): Buffer {
  return extract(salt, Buffer.concat([Buffer.from("HPKE-v1"), suite, Buffer.from(label), ikm]));
}

function labeledExpand(suite: Buffer, prk: Buffer, label: string, info: Buffer, length: number): Buffer {
  return expand(prk, Buffer.concat([u16(length), Buffer.from("HPKE-v1"), suite, Buffer.from(label), info]), length);
}

// X25519 through Node's KeyObject: the raw 32 bytes wrapped in their fixed DER prefix.
const PKCS8_X25519 = Buffer.from("302e020100300506032b656e04220420", "hex");
const SPKI_X25519 = Buffer.from("302a300506032b656e032100", "hex");

function x25519Public(secretKey: Buffer): Buffer {
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_X25519, secretKey]), format: "der", type: "pkcs8" });
  return createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
}

function x25519(secretKey: Buffer, publicKey: Buffer): Buffer {
  return diffieHellman({
    privateKey: createPrivateKey({ key: Buffer.concat([PKCS8_X25519, secretKey]), format: "der", type: "pkcs8" }),
    publicKey: createPublicKey({ key: Buffer.concat([SPKI_X25519, publicKey]), format: "der", type: "spki" }),
  });
}

/** RFC 9180 §7.1.3 DeriveKeyPair for X25519. The ephemeral key of a seal is this, on 32 random bytes. */
export function hpkeDeriveKeyPair(ikm: Buffer): { secretKey: Buffer; publicKey: Buffer } {
  const prk = labeledExtract(KEM_SUITE, Buffer.alloc(0), "dkp_prk", ikm);
  const secretKey = labeledExpand(KEM_SUITE, prk, "sk", Buffer.alloc(0), 32);
  return { secretKey, publicKey: x25519Public(secretKey) };
}

/** RFC 9180 §4.1 ExtractAndExpand: the KEM's shared secret, bound to both public keys. */
function kemSharedSecret(dh: Buffer, enc: Buffer, pkR: Buffer): Buffer {
  const prk = labeledExtract(KEM_SUITE, Buffer.alloc(0), "eae_prk", dh);
  return labeledExpand(KEM_SUITE, prk, "shared_secret", Buffer.concat([enc, pkR]), 32);
}

/** RFC 9180 §5.1 KeySchedule, base mode (no PSK, no sender key). */
export function hpkeKeySchedule(sharedSecret: Buffer, info: Buffer): { key: Buffer; baseNonce: Buffer } {
  const pskIdHash = labeledExtract(HPKE_SUITE, Buffer.alloc(0), "psk_id_hash", Buffer.alloc(0));
  const infoHash = labeledExtract(HPKE_SUITE, Buffer.alloc(0), "info_hash", info);
  const context = Buffer.concat([Buffer.from([MODE_BASE]), pskIdHash, infoHash]);
  const secret = labeledExtract(HPKE_SUITE, sharedSecret, "secret", Buffer.alloc(0));
  return {
    key: labeledExpand(HPKE_SUITE, secret, "key", context, 32),
    baseNonce: labeledExpand(HPKE_SUITE, secret, "base_nonce", context, 12),
  };
}

function chachaSeal(key: Buffer, nonce: Buffer, aad: Buffer, pt: Buffer): Buffer {
  const c = createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  c.setAAD(aad, { plaintextLength: pt.length });
  return Buffer.concat([c.update(pt), c.final(), c.getAuthTag()]);
}

function chachaOpen(key: Buffer, nonce: Buffer, aad: Buffer, ct: Buffer): Buffer {
  const d = createDecipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  d.setAAD(aad, { plaintextLength: ct.length - 16 });
  d.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
}

/** Single-shot HPKE seal (RFC 9180 §6.1), sequence number 0. `ikmE` fixes the ephemeral key; only vectors fix it. */
export function hpkeSeal(pkR: Buffer, info: Buffer, aad: Buffer, pt: Buffer, ikmE: Buffer = randomBytes(32)): { enc: Buffer; ct: Buffer; sharedSecret: Buffer } {
  const eph = hpkeDeriveKeyPair(ikmE);
  const enc = eph.publicKey;
  const sharedSecret = kemSharedSecret(x25519(eph.secretKey, pkR), enc, pkR);
  const { key, baseNonce } = hpkeKeySchedule(sharedSecret, info);
  return { enc, ct: chachaSeal(key, baseNonce, aad, pt), sharedSecret };
}

/** Single-shot HPKE open (RFC 9180 §6.1). Throws when the key, the info or a byte is wrong. */
export function hpkeOpen(skR: Buffer, enc: Buffer, info: Buffer, aad: Buffer, ct: Buffer): Buffer {
  const pkR = x25519Public(skR);
  const sharedSecret = kemSharedSecret(x25519(skR, enc), enc, pkR);
  const { key, baseNonce } = hpkeKeySchedule(sharedSecret, info);
  return chachaOpen(key, baseNonce, aad, ct);
}

// ── The device key and its address ──

export interface SealKey {
  secretKey: Buffer;
  publicKey: Buffer;
  kid: string;
}

/** kid = the first 16 hex characters of SHA-256 over the raw 32-byte public key. */
export function kidOf(publicKey: Buffer): string {
  return createHash("sha256").update(publicKey).digest("hex").slice(0, 16);
}

/** The device key from its 32-byte seed (~/.nodata/device-key.json): HKDF-SHA256, empty salt, info "protect.env.x25519.v1". */
export function sealKeyFromSeed(seed: Buffer): SealKey {
  if (seed.length < 16) throw new Error("seed too short (need at least 16 bytes)");
  const secretKey = expand(extract(Buffer.alloc(0), seed), Buffer.from("protect.env.x25519.v1"), 32);
  const publicKey = x25519Public(secretKey);
  return { secretKey, publicKey, kid: kidOf(publicKey) };
}

/** The HPKE info of every v3 seal: the recipient's own kid, so a blob sealed to one key refuses to open as another's. */
export function sealInfo(kid: string): Buffer {
  return Buffer.from(`protect.env.v3|${kid}`, "utf8");
}

// ── The sealed DEK: [ver:1][suite:1][encLen:2BE][ctLen:2BE][enc][ct] ──

export const SEALED_DEK_VERSION = 0x01;
export const SEALED_DEK_SUITE = 0x01;
export const MAX_SEALED_BYTES = 4096;

/** Seal a 32-byte file key (DEK) to one recipient's public key. */
export function sealDek(dek: Buffer, recipientPublicKey: Buffer, ikmE?: Buffer): Buffer {
  if (dek.length !== 32) throw new Error("the DEK is 32 bytes");
  if (recipientPublicKey.length !== 32) throw new Error("an X25519 public key is 32 bytes");
  const { enc, ct } = hpkeSeal(recipientPublicKey, sealInfo(kidOf(recipientPublicKey)), Buffer.alloc(0), dek, ikmE);
  return Buffer.concat([Buffer.from([SEALED_DEK_VERSION, SEALED_DEK_SUITE]), u16(enc.length), u16(ct.length), enc, ct]);
}

/** Split a sealed DEK into its parts, refusing anything that is not exactly the layout. */
export function parseSealedDek(sealed: Buffer): { enc: Buffer; ct: Buffer } {
  if (sealed.length < 6 || sealed.length > MAX_SEALED_BYTES) throw new Error("not a sealed DEK: wrong size");
  if (sealed[0] !== SEALED_DEK_VERSION) throw new Error(`unsupported version 0x${sealed[0].toString(16)}`);
  if (sealed[1] !== SEALED_DEK_SUITE) throw new Error(`unsupported suite 0x${sealed[1].toString(16)}`);
  const encLen = sealed.readUInt16BE(2);
  const ctLen = sealed.readUInt16BE(4);
  if (encLen !== 32) throw new Error("enc must be 32 bytes (an X25519 public key)");
  if (ctLen !== 48) throw new Error("ct must be 48 bytes (a 32-byte DEK and its 16-byte tag)");
  if (sealed.length !== 6 + encLen + ctLen) throw new Error("length does not match the header");
  return { enc: sealed.subarray(6, 6 + encLen), ct: sealed.subarray(6 + encLen) };
}

/** Open a sealed DEK with the recipient's key. Only that key opens it. */
export function openSealedDek(sealed: Buffer, key: SealKey): Buffer {
  const { enc, ct } = parseSealedDek(sealed);
  return hpkeOpen(key.secretKey, enc, sealInfo(key.kid), Buffer.alloc(0), ct);
}

// ── The token: aes256gcm:v3:<iv b64>:<ciphertext‖tag b64>:<seal id> ──

export const TOKEN_PREFIX = "aes256gcm:v3:";

/** Encrypt a value under a DEK. `iv` is 12 random bytes; only vectors fix it. */
export function encryptValue(value: string, dek: Buffer, sealId: string, iv: Buffer = randomBytes(12)): string {
  if (!sealId || sealId.includes(":")) throw new Error("a seal id is non-empty and has no ':'");
  const c = createCipheriv("aes-256-gcm", dek, iv);
  const body = Buffer.concat([c.update(value, "utf8"), c.final(), c.getAuthTag()]);
  return `${TOKEN_PREFIX}${iv.toString("base64")}:${body.toString("base64")}:${sealId}`;
}

export function parseToken(token: string): { iv: Buffer; body: Buffer; sealId: string } {
  const parts = token.split(":");
  if (parts.length !== 5 || parts[0] !== "aes256gcm" || parts[1] !== "v3" || !parts[4]) throw new Error("not a v3 token");
  const iv = Buffer.from(parts[2], "base64");
  const body = Buffer.from(parts[3], "base64");
  if (iv.length !== 12) throw new Error("the iv is 12 bytes");
  if (body.length < 17) throw new Error("the ciphertext is shorter than one byte and its tag");
  return { iv, body, sealId: parts[4] };
}

export function decryptValue(token: string, dek: Buffer): string {
  const { iv, body } = parseToken(token);
  const d = createDecipheriv("aes-256-gcm", dek, iv);
  d.setAuthTag(body.subarray(body.length - 16));
  return Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]).toString("utf8");
}

// ── The sealed file: <file>.ndc ──

export interface NdcManifest {
  v: 3;
  alg: "aes256gcm:v3";
  kid: string;
  orig: string;
  enc: "base64";
  token: string;
  sealed_dek?: string;
  governed?: { seal_id: string; principal: string; org_id: string | null; receipt_id: string; proof_ref: string | null; also_on?: string[] };
  sha256: string;
  sealed_at: string;
  org_copy?: { kid: string; sealed_dek: string };
}

/** Who can open this .ndc, read from its structure alone. No key is needed and none is used. */
export function inspectNdc(m: NdcManifest): { ok: boolean; facts: string[]; problems: string[] } {
  const facts: string[] = [];
  const problems: string[] = [];
  if (m.v !== 3 || m.alg !== "aes256gcm:v3" || m.enc !== "base64") problems.push("not a v3 .ndc (v, alg or enc)");
  if (!/^[0-9a-f]{16}$/.test(m.kid ?? "")) problems.push("kid is not 16 hex characters");
  if (!/^[0-9a-f]{64}$/.test(m.sha256 ?? "")) problems.push("sha256 is not 64 hex characters");
  let token: ReturnType<typeof parseToken> | null = null;
  try {
    token = parseToken(m.token);
  } catch (e) {
    problems.push(`token: ${(e as Error).message}`);
  }
  if (m.sealed_dek && m.governed) problems.push("both sealed_dek and governed: a file is local or governed, not both");
  if (m.sealed_dek) {
    try {
      parseSealedDek(Buffer.from(m.sealed_dek, "base64"));
      facts.push(`local seal: the file key is in the file, HPKE-sealed to device key ${m.kid}. That device key alone opens it; no one is asked and nothing is recorded.`);
    } catch (e) {
      problems.push(`sealed_dek: ${(e as Error).message}`);
    }
  } else if (m.governed) {
    if (token && token.sealId !== m.governed.seal_id) problems.push("the token's seal id differs from governed.seal_id");
    facts.push(`governed seal ${m.governed.seal_id}: the file key is not in the file. NoData holds it sealed to device key ${m.kid} (and to the owner's other computers${m.governed.also_on?.length ? `: ${m.governed.also_on.join(", ")}` : ""}), and hands it back to that device after a signed receipt. NoData cannot open it.`);
  } else {
    problems.push("neither sealed_dek nor governed: nothing opens this file");
  }
  if (m.org_copy) {
    try {
      parseSealedDek(Buffer.from(m.org_copy.sealed_dek, "base64"));
      facts.push(`organisation copy: the same file key, sealed to the organisation's master key ${m.org_copy.kid} (its 12 words). It opens with those words, without the device, the person or NoData.`);
    } catch (e) {
      problems.push(`org_copy: ${(e as Error).message}`);
    }
  } else {
    facts.push("no organisation copy: only the device key (and, if governed, the owner's other computers) opens it.");
  }
  facts.push(`in the clear: the file name (${m.orig}), its SHA-256, the time it was sealed and the key ids. The content is not.`);
  return { ok: problems.length === 0, facts, problems };
}

/** Open a .ndc's content with a key it is sealed to: the device key, or the organisation's master key for org_copy. */
export function openNdc(m: NdcManifest, key: SealKey, sealedDekB64 = m.sealed_dek): Buffer {
  const sealed = key.kid === m.org_copy?.kid ? m.org_copy.sealed_dek : sealedDekB64;
  if (!sealed) throw new Error("the file key is not in this file (governed: NoData releases it to the device)");
  const dek = openSealedDek(Buffer.from(sealed, "base64"), key);
  try {
    const bytes = Buffer.from(decryptValue(m.token, dek), "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== m.sha256) throw new Error("the content does not match the manifest's sha256");
    return bytes;
  } finally {
    dek.fill(0);
  }
}
