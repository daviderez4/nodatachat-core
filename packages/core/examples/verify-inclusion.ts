// ════════════════════════════════════════════════════════════════════
// examples/verify-inclusion.ts
//
// Verify a NoData receipt's Merkle inclusion proof against the
// public witness feed. Pure math · no NoData servers in the path.
//
// Usage:
//   1. From your receipt page (https://www.nodatacapsule.com/verify/ref/<your-ref>)
//      expand the "sibling chain" section and copy the JSON.
//   2. Open the matching epoch file from the witness feed:
//        https://github.com/proofbydefault/witness-feed/blob/main/
//          epochs/YYYY-MM/YYYY-MM-DD-HH.json
//      Note its `merkle_root` value.
//   3. Run this script · pass the receipt JSON via stdin or argument.
//
//   $ tsx examples/verify-inclusion.ts '{"leaf":"...","proof":[...],"expected_root":"..."}'
//
// If the computed root matches expected_root, the receipt is included
// in that epoch · NoData cannot have altered it after sealing time.
// ════════════════════════════════════════════════════════════════════

import { verifyInclusion, type InclusionStep } from '../src/witness';

interface ReceiptProof {
  leaf: string;
  proof: InclusionStep[];
  expected_root: string;
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: tsx verify-inclusion.ts \'{"leaf":..., "proof":[...], "expected_root":...}\'');
    process.exit(2);
  }
  const input = JSON.parse(raw) as ReceiptProof;
  const ok = await verifyInclusion(input.leaf, input.proof, input.expected_root);

  console.log('leaf:          ', input.leaf);
  console.log('proof_steps:   ', input.proof.length);
  console.log('expected_root: ', input.expected_root);
  console.log('verified:      ', ok ? 'YES · receipt is included in this epoch' : 'NO · proof does not verify');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('error:', err);
  process.exit(3);
});
