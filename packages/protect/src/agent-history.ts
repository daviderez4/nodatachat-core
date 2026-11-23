// What your AI coding agent did on this computer, from the history it already
// keeps. Part of @nodatachat/protect (Apache-2.0): read it before you run it.
//
//   npx @nodatachat/protect@3 agent-check            the last 30 days
//   npx @nodatachat/protect@3 agent-check --days 90  a longer window
//   npx @nodatachat/protect@3 agent-check --lang he  the report in Hebrew
//
// WHAT IT READS, AND NOTHING ELSE
//   Claude Code: ~/.claude/projects/*/*.jsonl  (every tool call and its result)
//   Codex:       ~/.codex/sessions/**/*.jsonl  (every command and its output)
// Both are files the agents themselves write. Nothing is installed, no account is
// needed, and this module makes no network request (search it: there is no
// fetch, http or socket here).
//
// WHAT IT KEEPS
//   Counts only. A file path, a command or a returned value is looked at in
//   memory to decide its category, then dropped. The report holds numbers and
//   category names; it never holds a path, a command, a file name or a value.
//
// WHAT IT MEASURES, THREE THINGS THAT ARE NOT THE SAME
//   attempted  the agent asked a tool to touch something in a category
//   succeeded  the tool did not report an error (Claude Code records this;
//              Codex does not mark it, so its calls count as attempted only)
//   exposed    a provider key (AWS, GitHub, Stripe, a private key …, the same
//              patterns the gate checks a tool's output with) came back into
//              the agent's context
// An attempt is not an exposure. The report keeps the three apart.
//
// WHAT IT CANNOT PROVE
//   Only what the agents wrote to their own history is seen. A history that was
//   deleted, rotated or never kept is not here, so the report is a floor, not a
//   complete record. The categories are pattern rules; read them below.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { exposure, fingerprint, toMinute, type AgentEvent, type EventAction, type EventCategory, type GateResult } from "./agent-events";
import {
  AGENT_RULES_VERSION,
  OUTBOUND_DATA,
  RECORD_FILE,
  SEARCHES,
  STAGE_SPLIT,
  AGENT_WRITES,
  countSecrets,
  credentialPrintIn,
  grepSearchesBySecretName,
  ENV_FILE,
  isKeyFile,
  isSamplePath,
  searchesBySecretName,
  stageText,
} from "./agent-rules";

export type Agent = "claude-code" | "codex";

/** The categories, in the order the report shows them. */
export const CATEGORIES = ["secret_file", "credential_command", "secret_search", "data_file", "outbound_data"] as const;
export type Category = (typeof CATEGORIES)[number];

// ── The rules live in agent-rules.ts: the same file NoData's read gate imports,
// so a call this report counts and a call the gate looks at are classified by
// one piece of code. Read them there, and argue with them.

