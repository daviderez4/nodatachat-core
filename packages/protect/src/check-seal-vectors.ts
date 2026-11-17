// Recompute the seal v3 test vectors from SEAL-FORMAT.md with the reference
// implementation (seal-v3.ts) and say whether they match. Like check-vectors.ts
// for the split key: the spec text, the readable code and Node's crypto, nothing
// else, and no one to talk to.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decryptValue,
  encryptValue,
  hpkeDeriveKeyPair,
  hpkeKeySchedule,
  hpkeOpen,
  hpkeSeal,
  openNdc,
  openSealedDek,
  sealDek,
  sealKeyFromSeed,
  type NdcManifest,
} from "./seal-v3";

export const SEAL_SPEC_PATH = join(__dirname, "..", "SEAL-FORMAT.md");

// Each vector's inputs are hex strings unless named otherwise; `expect` is what
// the code must produce. The shapes follow SEAL-FORMAT.md.
export type SealVector = { name: string; kind: "hpke" | "value" | "file"; expect: Record<string, unknown> } & Record<string, unknown>;

/** The vectors block, read out of the spec text itself. */
export function parseSealVectors(spec: string): SealVector[] {
  const m = /<!-- seal-vectors -->\s*```json\n([\s\S]*?)\n```/.exec(spec);
  if (!m) throw new Error("SEAL-FORMAT.md has no seal-vectors block");
  return JSON.parse(m[1]) as SealVector[];
}

const h = (v: unknown) => Buffer.from(String(v), "hex");
const hex = (b: Buffer) => b.toString("hex");

/** One vector → the fields that did not come out as published (empty = it holds). */
export function checkSealVector(v: SealVector): string[] {
  const bad: string[] = [];
  const same = (field: string, got: string, want: unknown) => {
    if (got !== want) bad.push(field);
  };
  try {
    if (v.kind === "hpke") {
      const r = hpkeDeriveKeyPair(h(v.ikmR));
      const s = hpkeSeal(r.publicKey, h(v.info), h(v.aad), h(v.pt), h(v.ikmE));
      const ks = hpkeKeySchedule(s.sharedSecret, h(v.info));
      same("pkR", hex(r.publicKey), v.expect.pkR);
      same("enc", hex(s.enc), v.expect.enc);
      same("shared_secret", hex(s.sharedSecret), v.expect.shared_secret);
      same("key", hex(ks.key), v.expect.key);
      same("base_nonce", hex(ks.baseNonce), v.expect.base_nonce);
      same("ct", hex(s.ct), v.expect.ct);
      same("open", hex(hpkeOpen(r.secretKey, s.enc, h(v.info), h(v.aad), s.ct)), v.pt);
    } else if (v.kind === "value") {
      const key = sealKeyFromSeed(h(v.seed));
      same("public_key", hex(key.publicKey), v.expect.public_key);
      same("kid", key.kid, v.expect.kid);
      same("sealed_dek", hex(sealDek(h(v.dek), key.publicKey, h(v.ikmE))), v.expect.sealed_dek);
      same("token", encryptValue(String(v.value), h(v.dek), String(v.seal_id), h(v.iv)), v.expect.token);
      // And back: the published blob opens with the seed's key, and the token with that DEK.
      const dek = openSealedDek(h(v.expect.sealed_dek), key);
      same("open dek", hex(dek), v.dek);
      same("open token", decryptValue(String(v.expect.token), dek), v.value);
    } else if (v.kind === "file") {
      const key = sealKeyFromSeed(h(v.seed));
      const org = sealKeyFromSeed(h(v.org_seed));
      const file = h(v.file_hex);
      const want = v.expect.ndc as NdcManifest;
      const got: NdcManifest = {
        v: 3, alg: "aes256gcm:v3", kid: key.kid, orig: String(v.orig), enc: "base64",
        token: encryptValue(file.toString("base64"), h(v.dek), String(v.seal_id), h(v.iv)),
        sealed_dek: sealDek(h(v.dek), key.publicKey, h(v.ikmE)).toString("base64"),
        sha256: createHash("sha256").update(file).digest("hex"),
        sealed_at: String(v.sealed_at),
        org_copy: { kid: org.kid, sealed_dek: sealDek(h(v.dek), org.publicKey, h(v.org_ikmE)).toString("base64") },
      };
      same("public_key", hex(key.publicKey), v.expect.public_key);
      same("org_public_key", hex(org.publicKey), v.expect.org_public_key);
      same("ndc", JSON.stringify(got), JSON.stringify(want));
      same("open as device", hex(openNdc(want, key)), v.file_hex);
      same("open as organisation", hex(openNdc(want, org)), v.file_hex);
    } else {
      bad.push(`unknown kind ${String(v.kind)}`);
    }
  } catch (e) {
    bad.push(`threw: ${(e as Error).message}`);
  }
  return bad;
}

export function checkSealVectors(spec = readFileSync(SEAL_SPEC_PATH, "utf8")): Array<{ name: string; ok: boolean; bad: string[] }> {
  return parseSealVectors(spec).map((v) => {
    const bad = checkSealVector(v);
    return { name: v.name, ok: bad.length === 0, bad };
  });
}
