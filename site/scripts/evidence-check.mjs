// The evidence ticker shows only items a person opened at the source and matched word for word.
// This script runs before every build (npm run facts) and holds content/evidence.json to the three
// rules of the NoData Evidence Intelligence project:
//
//   1. Source before summary: every item carries the original URL, the verbatim quote it rests on,
//      and the date someone last opened that page. No tracking parameters, no secondary article.
//   2. Evidence before conclusion: a legal item names its stage (allegation ... final judgment);
//      a filed claim is never shown as a finding.
//   3. Unknown is not safe: the technical status is one of five states, and "no_event" is not
//      accepted here at all, because a news item cannot prove an absence.
//
// An item that breaks a rule fails the build. An item not re-verified for STALE_DAYS stays on
// /evidence/ marked as stale, and leaves the ticker.
//
// Output: generated/evidence.json (git-ignored, rebuilt on every build).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const STALE_DAYS = 120;

const EVENT_TYPES = ["incident", "hazard", "vulnerability", "lawsuit", "court_decision", "enforcement_action", "regulation", "guidance", "standard", "technical_finding", "research"];
const TECH = ["attempted", "succeeded", "exposed", "unknown"]; // no_event is refused: see rule 3 above
const LEGAL = ["not_legal", "allegation", "evidence_filed", "finding_of_fact", "court_decision", "final_judgment"];
const LEGAL_EVENTS = ["lawsuit", "court_decision", "enforcement_action"];
const EVENT_LIKE = ["incident", "hazard", "vulnerability", "technical_finding"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const bad = (id, msg) => errors.push(`"${id}": ${msg}`);

const items = JSON.parse(readFileSync(join(SITE, "content", "evidence.json"), "utf8"));
const today = new Date();
const seen = new Set();

for (const it of items) {
  const id = it.id ?? "(no id)";
  if (!/^[a-z0-9-]+$/.test(id)) bad(id, "id must be lowercase letters, digits and dashes");
  if (seen.has(id)) bad(id, "duplicate id");
  seen.add(id);

  for (const f of ["headline", "claim", "quote", "why", "source_id", "source_name", "source_url", "limits"])
    if (typeof it[f] !== "string" || !it[f].trim()) bad(id, `missing ${f}`);

  let url;
  try { url = new URL(it.source_url); } catch { bad(id, "source_url is not a URL"); }
  if (url) {
    if (url.protocol !== "https:") bad(id, "source_url must be https");
    for (const k of url.searchParams.keys()) if (/^utm_|^fbclid$|^gclid$/i.test(k)) bad(id, `source_url carries the tracking parameter ${k}`);
  }

  if (it.date !== null && !(typeof it.date === "string" && DATE.test(it.date))) bad(id, "date must be YYYY-MM-DD or null (null when the source gives none)");
  if (!DATE.test(it.last_verified ?? "")) bad(id, "last_verified must be YYYY-MM-DD");
  else if (Date.parse(it.last_verified) > today.getTime() + 86400000) bad(id, "last_verified is in the future");

  if (it.verification_status !== "opened_and_matched") bad(id, `verification_status is "${it.verification_status}"; only items opened at the source and matched may be shown`);
  if (!EVENT_TYPES.includes(it.event_type)) bad(id, `unknown event_type "${it.event_type}"`);
  if (!LEGAL.includes(it.legal_stage)) bad(id, `unknown legal_stage "${it.legal_stage}"`);
  if (LEGAL_EVENTS.includes(it.event_type) && it.legal_stage === "not_legal") bad(id, "a legal item must name its stage");
  if (!["high", "medium", "low"].includes(it.confidence)) bad(id, "confidence must be high, medium or low");

  if (it.technical_status === "no_event") bad(id, "no_event cannot be shown from a news item: absence needs a complete, sealed window");
  else if (it.technical_status !== null && !TECH.includes(it.technical_status)) bad(id, `unknown technical_status "${it.technical_status}"`);
  if (EVENT_LIKE.includes(it.event_type) && it.technical_status === null) bad(id, `an ${it.event_type} needs a technical_status (use "unknown" when the source does not say)`);
}

if (errors.length) {
  console.error(`evidence-check: ${errors.length} problem(s) in content/evidence.json`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const ageDays = (d) => Math.floor((today.getTime() - Date.parse(d)) / 86400000);
const out = items
  .map((it) => ({ ...it, stale: ageDays(it.last_verified) > STALE_DAYS }))
  // Latest first. An item whose source gives no date goes last: "latest" would be a claim we cannot make.
  .sort((a, b) => (a.date === null) - (b.date === null) || (b.date ?? "").localeCompare(a.date ?? ""));
const stale = out.filter((i) => i.stale).length;

mkdirSync(join(SITE, "generated"), { recursive: true });
writeFileSync(join(SITE, "generated", "evidence.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`evidence-check: ${out.length} items, ${stale} stale (not re-verified in ${STALE_DAYS} days)`);
