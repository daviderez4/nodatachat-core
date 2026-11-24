// The terms agent-check asks you to agree to before it reads anything.
// Part of @nodatachat/protect (Apache-2.0).
//
// The same terms as whatmyagentsaw.com/terms (its copy.json, keys `consent` and
// `terms`), and the same version: TERMS_VERSION equals `terms.version` there, a date.
// When the site's terms change, this changes with them, and the CLI asks again.
//
// The agreement is kept on this computer only, next to the fingerprint salt
// (agent-events.ts SALT_FILE), in the shape the NoData MCP keeps its own
// (~/.nodata/consent.json): { "terms_version": "<date>" }. Only the version: no name,
// no email, no time, no identifier of any kind. Nothing is sent anywhere.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Equal to `terms.version` on whatmyagentsaw.com. A new date asks everyone again. */
export const TERMS_VERSION = "2026-11-24";
export const TERMS_URL = "https://whatmyagentsaw.com/terms/";

/** Where the agreement is kept: beside the salt, outside any project. */
export function termsFile(home = homedir()): string {
  return join(home, ".agent-check", "consent.json");
}

/** The version agreed to on this computer, or null. */
export function agreedVersion(file = termsFile()): string | null {
  try {
    if (!existsSync(file)) return null;
    const v = (JSON.parse(readFileSync(file, "utf8")) as { terms_version?: unknown }).terms_version;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export function hasAgreed(file = termsFile()): boolean {
  return agreedVersion(file) === TERMS_VERSION;
}

/** Keep the agreement: the terms version, and nothing else. False when it could not be kept. */
export function recordAgreement(file = termsFile()): boolean {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ terms_version: TERMS_VERSION }) + "\n", { mode: 0o600 });
    return true;
  } catch {
    // No place to keep it: the agreement holds for this run, and the next run asks again.
    return false;
  }
}

/** y or yes, any case. Anything else, an empty answer included, is no. */
export function isYes(answer: string): boolean {
  return /^(y|yes)$/i.test(answer.trim());
}

export type TermsLang = "en" | "he";

/** The short terms, as printed before the first run. */
export function termsLines(lang: TermsLang): string[] {
  if (lang === "he") {
    return [
      "לפני ש-agent-check קורא משהו:",
      "  · קוד פתוח (Apache-2.0), מסופק כמות שהוא (AS IS), ללא אחריות.",
      "  · רץ על המחשב הזה, קורא רק את ‎~/.claude/projects ואת ‎~/.codex/sessions, ולא שולח כלום.",
      "  · הממצאים הם אינדיקציות, לא ביקורת אבטחה.",
      "  · הריצו אותו רק על מחשבים וחשבונות שמותר לכם לבדוק.",
      `  התנאים המלאים: ${TERMS_URL}`,
    ];
  }
  return [
    "Before agent-check reads anything:",
    "  · It is open source (Apache-2.0), provided as is, without warranty.",
    "  · It runs on this computer, reads only ~/.claude/projects and ~/.codex/sessions, and sends nothing.",
    "  · Its findings are indications, not a security audit.",
    "  · Run it only on computers and accounts you are allowed to inspect.",
    `  The full terms: ${TERMS_URL}`,
  ];
}

export function termsQuestion(lang: TermsLang): string {
  return lang === "he" ? "מסכימים וממשיכים? [y/N] " : "Agree and continue? [y/N] ";
}

export function declinedLine(lang: TermsLang): string {
  return lang === "he" ? "לא הסכמתם, ולכן לא נקרא דבר." : "Not agreed. Nothing was read.";
}

/** Without a terminal there is no one to ask: one line, and no wait. */
export function noTerminalLine(lang: TermsLang): string {
  return lang === "he"
    ? `agent-check: צריך להסכים לתנאים (${TERMS_URL}) לפני הריצה הראשונה. הריצו אותו פעם אחת בטרמינל, או הוסיפו --accept-terms.`
    : `agent-check: agree to the terms (${TERMS_URL}) before the first run. Run it once in a terminal, or add --accept-terms.`;
}

export function acceptedByFlagLine(lang: TermsLang): string {
  return lang === "he" ? "הסכמתם עם --accept-terms." : "Agreed with --accept-terms.";
}