/** The words of a command, without quotes: where a file it names would be. */
const words = (command: string) => command.split(/[\s|;&<>()]+/).map((w) => w.replace(/^[@'"`]+|['"`,]+$/g, "")).filter(Boolean);

// ── One tool call, reduced to what the report may hold ───────────────────

export interface ToolCall {
  agent: Agent;
  at: string;
  /** The categories this call touched. Empty when it touched none of them. */
  categories: Category[];
  /** true / false when the history says; null when it does not (Codex). */
  ok: boolean | null;
  /** Secret-looking values that came back into the agent's context. */
  exposed: number;
  /**
   * The same, from a test, a fixture or an example, or from what the agent wrote itself:
   * usually a sample. Counted apart, never in `exposed`, and said on the report.
   */
  samples: number;
  /** Set when the call touched a sample or was the agent's own writing (internal). */
  sampleSource?: boolean;
  /**
   * For the LOCAL report only (agent-events.ts): never in AgentReport, never on the card.
   * The tool, the first path it named, the first key rule found in what came back and on
   * which line, and whether NoData's gate refused it.
   */
  detail?: { tool: string; path: string; keyRule: string; keyLine: number | null; gateStopped: boolean };
}

/** The categories a file path or a command falls in. The text itself is not returned. */
export function classify(tool: string, input: Record<string, unknown>): Category[] {
  const out = new Set<Category>();
  const path = [input.file_path, input.path, input.notebook_path].find((v): v is string => typeof v === "string") ?? "";
  const command = typeof input.command === "string" ? input.command : Array.isArray(input.command) ? input.command.join(" ") : "";
  const named = command ? words(command) : [];
  if ((path && isKeyFile(path)) || named.some(isKeyFile)) out.add("secret_file");
  if (command) {
    const prints = credentialPrintIn("Bash", { command });
    if (prints === "a saved login file") out.add("secret_file");
    else if (prints) out.add("credential_command");
    for (const raw of command.split(STAGE_SPLIT)) {
      const seg = stageText(raw);
      if (SEARCHES.test(seg) && searchesBySecretName(seg)) out.add("secret_search");
    }
    if (OUTBOUND_DATA.test(command)) out.add("outbound_data");
  }
  if (/^(Grep|Search)$/i.test(tool) && grepSearchesBySecretName(input)) out.add("secret_search");
  if ((path && RECORD_FILE.test(path)) || named.some((w) => RECORD_FILE.test(w))) out.add("data_file");
  return CATEGORIES.filter((c) => out.has(c));
}

/** A call whose output is the agent's own writing, or whose paths are all samples (tests, fixtures, examples). */
export function fromSample(tool: string, input: Record<string, unknown>): boolean {
  if (AGENT_WRITES.test(tool)) return true;
  const path = [input.file_path, input.path, input.notebook_path].find((v): v is string => typeof v === "string") ?? "";
  if (path) return isSamplePath(path);
  const command = typeof input.command === "string" ? input.command : Array.isArray(input.command) ? input.command.join(" ") : "";
  const paths = command ? words(command).filter((w) => /[\\/]/.test(w) && /\.[a-z0-9]+$/i.test(w)) : [];
  return paths.length > 0 && paths.every(isSamplePath);
}

/** How many provider keys a tool's output carried (the gate's own patterns). The values are not returned. */
export function countSecretValues(output: string): number {
  return Object.values(countSecrets(output)).reduce((a, n) => a + n, 0);
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => (b && typeof b === "object" && typeof (b as { text?: unknown }).text === "string" ? (b as { text: string }).text : "")).join("\n");
  return "";
}

/** One Claude Code transcript (JSON lines) → its tool calls, results matched by id. */
export function readClaudeTranscript(jsonl: string): ToolCall[] {
  const calls = new Map<string, ToolCall>();
  for (const line of jsonl.split("\n")) {
    if (!line.includes('"tool_')) continue;
    let e: { timestamp?: unknown; message?: { content?: unknown } };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const at = typeof e.timestamp === "string" ? e.timestamp : "";
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content as Array<Record<string, unknown>>) {
      if (b?.type === "tool_use" && typeof b.id === "string") {
        const input = (b.input && typeof b.input === "object" ? b.input : {}) as Record<string, unknown>;
        const tool = String(b.name ?? "");
        calls.set(b.id, { agent: "claude-code", at, categories: classify(tool, input), ok: null, exposed: 0, samples: 0, sampleSource: fromSample(tool, input), detail: { tool, path: firstPath(input), keyRule: "", keyLine: null, gateStopped: false } });
      } else if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
        const c = calls.get(b.tool_use_id);
        if (!c) continue;
        c.ok = b.is_error !== true;
        if (!c.at) c.at = at;
        const out = textOf(b.content);
        const n = countSecretValues(out);
        if (c.sampleSource) c.samples = n;
        else c.exposed = n;
        if (c.detail) {
          c.detail.gateStopped = b.is_error === true && /hook (?:error|blocking)[\s\S]{0,80}NoData|NoData (?:refused|חסם)/i.test(out.slice(0, 600));
          if (n) Object.assign(c.detail, firstKey(out));
        }
      }
    }
  }
  return [...calls.values()];
}

/** One Codex session (JSON lines) → its commands, outputs matched by call id. */
export function readCodexSession(jsonl: string): ToolCall[] {
  const calls = new Map<string, ToolCall>();
  for (const line of jsonl.split("\n")) {
    if (!line.includes("_call")) continue;
    let e: { timestamp?: unknown; payload?: Record<string, unknown> };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const p = e.payload;
    if (!p || typeof p !== "object") continue;
    const at = typeof e.timestamp === "string" ? e.timestamp : "";
    const id = typeof p.call_id === "string" ? p.call_id : "";
    if ((p.type === "custom_tool_call" || p.type === "function_call" || p.type === "local_shell_call") && id) {
      let command = "";
      const raw = p.input ?? p.arguments ?? (p.action as { command?: unknown } | undefined)?.command;
      if (typeof raw === "string") {
        try {
          const j = JSON.parse(raw) as { command?: unknown; cmd?: unknown };
          command = Array.isArray(j.command) ? j.command.join(" ") : String(j.command ?? j.cmd ?? raw);
        } catch {
          command = raw;
        }
      } else if (Array.isArray(raw)) command = raw.join(" ");
      calls.set(id, { agent: "codex", at, categories: classify("shell", { command }), ok: null, exposed: 0, samples: 0, sampleSource: fromSample("shell", { command }), detail: { tool: "shell", path: firstPath({ command }), keyRule: "", keyLine: null, gateStopped: false } });
    } else if ((p.type === "custom_tool_call_output" || p.type === "function_call_output") && id) {
      const c = calls.get(id);
      if (c) {
        const out = typeof p.output === "string" ? p.output : textOf(p.output);
        const n = countSecretValues(out);
        if (c.sampleSource) c.samples = n;
        else c.exposed = n;
        if (n && c.detail) Object.assign(c.detail, firstKey(out));
      }
    }
  }
  return [...calls.values()];
}

