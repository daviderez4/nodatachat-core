// ════════════════════════════════════════════════════════════════════
// @nodatachat/core/witness · Merkle inclusion verification
//
// Reference verifier for the public witness feed at
//   https://github.com/nodatachat/witness-feed
//
// Every UTC hour, NoData seals all operator receipts issued in that
// window into a Merkle tree, signs the root with Ed25519, and writes
// a commitment file to the public witness repo · path:
//   epochs/YYYY-MM/YYYY-MM-DD-HH.json
//
// A receipt holder can prove their receipt was included in a given
// epoch WITHOUT trusting NoData servers, by:
//   1. Fetching the inclusion proof from their receipt UI
//      (https://nodatachat.com/verify/ref/<their-ref>)
//   2. Fetching merkle_root from the witness feed for that hour
//   3. Running verifyInclusion() locally · pure math.
//
// If verifyInclusion returns true, NoData cannot have altered the
// receipt after sealing time · even if NoData disappears tomorrow,
// the witness feed + this verifier still prove what existed.
//
// Algorithm notes:
//   · Leaves are SHA-256 hashes already (the receipt event_hash)
//   · Leaves are SORTED lexicographically before hashing · this kills
//     arrival-order leakage (two same-set epochs produce the same root)
//   · Internal nodes · SHA-256(left || right) over raw bytes
//   · Odd levels · the last node is paired with itself (Bitcoin style)
//   · No external dependencies · Web Crypto API only (W3C standard,
//     available in browsers + Node.js ≥ 18 + Deno + Bun)
// ════════════════════════════════════════════════════════════════════

export interface InclusionStep {
  /** Sibling hash on the same level · 64 hex chars. */
  sibling: string;
  /** True if the sibling is on the RIGHT of the current node.
   *  Verification hashes (current, sibling) when sibling is right,
   *  (sibling, current) when sibling is left. */
  sibling_is_right: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex string has odd length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(buf);
}

// ─── public API ─────────────────────────────────────────────────────

/**
 * Build the Merkle root from a list of hex leaves.
 *
 * Expectations:
 *   · Each leaf is a 64-character SHA-256 hex string
 *   · Caller has already sorted the leaves lexicographically · this
 *     function does NOT sort (the sorted order is part of the
 *     anti-enumeration guarantee · two epochs with the same set
 *     must produce the same root regardless of arrival order)
 *
 * Empty input returns '0'.repeat(64) (the zero-root sentinel).
 */
export async function merkleRoot(sortedLeaves: string[]): Promise<string> {
  if (sortedLeaves.length === 0) return '0'.repeat(64);
  if (sortedLeaves.length === 1) return sortedLeaves[0];

  let level: Uint8Array[] = sortedLeaves.map(hexToBytes);
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(await sha256(concat(left, right)));
    }
    level = next;
  }
  return bytesToHex(level[0]);
}

/**
 * Build the inclusion proof for the leaf at `targetIndex` in
 * `sortedLeaves`. The returned proof verifies via verifyInclusion().
 */
export async function inclusionProof(
  sortedLeaves: string[],
  targetIndex: number,
): Promise<InclusionStep[]> {
  if (targetIndex < 0 || targetIndex >= sortedLeaves.length) {
    throw new Error('inclusionProof: target out of range');
  }
  if (sortedLeaves.length === 1) return [];

  const proof: InclusionStep[] = [];
  let level: Uint8Array[] = sortedLeaves.map(hexToBytes);
  let index = targetIndex;

  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      if (i === index || i + 1 === index) {
        const isLeftTarget = i === index;
        proof.push({
          sibling: bytesToHex(isLeftTarget ? right : left),
          sibling_is_right: isLeftTarget,
        });
      }
      next.push(await sha256(concat(left, right)));
    }
    level = next;
    index = Math.floor(index / 2);
  }
  return proof;
}

/**
 * Verify an inclusion proof against a known root.
 *
 * This is the function consumers care about · it answers
 * "did this leaf appear in the epoch with this root?"
 *
 * No NoData servers in the path · pure SHA-256 math.
 */
export async function verifyInclusion(
  leafHashHex: string,
  proof: InclusionStep[],
  expectedRootHex: string,
): Promise<boolean> {
  let current = hexToBytes(leafHashHex);
  for (const step of proof) {
    const sibling = hexToBytes(step.sibling);
    current = step.sibling_is_right
      ? await sha256(concat(current, sibling))
      : await sha256(concat(sibling, current));
  }
  return bytesToHex(current) === expectedRootHex.toLowerCase();
}
