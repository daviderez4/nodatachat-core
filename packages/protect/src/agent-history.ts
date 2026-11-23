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
import {
  AGENT_RULES_VERSION,
  OUTBOUND_DATA,
  RECORD_FILE,
  SEARCHES,
  STAGE_SPLIT,
  countSecrets,
  credentialPrintIn,
  grepSearchesBySecretName,
  isKeyFile,
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
        calls.set(b.id, { agent: "claude-code", at, categories: classify(String(b.name ?? ""), input), ok: null, exposed: 0 });
      } else if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
        const c = calls.get(b.tool_use_id);
        if (!c) continue;
        c.ok = b.is_error !== true;
        c.exposed = countSecretValues(textOf(b.content));
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
      calls.set(id, { agent: "codex", at, categories: classify("shell", { command }), ok: null, exposed: 0 });
    } else if ((p.type === "custom_tool_call_output" || p.type === "function_call_output") && id) {
      const c = calls.get(id);
      if (c) c.exposed = countSecretValues(typeof p.output === "string" ? p.output : textOf(p.output));
    }
  }
  return [...calls.values()];
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
  for (const c of inWindow) {
    exposedTotal += c.exposed;
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
  return { from, to, days, agents, calls: inWindow.length, categories, exposedTotal, gateInstalled, rulesVersion: AGENT_RULES_VERSION };
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
  return buildReport(calls, { "claude-code": claude.length, codex: codex.length }, days, now, gateInstalled);
}
