// The enforcement toolbox (/toolbox/) shows only entries that carry the same fields and pass the same
// rules, whoever made the tool. This script runs before every build (npm run facts) and holds
// content/toolbox.json to them:
//
//   1. Every claim points to its source: how_to_verify is an https URL to the tool's own docs or code,
//      with no tracking parameters.
//   2. Every entry says when it was last checked, as a real date that is not in the future.
//   3. Placement is one of the seven levels, and enforces / proves / basis use the fixed words, so a
//      card can never say more than "yes", "partial" or "no".
//
// An entry that breaks a rule fails the build. An entry not re-checked for STALE_DAYS stays on the
// page, marked as stale.
//
// Output: generated/toolbox.json (git-ignored, rebuilt on every build).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const STALE_DAYS = 120;

const CATEGORIES = ["agent gate", "secrets", "data access", "MCP", "audit/proof", "agent setting", "masking", "detection"];
const TRISTATE = ["yes", "partial", "no"];
const LEAVES = ["yes", "no", "depends"];
const BASIS = ["docs", "tested"];
const WHERE = ["your machine", "your cloud", "vendor"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRACKING = /^utm_|^fbclid$|^gclid$|^mc_cid$|^mc_eid$|^ref$|^ref_src$|^_hs/i;
const TEXT = ["name", "url", "covers", "price", "limits", "summary", "open_source", "how_to_verify", "last_checked"];

const errors = [];
const bad = (id, msg) => errors.push(`"${id}": ${msg}`);

const items = JSON.parse(readFileSync(join(SITE, "content", "toolbox.json"), "utf8"));
const today = new Date();
const seen = new Set();

function httpsUrl(id, field, value) {
  let url;
  try { url = new URL(value); } catch { bad(id, `${field} is not a URL`); return; }
  if (url.protocol !== "https:") bad(id, `${field} must be https`);
  for (const k of url.searchParams.keys()) if (TRACKING.test(k)) bad(id, `${field} carries the tracking parameter ${k}`);
}

for (const it of items) {
  const id = it.id ?? "(no id)";
  if (!/^[a-z0-9-]+$/.test(id)) bad(id, "id must be lowercase letters, digits and dashes");
  if (seen.has(id)) bad(id, "duplicate id");
  seen.add(id);

  for (const f of TEXT) if (typeof it[f] !== "string" || !it[f].trim()) bad(id, `missing ${f}`);
  if (it.disclosure !== undefined && (typeof it.disclosure !== "string" || !it.disclosure.trim())) bad(id, "disclosure, when present, must be a sentence");
  for (const [f, v] of Object.entries(it)) if (typeof v === "string" && v.includes("—")) bad(id, `${f} uses an em dash; use a comma, colon or period`);

  if (typeof it.url === "string") httpsUrl(id, "url", it.url);
  if (typeof it.how_to_verify === "string") httpsUrl(id, "how_to_verify", it.how_to_verify);

  if (!DATE.test(it.last_checked ?? "") || Number.isNaN(Date.parse(it.last_checked))) bad(id, "last_checked must be a valid YYYY-MM-DD date");
  else if (Date.parse(it.last_checked) > today.getTime() + 86400000) bad(id, "last_checked is in the future");

  if (!Number.isInteger(it.level) || it.level < 1 || it.level > 7) bad(id, `level must be 1 to 7, got ${JSON.stringify(it.level)}`);
  if (!CATEGORIES.includes(it.category)) bad(id, `unknown category "${it.category}". Known: ${CATEGORIES.join(", ")}`);
  if (!TRISTATE.includes(it.enforces)) bad(id, `enforces must be yes, partial or no, got "${it.enforces}"`);
  if (!TRISTATE.includes(it.proves)) bad(id, `proves must be yes, partial or no, got "${it.proves}"`);
  if (!LEAVES.includes(it.content_leaves)) bad(id, `content_leaves must be yes, no or depends, got "${it.content_leaves}"`);
  if (!BASIS.includes(it.basis)) bad(id, `basis must be docs or tested, got "${it.basis}"`);
  if (!Array.isArray(it.runs_where) || !it.runs_where.length || it.runs_where.some((w) => !WHERE.includes(w))) bad(id, `runs_where must list one or more of: ${WHERE.join(", ")}`);
}

if (errors.length) {
  console.error(`toolbox-check: ${errors.length} problem(s) in content/toolbox.json`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const ageDays = (d) => Math.floor((today.getTime() - Date.parse(d)) / 86400000);
// "Open source" on the page means the whole tool is under an open licence: not source-available,
// and not a tool whose open part is only one layer of it.
const openSource = (s) => s !== "no" && !/^source-available/i.test(s) && !/closed/i.test(s);
const out = items
  .map((it) => ({ ...it, stale: ageDays(it.last_checked) > STALE_DAYS, oss: openSource(it.open_source), local: it.runs_where.includes("your machine") }))
  // Lowest level first, so the list reads up the ladder. Ties keep the file's order.
  .sort((a, b) => a.level - b.level);
const stale = out.filter((i) => i.stale).length;

mkdirSync(join(SITE, "generated"), { recursive: true });
writeFileSync(join(SITE, "generated", "toolbox.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`toolbox-check: ${out.length} tools, ${stale} stale (not re-checked in ${STALE_DAYS} days)`);
