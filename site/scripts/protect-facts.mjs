// Every fact the site shows about @nodatachat/protect comes from this repository,
// read at build time. Nothing about the tool is typed by hand into a page.
//
//   - The version, the Node engine and the CLI flags: packages/protect/package.json and src/bin.ts.
//   - The categories: CATEGORIES in src/agent-history.ts.
//   - The changelog: the versioned headings of packages/protect/README.md.
//   - The lab: every scenario's log goes through the real readers and the real
//     toEvents() / exposure(), compiled from src/ for this build. The page shows
//     what the code decided. If a scenario's expected decision differs from what
//     the code decides, the build fails, so the prose can never drift from the rules.
//
// Output: generated/facts.json (git-ignored, rebuilt on every build).

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROTECT = join(SITE, "..", "packages", "protect");
const CACHE = join(SITE, ".cache", "protect");
const OUT = join(SITE, "generated");

const fail = (msg) => {
  console.error(`protect-facts: ${msg}`);
  process.exit(1);
};

// ── Compile the modules the site runs, as they are in src/ ─────────────────
// Start from the entry points and follow every local import, so a module a new
// release adds (3.9.0 added measured.ts) is compiled without anyone listing it.
const ENTRY = ["agent-events", "agent-rules", "agent-history", "agent-history-report"];
mkdirSync(CACHE, { recursive: true });
const done = new Set();
const queue = [...ENTRY];
while (queue.length) {
  const m = queue.shift();
  if (done.has(m)) continue;
  done.add(m);
  const src = readFileSync(join(PROTECT, "src", `${m}.ts`), "utf8");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  // Local imports are extensionless in src/; point them at the compiled siblings, and compile those too.
  for (const [, dep] of outputText.matchAll(/require\("\.\/([\w-]+)"\)/g)) queue.push(dep);
  writeFileSync(join(CACHE, `${m}.cjs`), outputText.replace(/require\("\.\/([\w-]+)"\)/g, 'require("./$1.cjs")'));
}
const require = createRequire(import.meta.url);
const history = require(join(CACHE, "agent-history.cjs"));
const events = require(join(CACHE, "agent-events.cjs"));
const report = require(join(CACHE, "agent-history-report.cjs"));
if (typeof history.toEvents !== "function" || typeof events.exposure !== "function") fail("toEvents / exposure not found in src/");

// ── Package facts ────────────────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(join(PROTECT, "package.json"), "utf8"));
const bin = readFileSync(join(PROTECT, "src", "bin.ts"), "utf8");
const FLAGS = ["--days", "--lang", "--events", "--json", "--out", "--no-card"];
for (const f of FLAGS) if (!bin.includes(f)) fail(`the site documents ${f}, and src/bin.ts no longer has it`);

// The category names the CLI prints, read from the report's own LABEL table.
const reportSrc = readFileSync(join(PROTECT, "src", "agent-history-report.ts"), "utf8");
const labels = {};
for (const c of history.CATEGORIES) {
  const m = new RegExp(`\\b${c}:\\s*\\{\\s*en:\\s*"([^"]+)"`).exec(reportSrc);
  if (!m) fail(`no English label for ${c} in agent-history-report.ts`);
  labels[c] = m[1];
}
if (typeof report.CHECK_COMMAND !== "string") fail("CHECK_COMMAND not found in agent-history-report.ts");

