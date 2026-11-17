// Verify a Mycelium transfer without trusting NoData (launch plan, stage 4).
//
// Two claims the Mycelium makes, each checkable here with what ships in this
// package and nothing else (no network, no NoData server, no secret):
//
//   1. "The relay carried this envelope, and NoData signed for it."
//      verifyRelayReceipt: the receipt NoData signs on every send
//      (schema nodata.shield-relay-receipt/v1). The signature must verify under
//      a key pinned in NODATA-KEYS.json, never under the key the receipt names.
//      With the opened command or file, it also checks the sender's commitment
//      (released_sha256): what you opened is what the sender filed.
//
//   2. "The decision is on BOTH organisations' chains."
//      verifyBothSides: two evidence packs, one exported by each organisation.
//      Each must verify on its own (verifyPack + pinned signer), and each must
//      hold the fabric.send decision for the same envelope, one as the sender's
//      side and one as the recipient's, with the same decision.
//
// What this does not prove, stated in FABRIC-RECEIPT-FORMAT.md: that the
// content was correct, or that no other copy exists outside the relay.
//
//   npx @nodatachat/protect@3 verify-relay-receipt receipt.json [--opened file]
//   npx @nodatachat/protect@3 verify-both-sides a-pack.json b-pack.json --blob <id>

import { createHash, webcrypto } from "node:crypto";
import { checkOrigin, contextEras, type PinnedKeys } from "./pinned-keys";
import { canonicalize, verifyPack, type CheckResult, type EvidencePack, type Receipt } from "./verify-pack";

// Local, not imported from verify-pack: verify-pack is also bundled into the
// MCP, and changing it would oblige an MCP release for nothing it uses.
async function ed25519Verify(pubkeyHex: string, signatureHex: string, data: Uint8Array): Promise<boolean> {
  const raw = Uint8Array.from(Buffer.from(pubkeyHex, "hex"));
  if (raw.length !== 32) throw new Error(`Ed25519 pubkey must be 32 bytes (got ${raw.length})`);
  const key = await webcrypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
  return webcrypto.subtle.verify({ name: "Ed25519" }, key, Uint8Array.from(Buffer.from(signatureHex, "hex")), data);
}

export const RELAY_RECEIPT_SCHEMA = "nodata.shield-relay-receipt/v1";

export interface RelayReceipt {
  payload: Record<string, unknown>;
  signature_hex: string;
  signing_pubkey_hex?: string | null;
  signing_kid?: string | null;
  signed_at?: string | null;
}

const lc = (h: unknown) => (typeof h === "string" ? h.toLowerCase() : "");
const isHex = (s: unknown, len?: number) => typeof s === "string" && /^[0-9a-f]+$/i.test(s) && (len === undefined || s.length === len);

/** The relay receipt's checks. `opened`: the bytes you opened (the canonical command or the file). */
export async function verifyRelayReceipt(raw: unknown, keys: PinnedKeys, opts: { opened?: Uint8Array | string } = {}): Promise<CheckResult[]> {
  const r = raw as RelayReceipt | null;
  const checks: CheckResult[] = [];
  const p = r?.payload;
  if (!r || typeof r !== "object" || !p || typeof p !== "object" || !isHex(r.signature_hex, 128)) {
    return [{ name: "Relay receipt shape", passed: false, detail: "Expected { payload, signature_hex (64 bytes hex) }." }];
  }
  const shapeOk = p.schema === RELAY_RECEIPT_SCHEMA && typeof p.blob_id === "string" && isHex(p.sender_kid, 16) && isHex(p.recipient_kid, 16) && isHex(p.ciphertext_sha256_hex, 64);
  checks.push({
    name: "Relay receipt shape",
    passed: shapeOk,
    detail: shapeOk
      ? `envelope ${String(p.blob_id)} · from ${String(p.sender_kid)} to ${String(p.recipient_kid)} · ciphertext sha256 ${String(p.ciphertext_sha256_hex).slice(0, 16)}…`
      : `Not a ${RELAY_RECEIPT_SCHEMA} payload (schema, blob_id, sender_kid, recipient_kid, ciphertext_sha256_hex).`,
  });

  // The signer is whichever PINNED key verifies; the key the receipt names is only a hint.
  const pinned = [
    ...keys.chain_keys.map((k) => ({ kid: k.kid, hex: lc(k.ed25519_pubkey_hex) })),
    ...keys.pack_envelope_signers.map((k) => ({ kid: k.kid, hex: lc(k.ed25519_pubkey_hex) })),
  ].filter((k) => isHex(k.hex, 64));
  const named = lc(r.signing_pubkey_hex);
  const order = [...pinned.filter((k) => k.hex === named), ...pinned.filter((k) => k.hex !== named)];
  const signed = new TextEncoder().encode(canonicalize(p));
  let signer: string | null = null;
  for (const k of order) {
    try {
      if (await ed25519Verify(k.hex, r.signature_hex, signed)) { signer = k.kid; break; }
    } catch { /* a malformed key in the file is not a signer */ }
  }
  checks.push({
    name: "Signed by NoData's published keys (NODATA-KEYS.json)",
    passed: signer !== null,
    detail: signer
      ? `Ed25519 over the canonical payload verifies under pinned key ${signer}.`
      : pinned.length === 0
        ? "The keys file pins no keys, so the signer cannot be checked."
        : "No pinned key verifies this signature. A receipt that verifies only under the key it names is not NoData's.",
  });

  checks.push(...folderChecks(p));

  if (opts.opened !== undefined) {
    const committed = typeof p.released_sha256 === "string" ? p.released_sha256.toLowerCase() : null;
    const bytes = typeof opts.opened === "string" ? new TextEncoder().encode(opts.opened) : opts.opened;
    const got = createHash("sha256").update(bytes).digest("hex");
    checks.push({
      name: "What you opened is what the sender committed to",
      passed: committed !== null && committed === got,
      detail: committed === null
        ? "This receipt carries no sender commitment (released_sha256), so the opened content cannot be tied to it."
        : committed === got
          ? `sha256 ${got.slice(0, 16)}… equals the sender's released_sha256.`
          : `sha256 of what you opened is ${got.slice(0, 16)}…; the sender committed to ${committed.slice(0, 16)}….`,
    });
  }
  return checks;
}

