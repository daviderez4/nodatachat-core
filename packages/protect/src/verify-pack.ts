// Verify a NoData evidence pack offline: the file you hand an auditor.
//
// The checks are the ones /verify-pack runs in the browser, moved here so the
// verifier no longer comes from NoData's own website (trust debt G4): signed
// export envelope, per-receipt payload hash, per-receipt Ed25519 and ML-DSA-65
// signatures, chain links, no plaintext in payloads, and the epoch seals that
// tie the receipts to an external clock. No network, no NoData server, no
// secret: only the pack, its public keys and maths. The format is written out
// in EVIDENCE-PACK-FORMAT.md.
//
//   npx @nodatachat/protect@3 verify-pack pack.json

import { createHash, webcrypto } from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

export interface Receipt {
  id: string;
  chain_index: number;
  event_type: string;
  payload: unknown;
  event_hash: string;
  prev_receipt_id: string | null;
  chain_hmac?: string;
  created_at: string;
  /** Ed25519 over `event_hash|prev_receipt_id|created_at`. Null on a receipt
   *  written before its chain was signed: unverifiable, not invalid. */
  signature_hex?: string | null;
  signing_pubkey_hex?: string | null;
  signing_kid?: string | null;
  /** ML-DSA-65 (FIPS 204) over the SAME bytes as signature_hex. Null on a
   *  receipt written before dual signing: skipped, not failed. */
  pq_signature_hex?: string | null;
  pq_pubkey_hex?: string | null;
  sig_suite?: string | null;
  /** SHA-256 of the receipt's scope; inside a decision-context signature. */
  scope_ref?: string | null;
  /** The Merkle path from this receipt's event_hash to the root of the epoch
   *  seal that covers it (optional, since 2026-10-19). With it, "this receipt is
   *  under that witnessed root" is checkable offline. Absent on a receipt not
   *  yet sealed, and on packs exported before inclusion was carried. */
  inclusion?: ReceiptInclusion | null;
}

/** One step up the tree: the sibling hash and which side it sits on. */
export interface InclusionStep {
  sibling: string;
  sibling_is_right: boolean;
}

export interface ReceiptInclusion {
  epoch_seal_id: string;
  /** 1 = the frozen Bitcoin-style tree; 2 = RFC 6962 (0x00 leaf / 0x01 node
   *  prefixes, odd node promoted). Replayed exactly as the seal was built. */
  merkle_version: 1 | 2;
  /** Null when the server could not prove inclusion; the check then fails. */
  path: InclusionStep[] | null;
  /** Why the server could not prove it (leaf_not_in_epoch, root_mismatch, ...). */
  server_check?: string | null;
}

/** An epoch seal: the Merkle root commits to a whole epoch of receipts,
 *  signed_root_hex attributes that root to NoData, and ots_anchored_at /
 *  published_url are the parts NoData does not control. */
export interface EpochSeal {
  id: string;
  epoch_number?: number | null;
  chain?: string | null;
  merkle_root?: string | null;
  merkle_version?: number | null;
  signed_root_hex?: string | null;
  signing_pubkey_hex?: string | null;
  pq_signed_root_hex?: string | null;
  pq_pubkey_hex?: string | null;
  sig_suite?: string | null;
  epoch_start_at?: string | null;
  epoch_end_at?: string | null;
  sealed_at?: string | null;
  ots_status?: string | null;
  ots_anchored_at?: string | null;
  published_to_witness_at?: string | null;
  published_url?: string | null;
}

export interface EvidencePack {
  nodata_evidence_pack: {
    version: number;
    generated_at: string;
    receipts: Receipt[] | null;
    epoch_seals?: EpochSeal[] | null;
    /** Non-null means the seal lookup FAILED server-side. Unknown anchor
     *  status is not the same as no anchor. */
    epoch_seals_error?: string | null;
    epoch_seals_truncated?: boolean | null;
    /** "decision" when the pack carries one whole per-scope decision chain.
     *  Inside the signed envelope. */
    receipt_chain?: string | null;
    nodata_signature: string | null;
    signing_pubkey_hex: string | null;
    signing_kid: string | null;
    signed_at: string | null;
    [key: string]: unknown;
  };
}

/** From this moment every NoData decision receipt is meant to carry a signature
 *  (hybrid signing went universal; the server's sign-backfill uses the same
 *  boundary). An unsigned receipt before it is history; after it, a gap. */
export const SIGNING_UNIVERSAL_SINCE = "2026-08-10T00:00:00Z";

/** A context-free signature dated (inside its signed bytes) after the signing
 *  key's recorded context era plus this grace is refused. Same as the server's
 *  RECEIPT_CONTEXT_GRACE_MS (parity-tested). */
export const RECEIPT_CONTEXT_GRACE_MS = 15 * 60 * 1000;
/** Backstop when no era is pinned for the key: a context-free receipt dated
 *  after this fails regardless (fail closed). Same as the server's. */
export const RECEIPT_CONTEXT_BACKSTOP = "2026-12-01T00:00:00Z";

