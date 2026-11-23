// The public event format, version 1: what an AI agent did, as a REPORT.
// Part of @nodatachat/protect (Apache-2.0).
//
// WHAT THIS IS
//   A display and reporting format. It says what happened and where. It never says
//   how anything was decided. NoData's read gate does not read it and does not decide
//   by it; NoData's own event model, policy, evidence chain and correlation are not
//   here and do not depend on it.
//
// TWO VIEWS, TWO PRIVACY LEVELS
//   The local report (this computer only): one event per finding, to the minute, with
//   the exact rule name and the location (path, line, fingerprint).
//   The shareable card: counts per category over a window of days. No time, no path,
//   no line, no fingerprint, no rule name. `toCard` is the only way from events to a
//   card, and it keeps none of those fields.
//
// EXPOSURE IS CONSERVATIVE
//   yes      a key-shaped value was found in what came back to the agent (evidence)
//   no       nothing came back: the call failed, or the gate stopped it
//   unknown  everything else, including a successful read where no key pattern was
//            found: a password with no known shape may still have been there
//
// THE FINGERPRINT
//   Derived from the location only (path, line, rule) with a salt kept on this
//   computer. Never from a value. The salt is not in any event, export or card.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const EVENT_FORMAT_VERSION = 1 as const;

export type EventSource = "agent-history" | "gate-log" | "scanner";
export type EventAgent = "claude-code" | "codex" | "other";
export type EventAction = "read" | "write" | "execute" | "network" | "search";
/** General categories only: no subtype, no detection confidence. */
export type EventCategory =
  | "credential_file"
  | "credential_command"
  | "secret_search"
  | "data_file"
  | "outbound_data"
  | "provider_key"
  | "personal_data";
export type EventOutcome = "succeeded" | "failed" | "not_recorded";
export type Exposure = "yes" | "no" | "unknown";
export type GateResult = "stopped" | "asked" | "allowed" | "not_installed" | "unknown";

export interface EventLocation {
  path: string;
  line: number | null;
  fingerprint: string;
}

/** One finding, as the LOCAL report holds it. Never leaves this computer. */
export interface AgentEvent {
  v: typeof EVENT_FORMAT_VERSION;
  source: EventSource;
  agent: EventAgent;
  /** To the minute (YYYY-MM-DDTHH:MM, UTC). */
  at: string;
  action: EventAction;
  category: EventCategory;
  outcome: EventOutcome;
  exposed: Exposure;
  /** From a test, a fixture, an example, or what the agent wrote itself. */
  sample: boolean;
  gate: GateResult;
  /** The exact public rule name, or "nodata-detector" for a rule that is not public. Local report only. */
  rule: string;
  /** Local report only. */
  location: EventLocation | null;
}

/** The decision of exposure, from evidence only. */
export function exposure(e: { outcome: EventOutcome; keyFound: boolean; gate: GateResult }): Exposure {
  if (e.keyFound) return "yes";
  if (e.outcome === "failed" || e.gate === "stopped") return "no";
  return "unknown";
}

/** Minute precision, UTC. */
export function toMinute(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16) : "";
}

// ── The fingerprint and its salt ─────────────────────────────────────────

/** Where the salt lives: this computer, outside any project. */
export const SALT_FILE = join(homedir(), ".agent-check", "salt");

/** The local salt, made once. Never part of an event, a card or an export. */
export function localSalt(file = SALT_FILE): string {
  try {
    if (existsSync(file)) {
      const s = readFileSync(file, "utf8").trim();
      if (/^[0-9a-f]{64}$/.test(s)) return s;
    }
    mkdirSync(dirname(file), { recursive: true });
    const s = randomBytes(32).toString("hex");
    writeFileSync(file, s, { mode: 0o600 });
    return s;
  } catch {
    // No place to keep it: a salt for this run only. Fingerprints then differ between runs.
    return randomBytes(32).toString("hex");
  }
}

/** From the location only: path, line, rule. Never from a value. */
export function fingerprint(salt: string, path: string, line: number | null, rule: string): string {
  return createHash("sha256").update(`${salt}\0${path}\0${line ?? ""}\0${rule}`).digest("hex").slice(0, 8);
}

// ── The shareable card ───────────────────────────────────────────────────

export interface CardRow {
  category: EventCategory;
  tried: number;
  succeeded: number | null;
  /** Evidence that a value came back. */
  exposed: number;
  /** Set apart as samples; never in `exposed`. */
  samples: number;
}

export interface Card {
  v: typeof EVENT_FORMAT_VERSION;
  source: EventSource;
  /** The window, in days only (YYYY-MM-DD). */
  from: string;
  to: string;
  rows: CardRow[];
}

/**
 * Events → the shareable card. Counts per category and a window in days. Nothing
 * else of an event survives: no time of day, no path, no line, no fingerprint, no rule.
 */
export function toCard(events: AgentEvent[], source: EventSource): Card {
  const by = new Map<EventCategory, CardRow>();
  let from = "";
  let to = "";
  for (const e of events) {
    if (e.source !== source) continue;
    const day = e.at.slice(0, 10);
    if (day && (!from || day < from)) from = day;
    if (day && day > to) to = day;
    const r = by.get(e.category) ?? { category: e.category, tried: 0, succeeded: null, exposed: 0, samples: 0 };
    r.tried += 1;
    if (e.outcome !== "not_recorded") r.succeeded = (r.succeeded ?? 0) + (e.outcome === "succeeded" ? 1 : 0);
    if (e.exposed === "yes") {
      if (e.sample) r.samples += 1;
      else r.exposed += 1;
    }
    by.set(e.category, r);
  }
  return { v: EVENT_FORMAT_VERSION, source, from, to, rows: [...by.values()] };
}
