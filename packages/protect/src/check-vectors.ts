// Recompute the split-key test vectors from SPLIT-KEY-FORMAT.md and say whether
// the implementation matches the published format. Everything it needs is in
// this package: the spec text, the implementation, and Node's SHA-256. It talks
// to no one, so its PASS does not depend on trusting NoData.
//
//   npx @nodatachat/protect@3 check-vectors   (see bin.ts)

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkSealVectors } from "./check-seal-vectors";
import { joinKey, splitKeyWith } from "./split-key";

export interface SplitKeyVector {
  seed: string;
  value: string;
  server: string;
  client: string;
}

/** The randomness the vectors fix, exactly as SPLIT-KEY-FORMAT.md defines it. */
export function vectorRandom(seed: string): (n: number) => Buffer {
  let call = 0;
  return (n: number) => {
    const label = `${seed}|${call++}`;
    const parts: Buffer[] = [];
    for (let c = 0; parts.length * 32 < n; c += 1) {
      const ctr = Buffer.alloc(4);
      ctr.writeUInt32BE(c);
      parts.push(createHash("sha256").update(label).update(ctr).digest());
    }
    return Buffer.concat(parts).subarray(0, n);
  };
}

/** The vectors table, read out of the spec text itself. */
export function parseVectors(spec: string): SplitKeyVector[] {
  return [...spec.matchAll(/^\| `(nodata\.split-key\.v1\\\|vector-\d)` \| (.+?) \| `([0-9a-f]{64})` \| `([0-9a-f]{64})` \|$/gm)].map((m) => {
    const repeat = /^`(.)` × (\d+)/.exec(m[2]);
    return {
      seed: m[1].replace("\\|", "|"),
      value: repeat ? repeat[1].repeat(Number(repeat[2])) : m[2].replace(/^`|`$/g, ""),
      server: m[3],
      client: m[4],
    };
  });
}

export const SPEC_PATH = join(__dirname, "..", "SPLIT-KEY-FORMAT.md");

/** Each vector → whether both halves hash as published and join back to the value. */
export function checkVectors(spec = readFileSync(SPEC_PATH, "utf8")): Array<SplitKeyVector & { ok: boolean }> {
  const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  return parseVectors(spec).map((v) => {
    const { server, client } = splitKeyWith(v.value, vectorRandom(v.seed), 0);
    const ok = sha(server) === v.server && sha(client) === v.client && joinKey(client, server, 0) === v.value;
    return { ...v, ok };
  });
}

/** Print one line per vector and a verdict per spec; the exit code is 0 only when every spec passes. */
export function runCheckVectors(out: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): number {
  const results = checkVectors();
  for (const r of results) out(`${r.ok ? "PASS" : "FAIL"}  ${r.seed}`);
  const pass = results.length > 0 && results.every((r) => r.ok);
  out(pass ? `PASS: the implementation matches SPLIT-KEY-FORMAT.md (${results.length} vectors)` : "FAIL: the implementation does not match SPLIT-KEY-FORMAT.md");

  const seals = checkSealVectors();
  for (const r of seals) out(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  (${r.bad.join(", ")})`}`);
  const sealPass = seals.length > 0 && seals.every((r) => r.ok);
  out(sealPass ? `PASS: the implementation matches SEAL-FORMAT.md (${seals.length} vectors)` : "FAIL: the implementation does not match SEAL-FORMAT.md");
  return pass && sealPass ? 0 : 1;
}