// Each receipt chain signs in exactly one context. A pack that declares its
// chain (receipt_chain, under the envelope signature) accepts that context only;
// a pack that declares none (exported before contexts existed) may carry only
// context-free receipts, so any context in it fails.
const CHAIN_CONTEXT: Record<string, string> = {
  decision: "nd-decision-receipt.v1",
  operator: "nd-operator-receipt.v1",
  protect: "nd-protect-receipt.v1",
};

/**
 * The signing-context rule, shared by the Ed25519 and ML-DSA-65 checks (both
 * sign the same bytes). Fails a receipt that:
 *   · names a context that is not its pack's chain (or any context in a pack
 *     that declares no chain);
 *   · is a decision-context receipt with no scope_ref, or (in a decision pack)
 *     a scope_ref different from the other receipts': it was moved from
 *     another chain;
 *   · is context-free and dated after its signing key's context era
 *     (`contextSince`, from the PINNED keys: NODATA-KEYS.json
 *     receipt_context_since) plus the grace.
 * By signed time, never by chain order: a refusal signed late carries its
 * context and its old time, and does not make its neighbours "downgrades".
 */
function contextRule(
  receipts: Receipt[],
  chain: string | null | undefined,
  contextSince: Record<string, string> = {},
): (x: Receipt) => string | null {
  const expected = chain ? CHAIN_CONTEXT[chain] ?? null : null;
  const decisionRefs = new Set(receipts.filter((x) => receiptContext(x.sig_suite) === CHAIN_CONTEXT.decision).map((x) => x.scope_ref ?? ""));
  return (x) => {
    const c = receiptContext(x.sig_suite);
    if (c && chain && !expected) return `unknown receipt chain ${chain}`;
    if (c && c !== expected) return expected ? `signing context ${c} is not this chain's (${expected})` : `context ${c} in a pack that declares no receipt chain`;
    if (c === CHAIN_CONTEXT.decision) {
      if (!x.scope_ref) return "decision receipt without its scope_ref";
      if (chain === "decision" && decisionRefs.size > 1) return "receipts from more than one scope in a single decision chain";
    }
    if (!c && x.signing_pubkey_hex) {
      const since = contextSince[x.signing_pubkey_hex.toLowerCase()];
      const era = since ? Date.parse(since) + RECEIPT_CONTEXT_GRACE_MS : Number.POSITIVE_INFINITY;
      const limit = Math.min(Date.parse(RECEIPT_CONTEXT_BACKSTOP), Number.isFinite(era) ? era : Date.parse(RECEIPT_CONTEXT_BACKSTOP));
      {
        const t = Date.parse(canonicalChainTime(x.created_at));
        if (!Number.isFinite(t) || t >= limit) return "no signing context on a receipt dated after its key began signing in contexts";
      }
    }
    return null;
  };
}

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  evidence?: Record<string, string>;
}

/** Canonical JSON: object keys sorted at every depth, no whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k])).join(",") + "}";
}

/**
 * The spelling of created_at that was signed. The signer writes `…978Z`; the
 * database hands the same instant back as `…978+00:00`, trims trailing zeros
 * (`…06.48+00:00`) or carries microseconds. Same instant, different bytes,
 * different signature. Never parsed to a Date (that would truncate
 * microseconds); the fraction is padded to at least three digits; a real
 * non-zero offset is left as it is rather than coerced into a wrong answer.
 */
export function canonicalChainTime(value: string): string {
  const s = String(value).trim();
  if (!s) return s;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:?\d{2}|[+-]\d{2})?$/i.exec(s);
  if (!m) return s;
  const [, date, time, zone] = m;
  if (zone && !/^(?:Z|[+-]00:?(?:00)?)$/i.test(zone)) return s;
  const dot = time.indexOf(".");
  const padded =
    dot === -1 ? `${time}.000` : time.length - dot - 1 >= 3 ? time : `${time.slice(0, dot)}.${time.slice(dot + 1).padEnd(3, "0")}`;
  return `${date}T${padded}Z`;
}

/** The bytes both receipt signatures cover. */
/** The decision-receipt signing context NoData's server uses (chain-keys.ts). */
export const DECISION_RECEIPT_CONTEXT = "nd-decision-receipt.v1";
/** Every receipt context NoData issues (same list as the server, parity-tested). */
export const RECEIPT_CONTEXTS: string[] = [DECISION_RECEIPT_CONTEXT, "nd-operator-receipt.v1", "nd-protect-receipt.v1"];

/** The signing context a receipt's sig_suite names (";ctx=<label>"), or null. */
export function receiptContext(suite: string | null | undefined): string | null {
  const m = /;ctx=([A-Za-z0-9._-]+)/.exec(suite ?? "");
  return m ? m[1] : null;
}

/** The bytes a receipt's Ed25519 and ML-DSA-65 signatures cover: the chain input,
 *  prefixed with `<context>|` when sig_suite names a context. */
