#!/usr/bin/env node
// The verification layer's one command. Every subcommand checks a claim NoData
// makes, offline, with what ships in this package; none of them runs NoData.
// One checks your AI agent instead of NoData, from the agent's own history:
//
//   npx @nodatachat/protect@3 agent-check [--days N] [--lang he]
//                                                   what Claude Code / Codex did on this
//                                                   computer: counts only, nothing sent
//
//   npx @nodatachat/protect@3 check-vectors          split-key format (SPLIT-KEY-FORMAT.md)
//   npx @nodatachat/protect@3 verify-pack pack.json  an evidence pack (EVIDENCE-PACK-FORMAT.md),
//                                                   and that NoData's pinned keys signed it
//   … verify-pack pack.json --keys keys.json         check the signer against another keys file
//   npx @nodatachat/protect@3 inspect-seal f.ndc     whom a sealed file opens for (SEAL-FORMAT.md)
//   npx @nodatachat/protect@3 verify-relay-receipt r.json [--opened file] [--approval pack.json]
//                                                   a Mycelium relay receipt (FABRIC-RECEIPT-FORMAT.md)
//   npx @nodatachat/protect@3 verify-both-sides a.json b.json --blob <id>
//                                                   one Mycelium envelope on both organisations' chains

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { localSalt } from "./agent-events";
import { checkAgents, localEvents } from "./agent-history";
import { reportHtml, reportLines, type Lang } from "./agent-history-report";
import { runCheckVectors } from "./check-vectors";
import { checkOrigin, contextEras, loadPinnedKeys, NODATA_KEYS_PATH } from "./pinned-keys";
import { inspectNdc, type NdcManifest } from "./seal-v3";
import { verifyApprovalInPack, verifyBothSides, verifyRelayReceipt } from "./verify-fabric";
import { verifyPack, type CheckResult, type EvidencePack } from "./verify-pack";

const USAGE =
  "usage: protect agent-check [--days N] [--lang he] | protect check-vectors | protect verify-pack <pack.json> [--keys <keys.json>] | protect inspect-seal <file.ndc>" +
  " | protect verify-relay-receipt <receipt.json> [--opened <file>] [--approval <receiver-pack.json>] | protect verify-both-sides <a-pack.json> <b-pack.json> --blob <id>";

export async function main(argv: string[], out: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): Promise<number> {
  const [cmd, file, flag, keysFile] = argv;
  if (cmd === "agent-check") return agentCheck(argv.slice(1), out);
  if (cmd === "check-vectors" || cmd === undefined) return runCheckVectors(out);
  if (cmd === "inspect-seal" && file && flag === undefined) return inspectSeal(file, out);
  if (cmd === "verify-relay-receipt" && file) {
    const opts = flags(argv.slice(2), ["--opened", "--approval"]);
    if (opts) return relayReceipt(file, opts["--opened"], opts["--approval"], out);
  }
  if (cmd === "verify-both-sides" && file && flag && argv[3] === "--blob" && argv[4]) return bothSides(file, flag, argv[4], out);
  if (cmd !== "verify-pack" || !file || (flag !== undefined && (flag !== "--keys" || !keysFile))) {
    out(USAGE);
    return 2;
  }
  let pack: EvidencePack;
  try {
    pack = JSON.parse(readFileSync(file, "utf8")) as EvidencePack;
  } catch (err) {
    out(`FAIL: cannot read ${file} as JSON (${(err as Error).message})`);
    return 1;
  }
  let origin;
  let contextSince: Record<string, string> = {};
  try {
    const keys = loadPinnedKeys(keysFile ?? NODATA_KEYS_PATH);
    origin = checkOrigin(pack, keys, keysFile ? `the keys in ${keysFile}` : undefined);
    // When each pinned key began signing in receipt contexts, from the keys
    // file (never from the pack): the downgrade rule's cutover.
    contextSince = contextEras(keys);
  } catch (err) {
    origin = { name: "Signer", passed: false, detail: `cannot read the keys file (${(err as Error).message})` };
  }
  // The integrity checks prove the maths; the last one proves whose key did it.
  const checks = [...(await verifyPack(pack, { contextSince })), origin];
  for (const c of checks) {
    out(`${c.passed ? "PASS" : "FAIL"}  ${c.name}`);
    out(`      ${c.detail}`);
  }
  const pass = checks.length > 0 && checks.every((c) => c.passed);
  out(pass ? `PASS: every check on this evidence pack holds (${checks.length} checks)` : `FAIL: ${checks.filter((c) => !c.passed).length} of ${checks.length} checks do not hold`);
  return pass ? 0 : 1;
}

function readJson(file: string, out: (line: string) => void): unknown | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    out(`FAIL: cannot read ${file} as JSON (${(err as Error).message})`);
    return undefined;
  }
}

