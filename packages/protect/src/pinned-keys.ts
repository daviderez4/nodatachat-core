// Whose keys signed this pack? (trust debt G6)
//
// Every signature in an evidence pack verifies against a public key the pack
// itself carries, so the seven integrity checks prove the maths, not the
// signer: anyone can mint a key and sign a flawless pack. NODATA-KEYS.json pins
// NoData's public keys in this package. A version on npm cannot be changed
// after it is published, so NoData cannot swap a key quietly: a new key only
// counts once a new version lists it, in public, next to the old ones.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, EvidencePack } from "./verify-pack";

export interface ChainKey {
  kid: string;
  ed25519_pubkey_hex: string;
  ml_dsa65_pubkey_hex?: string | null;
  created_at?: string | null;
  retired_at?: string | null;
  /** When this key began signing receipts in their signing contexts (server
   *  mig 612). A context-free receipt it signed after this (plus grace) fails. */
  receipt_context_since?: string | null;
}

/** The per-key context eras a keys file pins, keyed by Ed25519 pubkey hex. */
export function contextEras(keys: PinnedKeys): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys.chain_keys) if (k.receipt_context_since) out[k.ed25519_pubkey_hex.toLowerCase()] = k.receipt_context_since;
  return out;
}

export interface EnvelopeSigner {
  kid: string;
  ed25519_pubkey_hex: string;
  status?: string | null;
  created_at?: string | null;
}

export interface PinnedKeys {
  version: number;
  note?: string;
  /** Sign every receipt (Ed25519, and ML-DSA-65 since dual signing) and every epoch seal root. */
  chain_keys: ChainKey[];
  /** Sign the evidence-pack envelope only. */
  pack_envelope_signers: EnvelopeSigner[];
}

export const NODATA_KEYS_PATH = join(__dirname, "..", "NODATA-KEYS.json");

export function loadPinnedKeys(path = NODATA_KEYS_PATH): PinnedKeys {
  const k = JSON.parse(readFileSync(path, "utf8")) as PinnedKeys;
  if (!Array.isArray(k.chain_keys) || !Array.isArray(k.pack_envelope_signers)) throw new Error(`${path}: not a keys file`);
  return k;
}

const lc = (h: string | null | undefined) => (h ?? "").toLowerCase();

/**
 * One check: every key that signs something in the pack is a pinned key for
 * that role. A chain key signing an envelope, or an envelope key signing a
 * receipt, does not count. No pinned keys at all is not a pass.
 */
export function checkOrigin(pack: EvidencePack, keys: PinnedKeys, label = "NoData's published keys (NODATA-KEYS.json)"): CheckResult {
  const name = `Signed by ${label}`;
  const inner = pack?.nodata_evidence_pack;
  if (!inner) return { name, passed: false, detail: "Missing nodata_evidence_pack key" };
  const chainEd = new Map(keys.chain_keys.map((k) => [lc(k.ed25519_pubkey_hex), k.kid]));
  const chainPq = new Map(keys.chain_keys.filter((k) => k.ml_dsa65_pubkey_hex).map((k) => [lc(k.ml_dsa65_pubkey_hex), k.kid]));
  const envelope = new Map(keys.pack_envelope_signers.map((k) => [lc(k.ed25519_pubkey_hex), k.kid]));
  if (chainEd.size === 0 && envelope.size === 0) {
    return { name, passed: false, detail: "This keys file pins no keys, so the signer cannot be checked." };
  }

  const used: Array<{ role: string; key: string; pinned: Map<string, string> }> = [];
  if (inner.nodata_signature && inner.signing_pubkey_hex) used.push({ role: "envelope", key: lc(inner.signing_pubkey_hex), pinned: envelope });
  for (const r of inner.receipts ?? []) {
    if (r.signature_hex && r.signing_pubkey_hex) used.push({ role: "receipt Ed25519", key: lc(r.signing_pubkey_hex), pinned: chainEd });
    if (r.pq_signature_hex && r.pq_pubkey_hex) used.push({ role: "receipt ML-DSA-65", key: lc(r.pq_pubkey_hex), pinned: chainPq });
  }
  for (const s of inner.epoch_seals ?? []) {
    if (s.signed_root_hex && s.signing_pubkey_hex) used.push({ role: "seal root", key: lc(s.signing_pubkey_hex), pinned: chainEd });
  }
  if (used.length === 0) return { name, passed: false, detail: "Nothing in this pack is signed, so there is no signer to check." };

  const seen = new Map<string, { role: string; kid: string | undefined }>();
  for (const u of used) seen.set(`${u.role}|${u.key}`, { role: u.role, kid: u.pinned.get(u.key) });
  const unknown = [...seen.entries()].filter(([, v]) => !v.kid).map(([k, v]) => `${v.role} ${k.split("|")[1].slice(0, 16)}…`);
  const kids = [...new Set([...seen.values()].map((v) => v.kid).filter(Boolean))] as string[];
  return {
    name,
    passed: unknown.length === 0,
    detail:
      unknown.length === 0
        ? `Every signing key in this pack is pinned for its role: ${kids.join(", ")}.`
        : `${unknown.length} signing key(s) in this pack are not ${label}. The signatures may still be valid maths, but they were not made with a key listed here.`,
    evidence: unknown.length ? { not_pinned: unknown.slice(0, 5).join(" · ") } : { pinned_kids: kids.join(", ") },
  };
}