export function receiptSignedInput(r: Pick<Receipt, "event_hash" | "prev_receipt_id" | "created_at"> & { sig_suite?: string | null; scope_ref?: string | null }): string {
  const base = `${r.event_hash}|${r.prev_receipt_id ?? ""}|${canonicalChainTime(r.created_at)}`;
  const ctx = receiptContext(r.sig_suite);
  // The decision context also binds the receipt's scope (SHA-256 of it).
  if (ctx === DECISION_RECEIPT_CONTEXT) return `${ctx}|${r.scope_ref ?? ""}|${base}`;
  return ctx ? `${ctx}|${base}` : base;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new Error("not hex");
  return new Uint8Array(Buffer.from(clean, "hex"));
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function ed25519Verify(pubkeyHex: string, signatureHex: string, data: Uint8Array): Promise<boolean> {
  const raw = hexToBytes(pubkeyHex);
  if (raw.length !== 32) throw new Error(`Ed25519 pubkey must be 32 bytes (got ${raw.length})`);
  const key = await webcrypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
  return webcrypto.subtle.verify({ name: "Ed25519" }, key, hexToBytes(signatureHex), data);
}

const utf8 = (s: string) => new TextEncoder().encode(s);

const sha256 = (...parts: Uint8Array[]): Uint8Array => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return new Uint8Array(h.digest());
};

/**
 * Climb from a leaf (an event_hash, hex) to a root along an inclusion path.
 * v1: plain SHA-256(left || right), the leaf used as is. v2 (RFC 6962): the
 * leaf is SHA-256(0x00 || leaf) and each node SHA-256(0x01 || left || right),
 * which is what stops an internal node being passed off as a member.
 */
export function rootFromInclusionPath(leafHex: string, path: InclusionStep[], version: 1 | 2): string {
  let current = version === 2 ? sha256(new Uint8Array([0x00]), hexToBytes(leafHex)) : hexToBytes(leafHex);
  for (const step of path) {
    const sib = hexToBytes(step.sibling);
    const [l, r] = step.sibling_is_right ? [current, sib] : [sib, current];
    current = version === 2 ? sha256(new Uint8Array([0x01]), l, r) : sha256(l, r);
  }
  return Buffer.from(current).toString("hex");
}

/** Every check, in order. A check passes only on evidence: none of them turns
 *  green on an empty pack. */
export interface VerifyOptions {
  /** Per signing key (Ed25519 pubkey hex, lowercase): when it began signing in
   *  receipt contexts. From the PINNED keys file, never from the pack. */
  contextSince?: Record<string, string>;
}