// ── The copy file: words only, never facts ─────────────────────────────────
// content/copy.json is meant to be edited by hand. It may name facts only through
// {tokens} (filled from this file's output), so it is refused if it types a version,
// a command or the package, links to a key that does not exist, or documents a flag
// the CLI does not have (or a number the CLI does not use).
{
  const copy = JSON.parse(readFileSync(join(SITE, "content", "copy.json"), "utf8"));
  const linksSrc = readFileSync(join(SITE, "lib", "links.ts"), "utf8");
  const linkBlock = /export const links = \{([\s\S]*?)\n\};/.exec(linksSrc)?.[1] ?? "";
  const LINK_KEYS = new Set([...linkBlock.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]));
  const TOKENS = new Set(["package", "version", "license", "node", "labCount", "calls", "samples", "latest"]);
  const strings = [];
  const walk = (v, path) => {
    if (typeof v === "string") strings.push([path, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "_readme") walk(x, path ? `${path}.${k}` : k);
  };
  walk(copy, "");
  for (const [path, s] of strings) {
    if (/\d+\.\d+\.\d+/.test(s)) fail(`copy.json ${path} types a version ("${s}"). Versions come from the code: use the page, not the copy.`);
    if (/\bnpx\s+[@-]|@nodatachat\//.test(s)) fail(`copy.json ${path} types a command or the package. Use {package}; commands come from the code.`);
    for (const [, k] of s.matchAll(/\{(\w+)\}/g)) if (!TOKENS.has(k)) fail(`copy.json ${path}: unknown token {${k}}. Known: ${[...TOKENS].join(", ")}`);
    for (const [, target] of s.matchAll(/\]\(([^)]+)\)/g)) {
      if (target.startsWith("/")) {
        const page = target === "/" ? "app/page.tsx" : `app${target.replace(/\/$/, "")}/page.tsx`;
        if (!existsSync(join(SITE, page))) fail(`copy.json ${path} links to ${target}, and there is no such page`);
      } else if (!LINK_KEYS.has(target)) fail(`copy.json ${path} links to "${target}", which is not a key in lib/links.ts`);
    }
  }
  const flagCopy = copy.home?.developers?.flags ?? {};
  for (const f of FLAGS) if (!flagCopy[f]) fail(`copy.json home.developers.flags has no description for ${f}`);
  for (const [f, text] of Object.entries(flagCopy)) {
    if (!FLAGS.includes(f)) fail(`copy.json documents ${f}, which the site does not list (and may not exist)`);
    for (const [n] of text.matchAll(/\d+/g)) if (!bin.includes(n)) fail(`copy.json describes ${f} with the number ${n}, which src/bin.ts does not use`);
    for (const [file] of text.matchAll(/[\w-]+\.html/g)) if (!bin.includes(file)) fail(`copy.json describes ${f} with ${file}, which src/bin.ts does not name`);
  }
}

// What npm serves today. The source can be ahead of npm: a release waits for a person's
// 2FA approval. People run what npm serves, so the site must not show a version they cannot get.
let npmLatest = null;
try {
  npmLatest = execFileSync("npm", ["view", pkg.name, "dist-tags.latest"], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
} catch {
  // Unreachable registry: the pages say only what the source is, never claim a published version.
}

const readme = readFileSync(join(PROTECT, "README.md"), "utf8");
const changelog = [];
for (const line of readme.split("\n")) {
  const m = /^#{2,3}\s+(.+?)\s*\(([^)]*?(\d+\.\d+\.\d+)[^)]*)\)\s*$/.exec(line);
  if (m) changelog.push({ version: m[3], title: m[1].replace(/^"|"$/g, ""), note: m[2] });
}
const byVersion = (a, b) => b.version.localeCompare(a.version, undefined, { numeric: true });
changelog.sort(byVersion);
if (!changelog.length) fail("no versioned headings found in packages/protect/README.md");

// ── The lab: run each scenario through the real code ────────────────────────
// A provider-key-shaped value, built here so no key-shaped literal sits in the repo.
const KEY = ["sk", "live", "x".repeat(24)].join("_");
const REDACTED = "sk_live_••••••••";
const scenarios = JSON.parse(readFileSync(join(SITE, "content", "scenarios.json"), "utf8"));
const salt = "0".repeat(64);
const lab = [];
const allCalls = [];
const redact = (t) => String(t).replaceAll(KEY, REDACTED);
for (const s of scenarios) {
  const lines = s.log.map((l) => JSON.stringify(l).replaceAll("{{KEY}}", KEY));
  const jsonl = lines.join("\n");
  const calls = s.agent === "codex" ? history.readCodexSession(jsonl) : history.readClaudeTranscript(jsonl);
  allCalls.push(...calls);
  // What was asked and what came back, as the two log lines hold them.
  const [use, result] = s.log;
  const req = s.agent === "codex" ? use.payload : use.message.content[0];
  const res = s.agent === "codex" ? result.payload : result.message.content[0];
  const io = {
    request: s.agent === "codex" ? `${req.name} ${req.arguments}` : `${req.name} ${JSON.stringify(req.input)}`,
    returned: redact(String(s.agent === "codex" ? res.output : res.content).replaceAll("{{KEY}}", KEY)),
    toolError: s.agent === "codex" ? null : res.is_error === true,
  };
  const evs = history.toEvents(calls, { gateInstalled: false, salt });
  // One call can touch several categories; each is its own event. No event = outside every rule.
  const got = evs.map((e) => ({ category: e.category, outcome: e.outcome, exposed: e.exposed, sample: e.sample }));
  const want = s.expect.map((e) => ({ category: e.category, outcome: e.outcome, exposed: e.exposed, sample: !!e.sample }));
  if (JSON.stringify(want) !== JSON.stringify(got)) fail(`scenario "${s.id}": the page says ${JSON.stringify(want)}, the code decides ${JSON.stringify(got)}`);
  const { log, expect, ...rest } = s;
  lab.push({ ...rest, ...io, decided: got, logDisplay: lines.map(redact) });
}

// The Agentic Web: what agent-check records for each call of each scenario, decided by the code.
// These scenarios are mostly about what the check does NOT record; the build holds the page to
// that too, so the day a rule starts counting one of these calls, the page has to say so.
const web = JSON.parse(readFileSync(join(SITE, "content", "agentic-web.json"), "utf8"));
const agenticWeb = [];
for (const s of web) {
  const lines = s.log.map((l) => JSON.stringify(l));
  const calls = history.readClaudeTranscript(lines.join("\n"));
  if (calls.length !== s.calls.length) fail(`agentic-web "${s.id}": ${s.calls.length} calls on the page, ${calls.length} in the log`);
  const perCall = calls.map((c, i) => {
    const got = history.toEvents([c], { gateInstalled: false, salt }).map((e) => ({ category: e.category, outcome: e.outcome, exposed: e.exposed }));
    const want = s.calls[i].expect.map((e) => ({ category: e.category, outcome: e.outcome, exposed: e.exposed }));
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`agentic-web "${s.id}" call ${i + 1}: the page says ${JSON.stringify(want)}, the code decides ${JSON.stringify(got)}`);
    return { label: s.calls[i].label, decided: got };
  });
  const { log, calls: _c, ...rest } = s;
  agenticWeb.push({ ...rest, calls: perCall, logDisplay: lines });
}