// ── Connection-folder membership (FABRIC-RECEIPT-FORMAT.md §3) ───────────────
// Re-implemented from the spec with node:crypto only (this package depends on
// nothing else for hashing); the product's implementation is
// @nodatachat/crypto folder-projection.ts, and a test checks the two agree.
// RFC 6962 tree: leaf = sha256(0x00 | leaf bytes), node = sha256(0x01 | l | r),
// an odd node promoted, never duplicated.

export interface FolderLeafPreimage { v: 1; ph: string; h: string; n: number; mh: string }
export interface FolderProofStep { sibling: string; sibling_is_right: boolean }
export interface FolderEvidence { root: string; leaf: FolderLeafPreimage; proof: FolderProofStep[] }

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest();
const HEX64 = /^[0-9a-f]{64}$/;

/** The leaf a file stands for in a folder projection: sha256 of its labelled fields, hex. */
export function folderLeaf(p: FolderLeafPreimage): string {
  return sha(`nodata.folder.leaf.v1|${p.ph}|${p.h}|${p.n}|${p.mh}`).toString("hex");
}

/** Climb from a hex leaf to the root along the proof. */
export function folderInclusionHolds(leaf: string, proof: FolderProofStep[], root: string): boolean {
  if (!HEX64.test(leaf) || !HEX64.test(root) || !Array.isArray(proof) || proof.length > 64) return false;
  let cur = sha(Buffer.concat([Buffer.from([0x00]), Buffer.from(leaf, "hex")]));
  for (const s of proof) {
    if (!s || !HEX64.test(s.sibling)) return false;
    const sib = Buffer.from(s.sibling, "hex");
    cur = sha(Buffer.concat([Buffer.from([0x01]), s.sibling_is_right ? cur : sib, s.sibling_is_right ? sib : cur]));
  }
  return cur.toString("hex") === root;
}

function readFolderEvidence(x: unknown): FolderEvidence | null {
  const f = x as Partial<FolderEvidence> | null;
  const l = f?.leaf as Partial<FolderLeafPreimage> | undefined;
  if (!f || typeof f.root !== "string" || !HEX64.test(f.root) || !Array.isArray(f.proof) || !l || l.v !== 1) return null;
  if (![l.ph, l.h, l.mh].every((h) => typeof h === "string" && HEX64.test(h)) || !Number.isInteger(l.n)) return null;
  return f as FolderEvidence;
}

/** The checks on a relay receipt's folder evidence, when it carries one. */
export function folderChecks(payload: Record<string, unknown>): CheckResult[] {
  if (payload.folder === undefined) return [];
  const f = readFolderEvidence(payload.folder);
  if (!f) return [{ name: "A member of the folder the receiver approved", passed: false, detail: "The receipt's folder evidence is malformed (root, leaf {v, ph, h, n, mh}, proof)." }];
  const leaf = folderLeaf(f.leaf);
  const inTree = folderInclusionHolds(leaf, f.proof, f.root);
  // The projection names ORIGINALS: an original's leaf holds its own hash; a
  // clean copy's leaf holds the hash of the original it was made from.
  const released = typeof payload.released_sha256 === "string" ? payload.released_sha256.toLowerCase() : null;
  const source = typeof payload.source_sha256 === "string" ? payload.source_sha256.toLowerCase() : null;
  const sameFile = f.leaf.h === (source ?? released);
  return [
    {
      name: "A member of the folder the receiver approved",
      passed: inTree,
      detail: inTree
        ? `The file's leaf climbs ${f.proof.length} step(s) to root ${f.root.slice(0, 16)}…, the projection the receiver approved.`
        : `The leaf does not climb to root ${f.root.slice(0, 16)}…: not a file of the approved projection.`,
    },
    {
      name: "The approved file is the one released",
      passed: sameFile,
      detail: sameFile
        ? source
          ? `A clean copy of the approved original (sha256 ${source.slice(0, 16)}…).`
          : `The approved file's sha256 equals what the sender released (${f.leaf.h.slice(0, 16)}…).`
        : `The approved leaf names ${f.leaf.h.slice(0, 16)}…, the sender released ${(source ?? released ?? "nothing").slice(0, 16)}….`,
    },
  ];
}