export async function verifyPack(pack: EvidencePack, opts: VerifyOptions = {}): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const inner = pack?.nodata_evidence_pack;
  if (!inner) return [{ name: "Top-level shape", passed: false, detail: "Missing nodata_evidence_pack key" }];

  // The signed body is everything except the signature and its own fields.
  const { nodata_signature, signing_pubkey_hex, signing_kid, signed_at, ...evidenceBody } = inner;
  void signing_kid;
  void signed_at;

  // 1. The export envelope. Narrower than "the pack is authentic": it proves
  //    nobody edited the file after it was generated. Whether each receipt
  //    inside is genuine is check 3's job.
  if (!nodata_signature || !signing_pubkey_hex) {
    checks.push({ name: "Ed25519 signature on evidence body", passed: false, detail: "No signature attached." });
  } else {
    try {
      const canonical = canonicalize(evidenceBody);
      const ok = await ed25519Verify(signing_pubkey_hex, nodata_signature, utf8(canonical));
      checks.push({
        name: "Ed25519 signature on evidence body",
        passed: ok,
        detail: ok
          ? "Signature verifies: this export has not been edited since it was generated. (Whether each receipt inside is genuine is checked separately.)"
          : "Signature does NOT verify: the pack was altered, or the key is wrong.",
        evidence: { algorithm: "Ed25519 (RFC 8032)", canonical_sha256: sha256Hex(canonical), signing_pubkey_hex },
      });
    } catch (err) {
      checks.push({ name: "Ed25519 signature on evidence body", passed: false, detail: `Verification threw: ${(err as Error).message}` });
    }
  }

  // 2. Every receipt's event_hash = SHA-256(canonical(payload)).
  const receipts = inner.receipts ?? [];
  // One context rule for both signature checks (they cover the same bytes).
  const contextProblem = contextRule(receipts, inner.receipt_chain, opts.contextSince);
  let hashMismatches = 0;
  const firstMismatch: string[] = [];
  for (const r of receipts) {
    const recomputed = sha256Hex(canonicalize(r.payload));
    if (recomputed !== r.event_hash) {
      hashMismatches++;
      if (firstMismatch.length < 3) firstMismatch.push(`${r.id}: have ${String(r.event_hash).slice(0, 16)}…, computed ${recomputed.slice(0, 16)}…`);
    }
  }
  checks.push({
    name: `Per-receipt event_hash recomputation (${receipts.length} receipts)`,
    passed: hashMismatches === 0 && receipts.length > 0,
    detail:
      receipts.length === 0
        ? "No receipts in pack."
        : hashMismatches === 0
          ? `All ${receipts.length} payload hashes match.`
          : `${hashMismatches} of ${receipts.length} receipts had altered payloads.`,
    evidence: hashMismatches > 0 ? { mismatches: firstMismatch.join(" · ") } : undefined,
  });

  // 3. Per-receipt Ed25519: THE check. It says a specific receipt was issued by
  //    NoData, at that position in the chain, at that time, checkable by someone
  //    who trusts nobody. A receipt with no signature is UNSIGNED: never counted
  //    as verified. Written before signing was universal it is reported, not
  //    failed (history cannot be signed after the fact); written after, it fails,
  //    because from then on every receipt was meant to carry one.
  {
    let sigOk = 0;
    let sigBad = 0;
    let unsigned = 0;
    let unsignedInSignedEra = 0;
    const unsignedDetail: string[] = [];
    const badDetail: string[] = [];
    const keysSeen = new Set<string>();
    // An unsigned receipt's created_at is covered by nothing, so it cannot vouch
    // for itself. It counts as the signed era when its time does not parse, is on
    // or after the boundary, or a SIGNED receipt from the signed era comes BEFORE
    // it in the chain (walked through prev_receipt_id): a predecessor's time is
    // under its signature and history only moves forward.
    // Deliberately NOT the reverse: real chains carry unsigned history followed by
    // signed activity, and a pack holds the whole scope, so "a signed successor
    // exists" cannot tell genuine pre-signing history from a backdated forgery.
    // An unsigned receipt could cut that walk by claiming no predecessor, or one
    // outside the pack; see entryPoints below.
    const byId = new Map(receipts.map((x) => [x.id, x]));
    const boundary = Date.parse(SIGNING_UNIVERSAL_SINCE);
    const signedInEra = (x: (typeof receipts)[number]) => !!x.signature_hex && Date.parse(x.created_at) >= boundary;
    // Entry points: receipts whose predecessor is absent (null) or not in the
    // pack. A pack that carries ONE WHOLE per-scope chain (receipt_chain
    // 'decision', declared under the envelope signature) has exactly one: where
    // it starts. Decided from prev_receipt_id links only, never from the
    // unsigned chain_index. Not applied to other packs: the operator chain is
    // global and a tenant pack is a filtered slice of it, so most of its
    // receipts legitimately point outside the pack.
    const wholeChain = inner.receipt_chain === "decision";
    const entryPoints = receipts.filter((x) => !x.prev_receipt_id || !byId.has(x.prev_receipt_id)).length;
    const inSignedEra = (r: (typeof receipts)[number]): boolean => {
      const t = Date.parse(r.created_at);
      if (!Number.isFinite(t) || t >= boundary) return true;
      // An unsigned receipt that is one of several entry points cut itself off
      // (dropped or invented its predecessor): it counts as the signed era.
      if (wholeChain && (!r.prev_receipt_id || !byId.has(r.prev_receipt_id)) && entryPoints > 1) return true;
      const seen = new Set<string>([r.id]);
      let p = r.prev_receipt_id ? byId.get(r.prev_receipt_id) : undefined;
      while (p && !seen.has(p.id)) {
        seen.add(p.id);
        if (signedInEra(p)) return true;
        p = p.prev_receipt_id ? byId.get(p.prev_receipt_id) : undefined;
      }
      return false;
    };
    for (const r of receipts) {
      if (!r.signature_hex || !r.signing_pubkey_hex) {
        unsigned++;
        if (inSignedEra(r)) {
          unsignedInSignedEra++;
          if (unsignedDetail.length < 3) unsignedDetail.push(`${r.id} @ index ${r.chain_index}`);
        }
        continue;
      }
      keysSeen.add(r.signing_pubkey_hex);
      try {
        const problem = contextProblem(r);
        if (problem) {
          sigBad++;
          if (badDetail.length < 3) badDetail.push(`${r.id}: ${problem}`);
        } else if (await ed25519Verify(r.signing_pubkey_hex, r.signature_hex, utf8(receiptSignedInput(r)))) sigOk++;
        else {
          sigBad++;
          if (badDetail.length < 3) badDetail.push(`${r.id} @ index ${r.chain_index}`);
        }
      } catch (err) {
        sigBad++;
        if (badDetail.length < 3) badDetail.push(`${r.id}: ${(err as Error).message}`);
      }
    }
    const signable = sigOk + sigBad;
    checks.push({
      name: `Per-receipt Ed25519 signature (${signable} signed, ${unsigned} unsigned)`,
      // No signed receipt at all is not a pass: such a pack proves nothing without us.
      passed: sigBad === 0 && signable > 0 && unsignedInSignedEra === 0,
      detail:
        signable === 0
          ? unsigned > 0
            ? `All ${unsigned} receipts are unsigned. This pack cannot be verified without NoData. It is not evidence of tampering; it is an absence of independent proof.`
            : "No receipts in pack."
          : sigBad > 0
            ? `${sigBad} of ${signable} signatures do NOT verify. Those receipts were altered after issue, or signed by a different key.`
            : unsignedInSignedEra > 0
              ? `${unsignedInSignedEra} receipt(s) written after ${SIGNING_UNIVERSAL_SINCE.slice(0, 10)}, when every receipt was meant to be signed, carry no signature. They are UNSIGNED, not verified.`
              : `All ${sigOk} signatures verify against the public key carried on each receipt.${unsigned ? ` ${unsigned} receipt(s) from before ${SIGNING_UNIVERSAL_SINCE.slice(0, 10)} are unsigned: reported, not counted as verified.` : ""}`,
      evidence: {
        signed_bytes: "event_hash | prev_receipt_id | created_at  (UTF-8)",
        distinct_signing_keys: String(keysSeen.size),
        unsigned: String(unsigned),
        ...(unsignedInSignedEra ? { unsigned_after_signing_universal: unsignedDetail.join(" · ") } : {}),
        ...(badDetail.length ? { failures: badDetail.join(" · ") } : {}),
      },
    });
  }

  // 4. Per-receipt ML-DSA-65, the quantum-resistant half, over the same bytes.
  //    Absent is skipped; present-and-wrong fails; a receipt that claims a
  //    hybrid sig_suite but carries no PQ signature is reported as the claim
  //    the bytes do not support.
  {
    const pqReceipts = receipts.filter((r) => r.pq_signature_hex && r.pq_pubkey_hex);
    const claimsHybrid = receipts.filter((r) => (r.sig_suite ?? "").toUpperCase().includes("ML-DSA") && !r.pq_signature_hex).length;
    if (pqReceipts.length > 0 || claimsHybrid > 0) {
      let pqOk = 0;
      let pqBad = 0;
      const pqDetail: string[] = [];
      for (const r of pqReceipts) {
        try {
          const problem = contextProblem(r);
          if (problem) throw new Error(problem);
          const ok = ml_dsa65.verify(hexToBytes(r.pq_signature_hex as string), utf8(receiptSignedInput(r)), hexToBytes(r.pq_pubkey_hex as string));
          if (ok) pqOk++;
          else {
            pqBad++;
            if (pqDetail.length < 3) pqDetail.push(`${r.id} @ index ${r.chain_index}`);
          }
        } catch (err) {
          pqBad++;
          if (pqDetail.length < 3) pqDetail.push(`${r.id}: ${(err as Error).message}`);
        }
      }
      checks.push({
        name: `ML-DSA-65 signature, quantum-resistant half (${pqReceipts.length} of ${receipts.length} receipts)`,
        passed: pqBad === 0 && claimsHybrid === 0,
        detail:
          pqBad === 0 && claimsHybrid === 0
            ? `All ${pqOk} ML-DSA-65 signatures verify.`
            : claimsHybrid > 0 && pqBad === 0
              ? `${claimsHybrid} receipt(s) declare a hybrid sig_suite but carry no pq_signature_hex. The label claims more than the bytes deliver.`
              : `${pqBad} of ${pqReceipts.length} ML-DSA-65 signatures do NOT verify.`,
        evidence: {
          signed_bytes: "event_hash | prev_receipt_id | created_at  (UTF-8), identical to the Ed25519 input",
          algorithm: "ML-DSA-65 (FIPS 204), @noble/post-quantum",
          receipts_without_pq: String(receipts.length - pqReceipts.length),
          ...(claimsHybrid ? { suite_claimed_without_signature: String(claimsHybrid) } : {}),
          ...(pqDetail.length ? { failures: pqDetail.join(" · ") } : {}),
        },
      });
    }
  }

  // 5. Chain coherence: where the pack holds the receipt at index-1, this
  //    receipt's prev_receipt_id must name it. Gaps are expected when the
  //    export window does not cover the whole chain, and are reported.
  if (receipts.length > 0) {
    const sorted = [...receipts].sort((a, b) => a.chain_index - b.chain_index);
    const byIndex = new Map(sorted.map((r) => [r.chain_index, r]));
    let linkBreaks = 0;
    let indexGaps = 0;
    for (let i = 1; i < sorted.length; i++) {
      const r = sorted[i];
      if (r.chain_index !== sorted[i - 1].chain_index + 1) indexGaps++;
      const prev = byIndex.get(r.chain_index - 1);
      if (prev && r.prev_receipt_id && r.prev_receipt_id !== prev.id) linkBreaks++;
    }
    // A fork: two receipts that claim the same predecessor. prev_receipt_id is
    // inside each receipt's signed bytes, so two SIGNED receipts naming one
    // predecessor are two histories issued for one chain, which gaps never are.
    // chain_index and the receipt id are NOT signed: a duplicate index is
    // reported as an inconsistency too, but it can only add a false alarm, never
    // hide a fork, because the decisive link is the signed one.
    const countDup = (vals: Array<string | number>) => vals.length - new Set(vals).size;
    // Only the signed link decides: two SIGNED receipts naming one predecessor.
    // A repeated chain_index alone is reported, never failed: some chains wrote
    // every receipt at index 1 with no predecessor (signet, mig 185), and an
    // unsigned field cannot prove a fork anyway.
    const forks = countDup(receipts.filter((x) => x.signature_hex).map((x) => x.prev_receipt_id).filter((v): v is string => !!v));
    const repeatedIndexes = countDup(receipts.map((x) => x.chain_index));
    checks.push({
      name: "Chain coherence",
      passed: linkBreaks === 0 && forks === 0,
      detail:
        forks > 0
          ? `${forks} fork(s): two signed receipts name the same predecessor. Two histories were issued for one chain.`
          : linkBreaks === 0
            ? `${sorted.length} receipts, ${indexGaps} gap(s) in chain_index (expected when the export window doesn't cover the full chain).`
            : `${linkBreaks} prev_receipt_id link(s) don't match the receipt at index-1.`,
      evidence: { first_index: String(sorted[0].chain_index), last_index: String(sorted[sorted.length - 1].chain_index), gaps: String(indexGaps), forks: String(forks), repeated_chain_index: String(repeatedIndexes) },
    });
  }

  // 6. Zero-Read: every lockbox_issued receipt carries a key envelope to a
  //    customer key, and no payload holds plaintext (email, IP, PEM key).
  //    A pack with no issued lockboxes gets only the plaintext scan: a check
  //    that passes on zero evidence would be a green tick nothing backs.
  {
    const issueReceipts = receipts.filter((r) => r.event_type === "lockbox_issued");
    let withEnvelope = 0;
    let missingEnvelope = 0;
    const customerKids = new Set<string>();
    for (const r of issueReceipts) {
      const env = (r.payload as { wrapped_key_envelope?: { customer_pubkey_kid?: string } } | null)?.wrapped_key_envelope;
      if (env && typeof env.customer_pubkey_kid === "string" && env.customer_pubkey_kid.length > 0) {
        withEnvelope++;
        customerKids.add(env.customer_pubkey_kid);
      } else missingEnvelope++;
    }
    const PLAINTEXT_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|BEGIN [A-Z ]*KEY/i;
    const plaintextHits = receipts.filter((r) => PLAINTEXT_RE.test(JSON.stringify(r.payload))).length;
    if (issueReceipts.length === 0) {
      checks.push({
        name: "No plaintext in receipt payloads",
        passed: plaintextHits === 0,
        detail:
          plaintextHits > 0
            ? `${plaintextHits} payload(s) contain plaintext (email, IP or PEM-shaped material) that should be hashed.`
            : `No email, IP or PEM-shaped material in ${receipts.length} payload(s). No lockbox_issued receipts, so the Zero-Read attestation does not apply.`,
        evidence: { plaintext_pattern_hits: String(plaintextHits), lockbox_issued_receipts: "0" },
      });
    } else {
      checks.push({
        name: "Zero-Read attestation (NoData cannot decrypt content)",
        passed: missingEnvelope === 0 && plaintextHits === 0,
        detail:
          missingEnvelope > 0
            ? `${missingEnvelope} lockbox_issued receipt(s) lack a wrapped_key_envelope. NoData could potentially access content for those.`
            : plaintextHits > 0
              ? `${plaintextHits} payload(s) contain plaintext (email, IP or PEM-shaped material) that should be hashed.`
              : `${withEnvelope} lockbox_issued receipt(s) carry wrapped_key_envelope to ${customerKids.size} customer key(s). No plaintext content fields detected.`,
        evidence: {
          issued_receipts_with_wrapped_key: String(withEnvelope),
          issued_receipts_missing_wrapped_key: String(missingEnvelope),
          plaintext_pattern_hits: String(plaintextHits),
        },
      });
    }
  }

  // 7. The external clock. Everything above proves NoData issued the receipts
  //    and did not alter them, not WHEN. An epoch seal's root is signed (over
  //    the RAW 32 bytes of merkle_root, not the hex string) and anchored in
  //    Bitcoin via OpenTimestamps: a clock NoData does not run. Signed but not
  //    anchored still leaves the time on our word, and is not counted green.
  const seals = inner.epoch_seals ?? [];
  const sealError = inner.epoch_seals_error ?? null;
  if (seals.length > 0 || sealError) {
    let rootOk = 0;
    let rootBad = 0;
    let rootUnsigned = 0;
    const rootDetail: string[] = [];
    for (const seal of seals) {
      if (!seal.signed_root_hex || !seal.signing_pubkey_hex || !seal.merkle_root) {
        rootUnsigned++;
        continue;
      }
      try {
        if (await ed25519Verify(seal.signing_pubkey_hex, seal.signed_root_hex, hexToBytes(seal.merkle_root))) rootOk++;
        else {
          rootBad++;
          if (rootDetail.length < 3) rootDetail.push(`epoch ${seal.epoch_number ?? seal.id}`);
        }
      } catch (err) {
        rootBad++;
        if (rootDetail.length < 3) rootDetail.push(`epoch ${seal.epoch_number ?? seal.id}: ${(err as Error).message}`);
      }
    }
    const anchored = seals.filter((sl) => sl.ots_anchored_at).length;
    checks.push({
      name: `External clock, epoch seals (${seals.length} covering these receipts)`,
      passed: !sealError && rootBad === 0 && rootOk > 0 && anchored > 0,
      detail: sealError
        ? `The seal lookup FAILED server-side (${sealError}). The anchor status is UNKNOWN, which is not the same as absent.`
        : rootBad > 0
          ? `${rootBad} of ${rootOk + rootBad} seal root signatures do NOT verify.`
          : rootOk === 0
            ? "No seal in this pack carries a signed root. The receipts are attributable to NoData but their TIME is not independently established."
            : anchored === 0
              ? `All ${rootOk} seal roots verify, but none is anchored to Bitcoin yet. Until then the time still rests on NoData's word.`
              : `All ${rootOk} seal roots verify, and ${anchored} are anchored in the Bitcoin chain via OpenTimestamps.`,
      evidence: {
        signed_bytes: "the RAW 32 bytes of merkle_root (not the hex string), Ed25519",
        seals_anchored_to_bitcoin: `${anchored} of ${seals.length}`,
        ...(rootUnsigned ? { seals_without_signed_root: String(rootUnsigned) } : {}),
        ...(inner.epoch_seals_truncated ? { truncated: "more seals cover these receipts than the pack carries" } : {}),
        ...(rootDetail.length ? { failures: rootDetail.join(" · ") } : {}),
        what_this_does_not_prove: (inner.receipts ?? []).some((r) => r.inclusion)
          ? "A seal commits to a whole epoch; the per-receipt inclusion check below ties each carried receipt to its seal."
          : "A seal commits to a whole epoch. Per-receipt inclusion needs the Merkle inclusion path, which this pack does not carry.",
      },
    });
  }

  // 8. Per-receipt inclusion: each receipt that carries a Merkle path climbs to
  //    the root of the seal it names, and that seal is in the pack (its root
  //    signature and Bitcoin anchor are check 7). This is the link that turns
  //    "the receipt is signed" and "the root is witnessed" into "this receipt is
  //    under that witnessed root", so it cannot have been held back from the
  //    sealed set. Present only when the pack carries inclusion at all.
  const clockPassed = checks.find((c) => c.name.startsWith("External clock"))?.passed === true;
  const included = receipts.filter((r) => r.inclusion);
  if (included.length > 0) {
    const sealById = new Map(seals.map((sl) => [sl.id, sl]));
    let inOk = 0;
    let inBad = 0;
    const inDetail: string[] = [];
    for (const r of included) {
      const inc = r.inclusion as ReceiptInclusion;
      const seal = sealById.get(inc.epoch_seal_id);
      const fail = (why: string) => {
        inBad++;
        if (inDetail.length < 3) inDetail.push(`${r.id}: ${why}`);
      };
      if (!inc.path) {
        fail(`the server could not prove inclusion in seal ${inc.epoch_seal_id}${inc.server_check ? ` (${inc.server_check})` : ""}`);
        continue;
      }
      if (!seal || !seal.merkle_root) {
        fail(`seal ${inc.epoch_seal_id} is not in this pack`);
        continue;
      }
      if (inc.merkle_version !== 1 && inc.merkle_version !== 2) {
        fail(`unknown merkle_version ${String(inc.merkle_version)}`);
        continue;
      }
      if (seal.merkle_version != null && seal.merkle_version !== inc.merkle_version) {
        fail(`path is v${inc.merkle_version}, seal was built v${seal.merkle_version}`);
        continue;
      }
      try {
        if (rootFromInclusionPath(r.event_hash, inc.path, inc.merkle_version) !== String(seal.merkle_root).toLowerCase()) {
          fail(`path does not reach the root of seal ${seal.epoch_number ?? seal.id}`);
          continue;
        }
        // The root is only worth reaching if NoData's key signed it.
        if (!seal.signed_root_hex || !seal.signing_pubkey_hex || !(await ed25519Verify(seal.signing_pubkey_hex, seal.signed_root_hex, hexToBytes(seal.merkle_root)))) {
          fail(`seal ${seal.epoch_number ?? seal.id} root is not signed by its key`);
          continue;
        }
        // Anchored is a property of THIS seal, not of the pack: a path to a root
        // no witness has anchored yet proves inclusion in something only NoData
        // vouches for. (Fresh epochs fail here until OpenTimestamps confirms.)
        if (!seal.ots_anchored_at) {
          fail(`seal ${seal.epoch_number ?? seal.id} is not anchored yet`);
          continue;
        }
        inOk++;
      } catch (err) {
        fail((err as Error).message);
      }
    }
    const notCarried = receipts.length - included.length;
    checks.push({
      name: `Per-receipt Merkle inclusion (${included.length} of ${receipts.length} receipts carry a path)`,
      // The external clock (check 7) must hold too: a path to a root no witness
      // anchored proves inclusion in something only NoData vouches for.
      passed: inBad === 0 && inOk > 0 && clockPassed,
      detail:
        !clockPassed && inBad === 0
          ? "Every path reaches its seal root, but the external clock check did not pass, so the roots are not independently anchored."
          : inBad > 0
          ? `${inBad} of ${included.length} inclusion paths do NOT reach their seal's root. Those receipts are not shown to be in the witnessed set.`
          : `All ${inOk} paths climb from the receipt's event_hash to the signed root of its epoch seal.${notCarried ? ` ${notCarried} receipt(s) carry no path (not yet sealed, or exported before inclusion was carried).` : ""}`,
      evidence: {
        leaf: "the receipt's event_hash; v2 leaf = SHA-256(0x00 || leaf), node = SHA-256(0x01 || left || right)",
        ...(inDetail.length ? { failures: inDetail.join(" · ") } : {}),
      },
    });
  }

  return checks;
}