// ── The local events (agent-events.ts) ───────────────────────────────────

/** The first path a call names: its file, or the first word of its command that looks like a file. */
function firstPath(input: Record<string, unknown>): string {
  const p = [input.file_path, input.path, input.notebook_path].find((v): v is string => typeof v === "string");
  if (p) return p;
  const command = typeof input.command === "string" ? input.command : Array.isArray(input.command) ? input.command.join(" ") : "";
  return (command ? words(command) : []).find((w) => /[\\/]/.test(w) && /[\w.-]\.[a-z0-9]+$|[\\/]\.[\w.-]+$/i.test(w)) ?? "";
}

/**
 * The first key rule found in a tool's output, and the line it is on when the output
 * numbers its lines (Claude Code's Read does: "    41\t…" or "41→…"). The line's text is
 * looked at here and dropped: only the rule id and the number are kept.
 */
function firstKey(out: string): { keyRule: string; keyLine: number | null } {
  const lines = out.slice(0, 2_000_000).split("\n");
  for (const l of lines) {
    const ids = Object.keys(countSecrets(l));
    if (!ids.length) continue;
    const m = /^\s*(\d+)(?:\t|→)/.exec(l);
    return { keyRule: ids[0], keyLine: m ? Number(m[1]) : null };
  }
  const ids = Object.keys(countSecrets(out));
  return { keyRule: ids[0] ?? "", keyLine: null };
}

const EVENT_CATEGORY: Record<Category, EventCategory> = {
  secret_file: "credential_file",
  credential_command: "credential_command",
  secret_search: "secret_search",
  data_file: "data_file",
  outbound_data: "outbound_data",
};

/** The public name of the rule behind a category (agent-rules.ts names them all). */
function categoryRule(c: Category, path: string): string {
  if (c === "secret_file") return ENV_FILE.test(path.replace(/\\/g, "/").split("/").pop() ?? "") ? "env-file" : "credential-store";
  return ({ credential_command: "credential-command", secret_search: "secret-search", data_file: "record-file", outbound_data: "outbound-data" } as const)[c];
}

function actionOf(tool: string, cats: Category[]): EventAction {
  if (/^(Write|Edit|MultiEdit|NotebookEdit|apply_patch)$/.test(tool)) return "write";
  if (/^(Grep|Glob|Search)$/i.test(tool) || cats.includes("secret_search")) return "search";
  if (/^(WebFetch|WebSearch)$/.test(tool) || cats.includes("outbound_data")) return "network";
  if (/^(Read|NotebookRead)$/.test(tool)) return "read";
  return "execute";
}

/**
 * Calls → LOCAL events: one per category a call touched, and one for a key found in a
 * call that touched none. Never handed to the card; the card is built from counts.
 */
export function toEvents(calls: ToolCall[], opts: { gateInstalled: boolean; salt: string }): AgentEvent[] {
  const out: AgentEvent[] = [];
  for (const c of calls) {
    const d = c.detail;
    if (!d) continue;
    const keyFound = c.exposed + c.samples > 0;
    const cats: Array<{ category: EventCategory; rule: string }> = c.categories.map((k) => ({ category: EVENT_CATEGORY[k], rule: keyFound && d.keyRule ? d.keyRule : categoryRule(k, d.path) }));
    if (!cats.length && keyFound) cats.push({ category: "provider_key", rule: d.keyRule || "nodata-detector" });
    if (!cats.length) continue;
    const outcome = c.ok === null ? "not_recorded" : c.ok ? "succeeded" : "failed";
    const gate: GateResult = d.gateStopped ? "stopped" : opts.gateInstalled ? "unknown" : "not_installed";
    for (const { category, rule } of cats) {
      out.push({
        v: 1,
        source: "agent-history",
        agent: c.agent,
        at: toMinute(c.at),
        action: actionOf(d.tool, c.categories),
        category,
        outcome,
        exposed: exposure({ outcome, keyFound, gate }),
        sample: c.samples > 0 || (!!c.sampleSource && keyFound),
        gate,
        rule,
        location: d.path ? { path: d.path, line: keyFound ? d.keyLine : null, fingerprint: fingerprint(opts.salt, d.path, keyFound ? d.keyLine : null, rule) } : null,
      });
    }
  }
  return out;
}

