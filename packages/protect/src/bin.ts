#!/usr/bin/env node
// The verification layer's one command. Every subcommand checks a claim NoData
// makes, offline, with what ships in this package; none of them runs NoData.
// One checks your AI agent instead of NoData, from the agent's own history:
//
//   npx @nodatachat/protect@3 agent-check [--days N] [--lang he] [--accept-terms]
//                                                   what Claude Code / Codex did on this
//                                                   computer: counts only, nothing sent.
//                                                   Asks you to agree to its terms first.
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
//   npx @nodatachat/protect@3 verify-released pack.json --receipt <id> --received response.json
//                                                   what an AI agent received is what the signed
//                                                   receipt released, and what it withheld

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { localSalt } from "./agent-events";
import { checkAgents, localEvents } from "./agent-history";
import { reportHtml, reportLines, type Lang } from "./agent-history-report";
import { acceptedByFlagLine, declinedLine, hasAgreed, isYes, noTerminalLines, recordAgreement, termsFile, termsLines, termsQuestion } from "./agent-terms";
import { runCheckVectors } from "./check-vectors";
import { checkOrigin, contextEras, loadPinnedKeys, NODATA_KEYS_PATH } from "./pinned-keys";
import { inspectNdc, type NdcManifest } from "./seal-v3";
import { verifyApprovalInPack, verifyBothSides, verifyRelayReceipt, verifyReleasedInPack } from "./verify-fabric";
import { verifyPack, type CheckResult, type EvidencePack } from "./verify-pack";

const USAGE =
  "usage: protect agent-check [--days N] [--lang he] [--accept-terms] | protect check-vectors | protect verify-pack <pack.json> [--keys <keys.json>] | protect inspect-seal <file.ndc>" +
  " | protect verify-relay-receipt <receipt.json> [--opened <file>] [--approval <receiver-pack.json>] | protect verify-both-sides <a-pack.json> <b-pack.json> --blob <id>" +
  " | protect verify-released <pack.json> --receipt <id> --received <response.json>";

/** What agent-check needs from the outside world, so a test can stand in for it. */
export interface AgentCheckIo {
  /** The home whose agent history is read, and where the agreement is kept. */
  home: string;
  /** Can a person answer here? Without one, never wait for an answer. */
  isTTY: boolean;
  /** Ask one question and return the answer ("" when input closes). */
  ask: (question: string, toStderr: boolean) => Promise<string>;
  /** stderr: the terms for --json / --events, so stdout stays clean. */
  err: (line: string) => void;
}

const defaultIo = (): AgentCheckIo => ({
  home: homedir(),
  isTTY: process.stdin.isTTY === true,
  ask: askLine,
  err: (l) => process.stderr.write(`${l}\n`),
});

export async function main(argv: string[], out: (line: string) => void = (l) => process.stdout.write(`${l}\n`), io: Partial<AgentCheckIo> = {}): Promise<number> {
  const [cmd, file, flag, keysFile] = argv;
  if (cmd === "agent-check") return agentCheck(argv.slice(1), out, { ...defaultIo(), ...io });
  if (cmd === "check-vectors" || cmd === undefined) return runCheckVectors(out);
  if (cmd === "inspect-seal" && file && flag === undefined) return inspectSeal(file, out);
  if (cmd === "verify-relay-receipt" && file) {
    const opts = flags(argv.slice(2), ["--opened", "--approval"]);
    if (opts) return relayReceipt(file, opts["--opened"], opts["--approval"], out);
  }
  if (cmd === "verify-released" && file) {
    const opts = flags(argv.slice(2), ["--receipt", "--received"]);
    if (opts && opts["--receipt"] && opts["--received"]) return released(file, opts["--receipt"], opts["--received"], out);
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

/** What an AI agent received, against the organisation's signed release receipt. */
async function released(packFile: string, receiptId: string, receivedFile: string, out: (line: string) => void): Promise<number> {
  const pack = readJson(packFile, out) as EvidencePack | undefined;
  const received = readJson(receivedFile, out);
  if (!pack || received === undefined) return 1;
  return report(await verifyReleasedInPack(pack, receiptId, received, loadPinnedKeys()), `release ${receiptId}`, out);
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
 *   agent-check [--days N] [--lang he|en] [--out file.html] [--no-card] [--json] [--events] [--accept-terms]
 *   --events prints the LOCAL report (one finding per line, with where); nothing else carries it.
 * Before the first read, the terms (agent-terms.ts): agreed once per terms version.
 */
async function agentCheck(rest: string[], out: (line: string) => void, io: AgentCheckIo): Promise<number> {
  const opt = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const days = Math.min(Math.max(Number(opt("--days") ?? 30) || 30, 1), 3650);
  const lang: Lang = opt("--lang") === "he" ? "he" : "en";
  const machine = rest.includes("--events") || rest.includes("--json");
  // The agreement comes before anything is read: no history, no salt, no card.
  const agreed = await agreeToTerms(rest.includes("--accept-terms"), lang, machine ? io.err : out, io);
  if (agreed !== true) return agreed;
  if (rest.includes("--events")) {
    // The LOCAL report: one event per finding, with where. For this computer only: it is
    // printed here and written nowhere else, and the card never carries any of it.
    for (const e of localEvents(days, localSalt(join(io.home, ".agent-check", "salt")), io.home)) out(JSON.stringify(e));
    return 0;
  }
  const report = checkAgents(days, io.home);
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

/**
 * true to go on, or the exit code. Agreed already (this terms version) → true, silently.
 * --accept-terms → kept, true. No terminal → one line, exit 2, no wait. Otherwise the
 * terms and one question: y / yes goes on, anything else exits 0 having read nothing.
 */
async function agreeToTerms(byFlag: boolean, lang: Lang, say: (line: string) => void, io: AgentCheckIo): Promise<true | number> {
  const file = termsFile(io.home);
  if (hasAgreed(file)) return true;
  if (byFlag) {
    for (const line of termsLines(lang)) say(line);
    say(acceptedByFlagLine(lang));
    say("");
    recordAgreement(file);
    return true;
  }
  if (!io.isTTY) {
    for (const line of noTerminalLines(lang)) io.err(line);
    return 2;
  }
  for (const line of termsLines(lang)) say(line);
  const answer = await io.ask(termsQuestion(lang), say === io.err);
  if (!isYes(answer)) {
    say(declinedLine(lang));
    return 0;
  }
  recordAgreement(file);
  say("");
  return true;
}

/** One line from the terminal; "" when input closes (Ctrl-D) rather than waiting forever. */
function askLine(question: string, toStderr: boolean): Promise<string> {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: toStderr ? process.stderr : process.stdout });
    let answered = false;
    rl.on("close", () => {
      if (!answered) done("");
    });
    rl.question(question, (a) => {
      answered = true;
      rl.close();
      done(a);
    });
  });
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

/**
 * A reader that stops early (`agent-check --events | head`) closes the pipe: that is
 * the reader's choice, not a failure, so exit quietly instead of printing a stack.
 */
export function quietOnClosedPipe(stream: NodeJS.EventEmitter, exit: (code: number) => void = (c) => process.exit(c)): void {
  stream.on("error", (err: NodeJS.ErrnoException) => {
    if (err && err.code === "EPIPE") return exit(0);
    throw err;
  });
}

if (require.main === module) {
  quietOnClosedPipe(process.stdout);
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