// ─── Release-bound receipts (trust debt G5) ─────────────────────────────────
//
// A key half NoData releases is useless alone: it opens only joined with the
// half on the receiving computer. So the receiving computer can make "no
// receipt, no release" its own rule instead of trusting ours: it joins a half
// only when the half arrives with a receipt that (1) NoData's PINNED chain key
// signed, (2) hashes to its own event, (3) allows this surface, and (4) names
// this very half (SHA-256 of what arrived) and this very request (the nonce the
// computer sent). A release NoData made without a receipt, or with a receipt
// about something else, opens nothing. The witness (epoch seals, published
// outside NoData) then keeps that receipt from being quietly dropped later.

export interface ReleaseReceipt {
  id: string;
  scope_ref: string;
  chain_index: number;
  event_data: Record<string, unknown>;
  event_hash: string;
  prev_receipt_id: string | null;
  created_at: string;
  signature_hex: string | null;
  signing_pubkey_hex: string | null;
  signing_kid?: string | null;
  pq_signature_hex?: string | null;
  pq_pubkey_hex?: string | null;
  sig_suite: string | null;
}

export interface ReleaseExpectation {
  /** The decision surface the release must have been decided on, e.g. "secret.pull". */
  surface: string;
  /** SHA-256 (hex) of the released value exactly as it arrived. */
  valueSha256: string;
  /** The nonce this computer sent with the request; required in the receipt when given. */
  nonce?: string | null;
}