// ── The report ───────────────────────────────────────────────────────────

export interface CategoryCount {
  attempted: number;
  /** null when no call in this category had a recorded outcome. */
  succeeded: number | null;
  exposed: number;
}

export interface AgentReport {
  from: string;
  to: string;
  days: number;
  agents: Array<{ agent: Agent; files: number; calls: number }>;
  calls: number;
  categories: Record<Category, CategoryCount>;
  /** Secret-looking values returned to the agent, over every call, in any category. */
  exposedTotal: number;
  /** Key-shaped values from tests, fixtures, examples or the agent's own writing: set apart, usually samples. */
  samplesSetApart: number;
  /**
   * Whether a NoData read gate is installed here (its log file exists; only its
   * existence is checked, it is not read). With a gate, calls it refused show in
   * the history as failed tool calls, and its own record is the agent card.
   */
  gateInstalled: boolean;
  /** Which version of the shared rules (agent-rules.ts) produced these numbers. */
  rulesVersion: string;
}

export function buildReport(calls: ToolCall[], files: Record<Agent, number>, days: number, now = Date.now(), gateInstalled = false): AgentReport {
  const since = now - days * 86_400_000;
  const inWindow = calls.filter((c) => !c.at || Date.parse(c.at) >= since);
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, { attempted: 0, succeeded: null, exposed: 0 } as CategoryCount])) as Record<Category, CategoryCount>;
  let from = "";
  let to = "";
  let exposedTotal = 0;
  let samplesSetApart = 0;
  for (const c of inWindow) {
    exposedTotal += c.exposed;
    samplesSetApart += c.samples;
    if (c.at && (!from || c.at < from)) from = c.at;
    if (c.at && c.at > to) to = c.at;
    for (const k of c.categories) {
      const r = categories[k];
      r.attempted += 1;
      if (c.ok !== null) r.succeeded = (r.succeeded ?? 0) + (c.ok ? 1 : 0);
      r.exposed += c.exposed;
    }
  }
  const agents = (["claude-code", "codex"] as Agent[])
    .map((agent) => ({ agent, files: files[agent] ?? 0, calls: inWindow.filter((c) => c.agent === agent).length }))
    .filter((a) => a.files > 0);
  // Days only: the time of day stays in the local events (agent-events.ts), never in the report.
  return { from: from.slice(0, 10), to: to.slice(0, 10), days, agents, calls: inWindow.length, categories, exposedTotal, samplesSetApart, gateInstalled, rulesVersion: AGENT_RULES_VERSION };
}

// ── Reading the history from disk ────────────────────────────────────────

function jsonlFiles(dir: string, depth: number, out: string[] = []): string[] {
  if (depth < 0 || !existsSync(dir)) return out;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    const p = join(dir, n);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) jsonlFiles(p, depth - 1, out);
    else if (n.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

/** Read both agents' histories under `home` and build the report. Only these two folders are read. */
export function checkAgents(days: number, home = homedir(), now = Date.now()): AgentReport {
  return collect(days, home, now).report;
}

/**
 * The LOCAL events behind the report: one per finding, to the minute, with the exact
 * rule and the location. For this computer only (agent-events.ts); never on the card.
 */
export function localEvents(days: number, salt: string, home = homedir(), now = Date.now()): AgentEvent[] {
  const { calls, report } = collect(days, home, now);
  const since = now - days * 86_400_000;
  return toEvents(calls.filter((c) => !c.at || Date.parse(c.at) >= since), { gateInstalled: report.gateInstalled, salt });
}

function collect(days: number, home: string, now: number): { calls: ToolCall[]; report: AgentReport } {
  const since = now - days * 86_400_000;
  const recent = (f: string) => {
    try {
      return statSync(f).mtimeMs >= since;
    } catch {
      return false;
    }
  };
  const claude = jsonlFiles(join(home, ".claude", "projects"), 2).filter(recent);
  const codex = jsonlFiles(join(home, ".codex", "sessions"), 5).filter(recent);
  const calls: ToolCall[] = [];
  for (const f of claude) calls.push(...readClaudeTranscript(readFileSync(f, "utf8")));
  for (const f of codex) calls.push(...readCodexSession(readFileSync(f, "utf8")));
  const gateInstalled = existsSync(join(home, ".nodata", "gate.log"));
  return { calls, report: buildReport(calls, { "claude-code": claude.length, codex: codex.length }, days, now, gateInstalled) };
}
