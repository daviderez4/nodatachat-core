// Typed access to generated/facts.json, which scripts/protect-facts.mjs builds from
// packages/protect on every build. Pages read the tool's facts only from here.
import raw from "@/generated/facts.json";

export type Exposure = "yes" | "no" | "unknown";
export type Outcome = "succeeded" | "failed" | "not_recorded";

export interface DecidedEvent {
  category: string;
  outcome: Outcome;
  exposed: Exposure;
  sample: boolean;
}

export interface Scenario {
  id: string;
  agent: "claude-code" | "codex";
  node: "files" | "creds" | "tools" | "shell" | "out";
  call: string;
  title: string;
  question: string;
  steps: Array<{ evidence: string; limit: string }>;
  note: string;
  limits: string[];
  request: string;
  returned: string;
  toolError: boolean | null;
  decided: DecidedEvent[];
  logDisplay: string[];
}

export interface WebScenario {
  id: string;
  title: string;
  attack: string[];
  calls: Array<{ label: string; decided: Array<{ category: string; outcome: Outcome; exposed: Exposure }> }>;
  transcript: string;
  check: string;
  checkNote: string;
  limits: string[];
  logDisplay: string[];
}

export interface Facts {
  package: string;
  version: string;
  /** What `npm view <pkg> dist-tags.latest` returned at build time; null if the registry was unreachable. */
  npmLatest: string | null;
  license: string;
  node: string;
  checkCommand: string;
  /** The commands the CLI itself recommends for NoData's gate and its record. */
  gateCommand: string;
  cardCommand: string;
  categories: string[];
  labels: Record<string, string>;
  flags: string[];
  changelog: Array<{ version: string; title: string; note: string }>;
  lab: Scenario[];
  agenticWeb: WebScenario[];
  code: Record<"toEvents" | "exposure", { file: string; lines: Array<{ no: number; text: string }> }>;
  session: {
    lines: string[];
    tally: { calls: number; events: number; succeeded: number; yes: number; no: number; unknown: number; samples: number };
  };
}

export const facts = raw as unknown as Facts;

/** The one command the site leads with: the CLI's own CHECK_COMMAND. */
export const RUN = facts.checkCommand;

/** The verdict a scenario shows: no event, or the strongest exposure among its events. */
export type Verdict = "exposed" | "unknown" | "no" | "none";
export function verdictOf(s: Scenario): Verdict {
  if (!s.decided.length) return "none";
  if (s.decided.some((e) => e.exposed === "yes")) return "exposed";
  if (s.decided.some((e) => e.exposed === "unknown")) return "unknown";
  return "no";
}
export const VERDICT_LABEL: Record<Verdict, string> = { exposed: "EXPOSED", unknown: "UNKNOWN", no: "NO", none: "NO EVENT" };

export function succeededOf(s: Scenario): string {
  if (s.agent === "codex") return "not recorded";
  return s.toolError ? "no" : "yes";
}

/** The version people get from npm, and whether the source here is ahead of it. */
export const published = facts.npmLatest;
export const sourceAhead = !!facts.npmLatest && facts.npmLatest !== facts.version;