/** The pinned chain keys a release receipt may be signed by (NODATA-KEYS.json chain_keys). */
export interface PinnedChainKey {
  ed25519_pubkey_hex: string;
  ml_dsa65_pubkey_hex?: string | null;
  retired_at?: string | null;
}

export type ReleaseVerdict = { ok: true; receipt_id: string; chain_index: number } | { ok: false; why: string };

/** Check one release receipt offline. Never throws: anything malformed is a refusal with its reason. */
export async function verifyReleaseReceipt(r: unknown, expect: ReleaseExpectation, keys: PinnedChainKey[]): Promise<ReleaseVerdict> {
  const no = (why: string): ReleaseVerdict => ({ ok: false, why });
  if (!r || typeof r !== "object") return no("no release receipt came with it");
  const x = r as Partial<ReleaseReceipt>;
  const ev = x.event_data;
  if (!ev || typeof ev !== "object" || typeof x.event_hash !== "string" || typeof x.created_at !== "string" || typeof x.id !== "string") return no("the release receipt is incomplete");
  try {
    if (sha256Hex(canonicalize(ev)) !== x.event_hash.toLowerCase()) return no("the release receipt's event does not match its hash");
    if (ev.decision !== "allow") return no(`the release receipt does not allow (it says ${String(ev.decision)})`);
    if (ev.surface !== expect.surface) return no(`the release receipt is about ${String(ev.surface)}, not ${expect.surface}`);
    const data = (ev.data ?? {}) as Record<string, unknown>;
    const release = (data.release ?? {}) as Record<string, unknown>;
    if (release.share_sha256 !== expect.valueSha256.toLowerCase()) return no("the release receipt names a different value from the one that arrived");
    if (expect.nonce && release.nonce !== expect.nonce) return no("the release receipt is for another request (nonce)");
    if (receiptContext(x.sig_suite) !== DECISION_RECEIPT_CONTEXT || !/^[0-9a-f]{64}$/.test(x.scope_ref ?? "")) return no("the release receipt is not signed as a decision receipt");
    if (!x.signature_hex || !x.signing_pubkey_hex) return no("the release receipt is unsigned");
    const key = keys.find((k) => k.ed25519_pubkey_hex.toLowerCase() === x.signing_pubkey_hex!.toLowerCase());
    if (!key) return no("the release receipt is signed by a key that is not NoData's pinned key");
    if (key.retired_at && Date.parse(canonicalChainTime(x.created_at)) > Date.parse(key.retired_at)) return no("the release receipt is signed by a retired key");
    const signed = utf8(receiptSignedInput({ event_hash: x.event_hash, prev_receipt_id: x.prev_receipt_id ?? null, created_at: x.created_at, sig_suite: x.sig_suite, scope_ref: x.scope_ref }));
    if (!(await ed25519Verify(key.ed25519_pubkey_hex, x.signature_hex, signed))) return no("the release receipt's signature does not verify");
    // A pinned post-quantum half is demanded too, against the PINNED key, never the one the receipt carries.
    if (key.ml_dsa65_pubkey_hex) {
      if (!x.pq_signature_hex) return no("the release receipt lacks its post-quantum signature");
      if (!ml_dsa65.verify(hexToBytes(x.pq_signature_hex), signed, hexToBytes(key.ml_dsa65_pubkey_hex))) return no("the release receipt's post-quantum signature does not verify");
    }
    return { ok: true, receipt_id: x.id, chain_index: typeof x.chain_index === "number" ? x.chain_index : -1 };
  } catch (err) {
    return no(`the release receipt could not be checked (${(err as Error).message})`);
  }
}