/** The root is the one the receiver's own pack records it approved (fabric.grant, stage folder_approve). */
export async function verifyApprovalInPack(root: string, pack: EvidencePack, keys: PinnedKeys): Promise<CheckResult[]> {
  const own = [...(await verifyPack(pack, { contextSince: contextEras(keys) })), checkOrigin(pack, keys)];
  const failed = own.filter((c) => !c.passed);
  const approvals = (pack?.nodata_evidence_pack?.receipts ?? []).filter((r) => {
    const ev = r.payload as { surface?: unknown; decision?: unknown; subject?: { stage?: unknown }; data?: { root?: unknown } } | null;
    return ev?.surface === "fabric.grant" && ev.decision === "grant" && ev.subject?.stage === "folder_approve" && ev.data?.root === root;
  });
  return [
    { name: "The receiver's pack verifies", passed: failed.length === 0, detail: failed.length === 0 ? `${own.length} checks hold.` : `Fails: ${failed.map((c) => c.name).join("; ")}.` },
    {
      name: "The receiver approved this root",
      passed: approvals.length > 0,
      detail: approvals.length > 0
        ? `A signed folder_approve receipt names root ${root.slice(0, 16)}… (${approvals[0].created_at}).`
        : `No folder_approve receipt in this pack names root ${root.slice(0, 16)}….`,
    },
  ];
}

interface SideHit { side: string; decision: string; receipt: Receipt }

/** The fabric.send decisions in a pack for one envelope. Payload = the signed event_data. */
export function fabricDecisionsFor(pack: EvidencePack, blobId: string): SideHit[] {
  const out: SideHit[] = [];
  for (const r of pack?.nodata_evidence_pack?.receipts ?? []) {
    const ev = r.payload as { surface?: unknown; decision?: unknown; subject?: { blob_id?: unknown }; data?: { side?: unknown } } | null;
    if (!ev || ev.surface !== "fabric.send" || ev.subject?.blob_id !== blobId) continue;
    out.push({ side: String(ev.data?.side ?? ""), decision: String(ev.decision ?? ""), receipt: r });
  }
  return out;
}

/** Both organisations' packs verify on their own, and both hold the decision for this envelope. */
export async function verifyBothSides(packA: EvidencePack, packB: EvidencePack, blobId: string, keys: PinnedKeys): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const contextSince = contextEras(keys);
  for (const [label, pack] of [["first", packA], ["second", packB]] as const) {
    const own = [...(await verifyPack(pack, { contextSince })), checkOrigin(pack, keys)];
    const failed = own.filter((c) => !c.passed);
    checks.push({
      name: `The ${label} organisation's pack verifies`,
      passed: failed.length === 0,
      detail: failed.length === 0 ? `${own.length} checks hold.` : `Fails: ${failed.map((c) => c.name).join("; ")}.`,
    });
  }

  return [...checks, ...fabricSideChecks(packA, packB, blobId)];
}

/** The two side checks alone: which side each pack holds for this envelope, and whether the decisions agree. */
export function fabricSideChecks(packA: EvidencePack, packB: EvidencePack, blobId: string): CheckResult[] {
  const checks: CheckResult[] = [];
  const a = fabricDecisionsFor(packA, blobId);
  const b = fabricDecisionsFor(packB, blobId);
  const sides = (h: SideHit[]) => new Set(h.map((x) => x.side));
  const sa = sides(a);
  const sb = sides(b);
  const split = (sa.has("sender") && sb.has("recipient")) || (sa.has("recipient") && sb.has("sender"));
  const same = sa.has("both") || sb.has("both");
  checks.push({
    name: "The decision is on both organisations' chains",
    passed: split,
    detail: a.length === 0 || b.length === 0
      ? `Envelope ${blobId}: ${a.length} decision(s) in the first pack, ${b.length} in the second. Each side must export its own.`
      : split
        ? `Envelope ${blobId}: the sender's side and the recipient's side each hold their own signed receipt.`
        : same
          ? `Envelope ${blobId} was sent inside one organisation (side "both"): there is no second chain to compare.`
          : `Envelope ${blobId}: sides ${[...sa].join(",")} and ${[...sb].join(",")}, not one sender and one recipient.`,
  });

  const da = new Set(a.map((x) => x.decision));
  const db = new Set(b.map((x) => x.decision));
  const agree = a.length > 0 && b.length > 0 && da.size === 1 && db.size === 1 && [...da][0] === [...db][0];
  checks.push({
    name: "Both sides record the same decision",
    passed: agree,
    detail: agree ? `Both record "${[...da][0]}".` : `First: ${[...da].join(",") || "none"} · second: ${[...db].join(",") || "none"}.`,
  });
  return checks;
}