function report(checks: CheckResult[], what: string, out: (line: string) => void): number {
  for (const c of checks) {
    out(`${c.passed ? "PASS" : "FAIL"}  ${c.name}`);
    out(`      ${c.detail}`);
  }
  const pass = checks.length > 0 && checks.every((c) => c.passed);
  out(pass ? `PASS: every check on ${what} holds (${checks.length} checks)` : `FAIL: ${checks.filter((c) => !c.passed).length} of ${checks.length} checks do not hold`);
  return pass ? 0 : 1;
}

/** `--name value` pairs from the allowed names; null on anything else. */
function flags(rest: string[], allowed: string[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!allowed.includes(rest[i]) || !rest[i + 1] || rest[i] in out) return null;
    out[rest[i]] = rest[i + 1];
  }
  return out;
}

/**
 * A Mycelium relay receipt, against NoData's pinned keys. With --opened, the
 * sender's commitment; a folder file's membership is checked whenever the
 * receipt carries it, and with --approval <the receiver's pack>, that the
 * receiver's own signed receipt approved that root.
 */
async function relayReceipt(file: string, opened: string | undefined, approval: string | undefined, out: (line: string) => void): Promise<number> {
  const r = readJson(file, out);
  if (r === undefined) return 1;
  let bytes: Uint8Array | undefined;
  if (opened) {
    try { bytes = readFileSync(opened); } catch (err) { out(`FAIL: cannot read ${opened} (${(err as Error).message})`); return 1; }
  }
  const keys = loadPinnedKeys();
  const checks = await verifyRelayReceipt(r, keys, { opened: bytes });
  if (approval) {
    const pack = readJson(approval, out) as EvidencePack | undefined;
    if (!pack) return 1;
    const root = (r as { payload?: { folder?: { root?: unknown } } }).payload?.folder?.root;
    if (typeof root !== "string") checks.push({ name: "The receiver approved this root", passed: false, detail: "This receipt carries no folder evidence, so there is no root to look for." });
    else checks.push(...(await verifyApprovalInPack(root, pack, keys)));
  }
  return report(checks, "this relay receipt", out);
}

/** One envelope on both organisations' chains: two packs, one exported by each side. */
async function bothSides(fileA: string, fileB: string, blobId: string, out: (line: string) => void): Promise<number> {
  const a = readJson(fileA, out) as EvidencePack | undefined;
  const b = readJson(fileB, out) as EvidencePack | undefined;
  if (!a || !b) return 1;
  return report(await verifyBothSides(a, b, blobId, loadPinnedKeys()), `envelope ${blobId}`, out);
}

/**
 * What the AI coding agent on this computer did, from its own history
 * (agent-history.ts). Local only, counts only. Writes one HTML card next to
 * where it runs (or --out <file>), unless --no-card.
 *   agent-check [--days N] [--lang he|en] [--out file.html] [--no-card] [--json] [--events]
 *   --events prints the LOCAL report (one finding per line, with where); nothing else carries it.
 */
function agentCheck(rest: string[], out: (line: string) => void): number {
  const opt = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const days = Math.min(Math.max(Number(opt("--days") ?? 30) || 30, 1), 3650);
  const lang: Lang = opt("--lang") === "he" ? "he" : "en";
  if (rest.includes("--events")) {
    // The LOCAL report: one event per finding, with where. For this computer only: it is
    // printed here and written nowhere else, and the card never carries any of it.
    for (const e of localEvents(days, localSalt())) out(JSON.stringify(e));
    return 0;
  }
  const report = checkAgents(days);
  if (rest.includes("--json")) {
    out(JSON.stringify(report, null, 2));
    return 0;
  }
  for (const line of reportLines(report, lang)) out(line);
  if (report.agents.length && !rest.includes("--no-card")) {
    const file = resolve(opt("--out") ?? "agent-check.html");
    writeFileSync(file, reportHtml(report, lang));
    out("");
    out(lang === "he" ? `הכרטיס: ${file}` : `The card: ${file}`);
  }
  return 0;
}

/** Read a .ndc's structure and say whom it opens for. Uses no key, so it can be run on any sealed file. */
function inspectSeal(file: string, out: (line: string) => void): number {
  let manifest: NdcManifest;
  try {
    manifest = JSON.parse(readFileSync(file, "utf8")) as NdcManifest;
  } catch (err) {
    out(`FAIL: cannot read ${file} as JSON (${(err as Error).message})`);
    return 1;
  }
  const r = inspectNdc(manifest);
  for (const f of r.facts) out(`  ${f}`);
  for (const p of r.problems) out(`FAIL  ${p}`);
  out(r.ok ? "PASS: a well-formed seal v3 file (SEAL-FORMAT.md)" : `FAIL: not a well-formed seal v3 file (${r.problems.length} problem(s))`);
  return r.ok ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