// The code that decides, as it stands in src/, with its real line numbers.
const srcLines = (file) => readFileSync(join(PROTECT, "src", file), "utf8").split("\n");
const evLines = srcLines("agent-events.ts");
const exStart = evLines.findIndex((l) => l.startsWith("export function exposure("));
const exEnd = evLines.findIndex((l, i) => i > exStart && l === "}");
if (exStart < 0 || exEnd < 0) fail("exposure() not found in agent-events.ts");
const hiLines = srcLines("agent-history.ts");
const pick = (needle) => {
  const i = hiLines.findIndex((l) => l.includes(needle));
  if (i < 0) fail(`"${needle}" not found in agent-history.ts`);
  return { no: i + 1, text: hiLines[i].trim() };
};
const code = {
  toEvents: { file: "agent-history.ts", lines: [pick("const keyFound ="), pick('cats.push({ category: "provider_key"'), pick("if (!cats.length) continue;")] },
  exposure: { file: "agent-events.ts", lines: evLines.slice(exStart, exEnd + 1).map((text, k) => ({ no: exStart + k + 1, text })) },
};

// The demo session as a whole, through the real report and its real text output.
const sessionReport = history.buildReport(allCalls, { "claude-code": 1, codex: 1 }, 30, Date.parse("2026-11-21T00:00:00Z"));
const sessionLines = report.reportLines(sessionReport, "en").map(redact);
const sessionEvents = history.toEvents(allCalls, { gateInstalled: false, salt });
const tally = { calls: allCalls.length, events: sessionEvents.length, succeeded: 0, yes: 0, no: 0, unknown: 0, samples: 0 };
for (const e of sessionEvents) {
  tally[e.exposed] += 1;
  if (e.outcome === "succeeded") tally.succeeded += 1;
  if (e.sample) tally.samples += 1;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, "facts.json"),
  JSON.stringify(
    {
      package: pkg.name,
      version: pkg.version,
      npmLatest,
      license: pkg.license,
      node: pkg.engines?.node ?? "",
      checkCommand: report.CHECK_COMMAND,
      categories: [...history.CATEGORIES],
      labels,
      flags: FLAGS,
      changelog,
      lab,
      session: { report: sessionReport, lines: sessionLines, tally },
      code,
      agenticWeb,
    },
    null,
    2,
  ) + "\n",
);
console.log(`protect-facts: ${pkg.name}@${pkg.version}, ${lab.length} scenarios decided by the code, ${changelog.length} changelog entries`);
