// How a number was measured: its source, its window and what one unit of it is.
//
// Two tools on one computer count different things. The open agent-check counts the
// tool calls in the agent's own history; NoData's agent card counts the decisions its
// gate wrote. Both are true, and they disagree (13 vs 136 on one machine, 23.11.2026),
// because the source, the window and the unit differ. So every number they show says
// all three, in the same words, and each names the other so nobody compares the two
// as if they were one count.
//
// Shared output only: no path, no file name, no value. The source is named in words,
// the window in days (never a time of day).

export type Lang = "en" | "he";
export type Source = "agent-history" | "gate-log";

export interface Measured {
  source: Source;
  /** ISO date or timestamp; only the day is shown. Empty when nothing was recorded. */
  from: string;
  to: string;
  /** The window asked for, in days. When absent it is counted from `from` and `to`. */
  days?: number;
}

const SOURCE: Record<Source, { en: string; he: string }> = {
  "agent-history": {
    en: "the history Claude Code and Codex keep on this computer",
    he: "ההיסטוריה ש-Claude Code ו-Codex שומרים במחשב הזה",
  },
  "gate-log": {
    en: "the decisions NoData's gate wrote on this computer",
    he: "ההחלטות ששער NoData רשם במחשב הזה",
  },
};

const UNIT: Record<Source, { en: string; he: string }> = {
  "agent-history": {
    en: "one tool call the agent made, counted once in its category; an attempt is not an exposure",
    he: "קריאה אחת של הסוכן לכלי, נספרת פעם אחת בקטגוריה שלה; ניסיון אינו חשיפה",
  },
  "gate-log": {
    en: "one decision of the gate (stopped, asked or passed); one action can be judged more than once",
    he: "החלטה אחת של השער (נעצר, נשאל או עבר); אותה פעולה יכולה להיבדק יותר מפעם אחת",
  },
};

const OTHER: Record<Source, { en: string; he: string; cmd: string }> = {
  "agent-history": {
    en: "Not the same count as NoData's agent card, which counts the gate's decisions:",
    he: "זו לא אותה ספירה כמו כרטיס הסוכנים של NoData, שסופר את החלטות השער:",
    cmd: "npx -y @nodatachat/mcp@latest agent-card",
  },
  "gate-log": {
    en: "Not the same count as the open agent check, which counts the agent's own history:",
    he: "זו לא אותה ספירה כמו הבודק הפתוח, שסופר את ההיסטוריה של הסוכן עצמו:",
    cmd: "npx @nodatachat/protect@3 agent-check",
  },
};

const day = (iso: string) => (/^\d{4}-\d\d-\d\d/.test(iso) ? iso.slice(0, 10) : "");

/** Days from `from` to `to`, both counted. 0 when either is missing. */
export function spanDays(from: string, to: string): number {
  const a = Date.parse(day(from));
  const b = Date.parse(day(to));
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** The three facts as labelled parts, for a terminal or a card. */
export function measuredParts(m: Measured, lang: Lang): { source: string; window: string; unit: string; other: string; otherCmd: string } {
  const he = lang === "he";
  const days = m.days ?? spanDays(m.from, m.to);
  const range = day(m.from) && day(m.to) ? `${day(m.from)} – ${day(m.to)}` : "";
  const window = he
    ? `${days} ימים${range ? ` (${range})` : ""}`
    : `${days} day${days === 1 ? "" : "s"}${range ? ` (${range})` : ""}`;
  return {
    source: SOURCE[m.source][lang],
    window,
    unit: UNIT[m.source][lang],
    other: OTHER[m.source][lang],
    otherCmd: OTHER[m.source].cmd,
  };
}

/** The terminal lines: where from, which window, what one unit is, and which count it is not. */
export function measuredLines(m: Measured, lang: Lang): string[] {
  const p = measuredParts(m, lang);
  return lang === "he"
    ? [`מקור: ${p.source}`, `חלון: ${p.window}`, `יחידה: ${p.unit}`, `${p.other} ${p.otherCmd}`]
    : [`Source: ${p.source}`, `Window: ${p.window}`, `Unit: ${p.unit}`, `${p.other} ${p.otherCmd}`];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** The same, as a small block for an HTML card (no script, no link). */
export function measuredHtml(m: Measured, lang: Lang): string {
  const p = measuredParts(m, lang);
  const he = lang === "he";
  const row = (k: string, v: string) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
  return `<dl class="measured">${row(he ? "מקור" : "Source", p.source)}${row(he ? "חלון" : "Window", p.window)}${row(he ? "יחידה" : "Unit", p.unit)}</dl>`
    + `<p class="fine">${esc(p.other)} <code>${esc(p.otherCmd)}</code></p>`;
}

/** The CSS the block needs; each card adds it once. Uses the card's own colour tokens. */
export const MEASURED_CSS =
  ".measured{margin:22px 0 0;display:grid;gap:6px;font-size:13.5px}.measured div{display:grid;grid-template-columns:5.5em 1fr;gap:10px}"
  + ".measured dt{color:var(--muted);font-weight:600}.measured dd{margin:0}";
