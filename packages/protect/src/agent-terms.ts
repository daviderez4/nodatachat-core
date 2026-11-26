// The terms agent-check asks you to agree to before it reads anything.
// Part of @nodatachat/protect (Apache-2.0).
//
// The same terms as whatmyagentsaw.com/terms (its copy.json, keys `consent` and
// `terms`), and the same version: TERMS_VERSION equals `terms.version` there, a date.
// When the site's terms change, this changes with them, and the CLI asks again.
//
// The agreement is kept on this computer only, next to the fingerprint salt
// (agent-events.ts SALT_FILE), in the shape the NoData MCP keeps its own
// (~/.nodata/consent.json): the terms version, when it
// was accepted, and a hash of those two. That code cannot be imported here (the open
// package imports only Node and itself), so the shape is copied, not a second design.
// The MCP's agent and organisation fields are left out: no name, no email, no account,
// no identifier of any kind. Nothing is sent anywhere.

import { createHash } from "node:crypto";
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

/** What is kept: the MCP's ConsentFile without its agent and organisation. */
export interface ConsentFile {
  terms_version: string;
  accepted_at: string;
  consent_hash: string;
}

export function consentRecord(at = new Date().toISOString()): ConsentFile {
  const consent_hash = createHash("sha256").update(`${TERMS_VERSION}|agent-check|${at}`).digest("hex");
  return { terms_version: TERMS_VERSION, accepted_at: at, consent_hash };
}

/** Keep the agreement: version, time, hash. False when it could not be kept. */
export function recordAgreement(file = termsFile()): boolean {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(consentRecord(), null, 2) + "\n", { mode: 0o600 });
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

/** The sentence a person agrees to by answering y, as on the site's agreement box. */
export const AGREEMENT_SENTENCE = {
  en: "I have read and agree to the Terms of Use, including the disclaimer of warranties and the limitation of liability.",
  he: "קראתי ואני מסכים/ה לתנאי השימוש, כולל ההסתלקות מאחריות והגבלת החבות.",
} as const;

/** The short terms, as printed before the first run: the site's four consent points. */
export function termsLines(lang: TermsLang): string[] {
  if (lang === "he") {
    return [
      "לפני ש-agent-check קורא משהו:",
      "  · agent-check הוא קוד פתוח (Apache-2.0), ומסופק כמות שהוא (AS IS), ללא אחריות מכל סוג.",
      "  · הוא רץ על המחשב הזה, קורא רק את ההיסטוריה של הסוכן שלך (‎~/.claude/projects ו-‎~/.codex/sessions), ולא שולח כלום.",
      "  · הממצאים הם אינדיקציות, לא ביקורת אבטחה.",
      "  · השימוש באחריותך, רק על מחשבים וחשבונות שמותר לך לבדוק, והחבות של NoData Capsule (המפעילה) מוגבלת כמפורט בתנאים.",
      `  התנאים המלאים: ${TERMS_URL}`,
      "",
      AGREEMENT_SENTENCE.he,
    ];
  }
  return [
    "Before agent-check reads anything:",
    "  · agent-check is open source (Apache-2.0) and provided as is, without any warranty.",
    "  · It runs on this computer, reads only your agent's own history (~/.claude/projects and ~/.codex/sessions), and sends nothing.",
    "  · Its findings are indications, not a security audit.",
    "  · You use it at your own responsibility, only on computers and accounts you are allowed to inspect, and the liability of NoData Capsule (the operator) is limited as the terms say.",
    `  The full terms: ${TERMS_URL}`,
    "",
    AGREEMENT_SENTENCE.en,
  ];
}

export function termsQuestion(lang: TermsLang): string {
  return lang === "he" ? "מסכימים וממשיכים? [y/N] " : "Agree and continue? [y/N] ";
}

export function declinedLine(lang: TermsLang): string {
  return lang === "he" ? "לא הסכמתם, ולכן לא נקרא דבר." : "Not agreed. Nothing was read.";
}

/** The command a person runs to agree where there is no terminal to ask in. */
export const ACCEPT_COMMAND = "npx @nodatachat/protect@3 agent-check --accept-terms";

/**
 * Without a terminal there is no one to ask, and no wait. The person still reads the terms
 * right here, where they ran the command, rather than being sent to a website: the short
 * terms, the sentence they agree to, and the one command that agrees. An agent that ran
 * the check (the usual way there is no terminal) is told to show the terms to the person
 * and to add the flag only after the person says yes: it never agrees for them.
 */
export function noTerminalLines(lang: TermsLang): string[] {
  const he = lang === "he";
  return [
    ...termsLines(lang),
    "",
    he ? "כדי להסכים, הריצו אותו שוב עם --accept-terms:" : "To agree, run it once more with --accept-terms:",
    `  ${ACCEPT_COMMAND}`,
    he
      ? "אם סוכן AI הריץ את זה: הראו לאדם את התנאים, והוסיפו --accept-terms רק אחרי שהוא אומר שהוא מסכים. סוכן לעולם לא מסכים במקום אדם."
      : "If an AI agent ran this: show the person these terms, and add --accept-terms only after the person says they agree. An agent never agrees for a person.",
  ];
}

export function acceptedByFlagLine(lang: TermsLang): string {
  return lang === "he" ? "הסכמתם עם --accept-terms." : "Agreed with --accept-terms.";
}
