// The agent-check report, as terminal lines and as one self-contained HTML card.
// It is built from an AgentReport (agent-history.ts), which holds counts only,
// so nothing here can print a path, a command or a value: there is none to print.
// The HTML has no script and loads nothing.

import type { AgentReport, Category } from "./agent-history";
import { CATEGORIES } from "./agent-history";
import { MEASURED_CSS, measuredHtml, measuredLines, type Measured } from "./measured";

export type Lang = "en" | "he";

const LABEL: Record<Category, { en: string; he: string }> = {
  secret_file: { en: "Credential files (.env, keys, tokens)", he: "קובצי סודות (מפתחות, אסימונים, קובצי env)" },
  credential_command: { en: "Commands that print a credential", he: "פקודות שמדפיסות פרטי גישה" },
  secret_search: { en: "Searches for passwords and keys", he: "חיפושים של סיסמאות ומפתחות" },
  data_file: { en: "Data files (tables, databases, dumps)", he: "קובצי נתונים (טבלאות, מסדי נתונים, גיבויים)" },
  outbound_data: { en: "Commands that send data out", he: "פקודות ששולחות מידע החוצה" },
};

const AGENT_NAME = { "claude-code": "Claude Code", codex: "Codex" } as const;
const fmt = (n: number) => n.toLocaleString("en-US");
const day = (iso: string) => (iso ? iso.slice(0, 10) : "");

export const CHECK_COMMAND = "npx @nodatachat/protect@3 agent-check";
export const GATE_COMMAND = "npx -y @nodatachat/mcp@latest install-gate";
export const CARD_COMMAND = "npx -y @nodatachat/mcp@latest agent-card";
/** The page the steps below match, step for step. */
export const NEXT_URL = "https://whatmyagentsaw.com/next/";

/**
 * What to do with the report, in the order of whatmyagentsaw.com/next: the five free
 * steps first, NoData's gate last. The gate's line claims only what the gate does by
 * default (NoData's read gate): it holds and asks, and it warns after outside
 * content. Refusing is block mode or a rule the person sets, so it is not claimed here.
 * No path and no value: the same steps go on the shareable card.
 */
export function nextSteps(gateInstalled: boolean, lang: Lang): { text: string; cmd?: string }[] {
  const he = lang === "he";
  return [
    { text: he ? "לראות בדיוק איפה: ממצא בכל שורה, עם הקובץ והשורה, רק על המסך שלך:" : "See exactly where: one line per finding, with the file and the line, on your screen only:", cmd: `${CHECK_COMMAND} --events` },
    { text: he ? "להחליף כל מפתח אמיתי שחזר. מפתח שהגיע להקשר של הסוכן כבר בשיחה, ואי אפשר להחזיר אותו." : "Rotate every real key that came back. A key that reached the agent's context is in the conversation, and nothing takes it back." },
    { text: he ? "להוציא סודות מהישג היד של הסוכן: קובצי מפתחות מחוץ לתיקיות שהוא עובד בהן, וסודות שמוזרקים רק כשהפקודה רצה." : "Move secrets out of the agent's reach: key files outside the folders it works in, secrets injected only when a command runs." },
    { text: he ? "לחסום את הקריאות האלה בהגדרות של הסוכן עצמו (ב-Claude Code: ‏permissions.deny)." : "Deny those reads in the agent's own settings (in Claude Code: permissions.deny)." },
    { text: he ? "להריץ את הבדיקה שוב בשבוע הבא ולהשוות." : "Run the check again next week and compare." },
    gateInstalled
      ? { text: he ? "השער של NoData מותקן כאן ומחליט לפני הצעד. מה שהוא החליט:" : "NoData's gate is installed here and decides before the step. What it decided:", cmd: CARD_COMMAND }
      : { text: he ? "השער של NoData מחליט לפני הצעד: קריאה של קובץ עם ממצאים, או פקודה שמדפיסה פרטי גישה, ממתינה לאישור של אדם; אחרי תוכן מבחוץ, אזהרה." : "NoData's gate decides before the step: a read of a file with findings, or a command that prints a credential, waits for a person to approve; after outside content, a warning.", cmd: GATE_COMMAND },
  ];
}

/** The terminal summary. */
export function reportLines(r: AgentReport, lang: Lang): string[] {
  const he = lang === "he";
  if (!r.agents.length) {
    return [he
      ? `לא נמצאה היסטוריה של Claude Code או Codex ב-${r.days} הימים האחרונים במחשב הזה.`
      : `No Claude Code or Codex history found on this computer in the last ${r.days} days.`];
  }
  const who = r.agents.map((a) => `${AGENT_NAME[a.agent]} (${fmt(a.calls)})`).join(", ");
  const out = [
    he ? `מה הסוכן שלך עשה ב-${r.days} הימים האחרונים · ${who} · ${fmt(r.calls)} קריאות לכלים`
       : `What your AI agent did in the last ${r.days} days · ${who} · ${fmt(r.calls)} tool calls`,
    "",
  ];
  for (const c of CATEGORIES) {
    const k = r.categories[c];
    const ok = k.succeeded === null ? (he ? "הצלחה לא נרשמה" : "outcome not recorded") : (he ? `${fmt(k.succeeded)} הצליחו` : `${fmt(k.succeeded)} succeeded`);
    out.push(`  ${String(fmt(k.attempted)).padStart(6)}  ${LABEL[c][lang]}  ·  ${ok}${k.exposed ? (he ? `  ·  ${fmt(k.exposed)} ערכים סודיים חזרו לסוכן` : `  ·  ${fmt(k.exposed)} secret-looking values returned`) : ""}`);
  }
  out.push("");
  out.push(he
    ? `ערכים שנראים כמו סודות שחזרו להקשר של הסוכן, בכל הקריאות: ${fmt(r.exposedTotal)}`
    : `Secret-looking values that came back into the agent's context, over all calls: ${fmt(r.exposedTotal)}`);
  if (r.samplesSetApart) out.push(he
    ? `עוד ${fmt(r.samplesSetApart)} ערכים כאלה הגיעו מקובצי בדיקה, דוגמאות או קוד שהסוכן כתב בעצמו. סביר שהם דוגמאות, ולכן לא נספרו.`
    : `${fmt(r.samplesSetApart)} more came from tests, examples or code the agent wrote itself. They are likely samples, so they are not counted.`);
  out.push(r.gateInstalled
    ? (he ? `שער של NoData מותקן כאן: מה שהוא עצר מופיע כקריאות שנכשלו. הרישום שלו: ${CARD_COMMAND}` : `A NoData gate is installed here: what it refused shows as failed calls. Its own record: ${CARD_COMMAND}`)
    : (he ? "נחסמו: 0 — אין שער אכיפה במחשב הזה." : "Blocked: 0 — no gate is enforcing on this computer."));
  out.push(he
    ? "אלה אירועים שנמצאו בהיסטוריה המקומית. לא כל ניסיון מעיד על חשיפה. שום דבר לא נשלח מהמחשב."
    : "These are events found in the local history. An attempt is not an exposure. Nothing left this computer.");
  out.push("");
  for (const line of measuredLines(measuredOf(r), lang)) out.push(line);
  out.push("");
  out.push(he ? "הצעדים הבאים, החינמיים קודם:" : "Next steps, the free ones first:");
  nextSteps(r.gateInstalled, lang).forEach((s, i) => {
    out.push(`  ${i + 1}. ${s.text}`);
    if (s.cmd) out.push(`       ${s.cmd}`);
  });
  out.push(he ? `עוד: ${NEXT_URL}` : `More: ${NEXT_URL}`);
  return out;
}

/** Where these numbers come from, and over which window (measured.ts). */
export function measuredOf(r: AgentReport): Measured {
  return { source: "agent-history", from: r.from, to: r.to, days: r.days };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** The shareable card: numbers and category names only. */
export function reportHtml(r: AgentReport, lang: Lang): string {
  const he = lang === "he";
  const t = (h: string, e: string) => (he ? h : e);
  const sensitive = r.categories.secret_file.attempted + r.categories.credential_command.attempted + r.categories.secret_search.attempted;
  const rows = CATEGORIES.map((c) => {
    const k = r.categories[c];
    return `<tr><td>${esc(LABEL[c][lang])}</td><td class="n">${fmt(k.attempted)}</td><td class="n">${k.succeeded === null ? "—" : fmt(k.succeeded)}</td><td class="n ${k.exposed ? "x" : ""}">${k.exposed ? fmt(k.exposed) : "—"}</td></tr>`;
  }).join("");
  const who = r.agents.map((a) => `${AGENT_NAME[a.agent]} · ${fmt(a.calls)}`).join(" &nbsp;·&nbsp; ");
  return `<!doctype html>
<html lang="${lang}" dir="${he ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t("מה הסוכן שלך עשה", "What your agent did")}</title>
<style>
:root{--bg:#FBFAF7;--card:#fff;--ink:#11161D;--muted:#5A6270;--line:#E5E0D6;--gold:#8C6D2F;--soft:#EFE6D2;--x:#7E3A35}
@media (prefers-color-scheme:dark){:root{--bg:#181D25;--card:#212833;--ink:#EFEAE0;--muted:#A3ACB8;--line:#36404C;--gold:#D3B06A;--soft:#2A2416;--x:#E08C84}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;padding:32px 16px}
.w{max-width:820px;margin:0 auto}.ey{font:12px ui-monospace,Consolas,monospace;letter-spacing:.1em;color:var(--gold);text-transform:uppercase}
h1{font:500 clamp(28px,5vw,44px)/1.14 Georgia,serif;margin:10px 0 10px}h1 em{color:var(--gold);font-style:normal}
.sub{color:var(--muted);margin:0 0 24px}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:24px 26px}
table{width:100%;border-collapse:collapse}th,td{padding:11px 8px;border-bottom:1px solid var(--line);text-align:start}
th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;border-bottom:1px solid var(--ink)}
td.n,th.n{text-align:end;font-variant-numeric:tabular-nums;width:16%}td.n{font:500 20px Georgia,serif}td.x{color:var(--x)}
.block{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:22px;padding:16px 18px;border:1px solid var(--x);border-radius:6px}
.block b{font:500 28px Georgia,serif;color:var(--x)}
.next{margin:22px 0 0;padding:0;list-style:none;counter-reset:s;display:grid;gap:10px}.next li{counter-increment:s;display:grid;grid-template-columns:2em 1fr;gap:4px 10px;background:var(--soft);border:1px solid var(--gold);border-radius:6px;padding:12px 16px}
.next li::before{content:counter(s);font:500 20px Georgia,serif;color:var(--gold)}.next li code{grid-column:2}
.nh{margin-top:22px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
code{font:13px ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:isolate;user-select:all}
.fine{margin-top:18px;font-size:12.5px;color:var(--muted)}
${MEASURED_CSS}
</style></head><body><div class="w">
<div class="ey">${t("בדיקת סוכן · קוד פתוח", "Agent check · open source")} · <bdi dir="ltr">${esc(day(r.from))} – ${esc(day(r.to))}</bdi></div>
<h1>${t(`ב-${r.days} הימים האחרונים הסוכן שלך פנה <em>${fmt(sensitive)} פעמים</em> לפרטי גישה.`, `In the last ${r.days} days your AI agent reached for credentials <em>${fmt(sensitive)} times</em>.`)}</h1>
<p class="sub"><bdi dir="ltr">${who}</bdi> · ${t(`${fmt(r.calls)} קריאות לכלים נבדקו, על המחשב הזה בלבד. ״פרטי גישה״ כאן הם שלוש השורות הראשונות בטבלה: קובצי סודות, פקודות שמדפיסות פרטי גישה וחיפושים של סיסמאות ומפתחות. פנייה אינה חשיפה.`, `${fmt(r.calls)} tool calls checked, on this computer only. "Credentials" here are the first three rows: credential files, commands that print a credential, searches for passwords and keys. Reaching is not exposure.`)}</p>
<div class="card">
<table><thead><tr><th>${t("מה", "What")}</th><th class="n">${t("ניסה", "Tried")}</th><th class="n">${t("הצליח", "Succeeded")}</th><th class="n">${t("סודות חזרו", "Secrets returned")}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="block"><span>${t("ערכים שנראים כמו סודות שחזרו להקשר של הסוכן", "Secret-looking values that came back into the agent's context")}</span><b>${fmt(r.exposedTotal)}</b></div>
${r.samplesSetApart ? `<p class="fine">${t(`עוד ${fmt(r.samplesSetApart)} ערכים כאלה הגיעו מקובצי בדיקה, דוגמאות או קוד שהסוכן כתב בעצמו. סביר שהם דוגמאות, ולכן לא נספרו.`, `${fmt(r.samplesSetApart)} more came from tests, examples or code the agent wrote itself. They are likely samples, so they are not counted.`)}</p>` : ""}
${r.gateInstalled ? `<div class="block"><span>${t("שער של NoData מותקן כאן: מה שהוא עצר מופיע בעמודת ״הצליח״ כקריאות שנכשלו", "A NoData gate is installed here: what it refused shows as calls that did not succeed")}</span><b>✓</b></div>` : `<div class="block"><span>${t("נחסמו — אין שער אכיפה במחשב הזה", "Blocked — no gate is enforcing on this computer")}</span><b>0</b></div>`}
${measuredHtml(measuredOf(r), lang)}
<div class="nh">${t("הצעדים הבאים, החינמיים קודם", "Next steps, the free ones first")}</div>
<ol class="next">
${nextSteps(r.gateInstalled, lang).map((s) => `<li><span>${esc(s.text)}</span>${s.cmd ? `<code>${esc(s.cmd)}</code>` : ""}</li>`).join("\n")}
</ol>
<p class="fine">${t("עוד", "More")}: <bdi dir="ltr">${esc(NEXT_URL.replace(/^https:\/\//, "").replace(/\/$/, ""))}</bdi> · ${t("לבדוק את המחשב שלך:", "Check your own computer:")} <code>${CHECK_COMMAND}</code></p>
<p class="fine">${t(
    "אירועים שנמצאו בהיסטוריה המקומית של הסוכן בלבד: ניסיון אינו חשיפה, והיסטוריה שנמחקה לא נספרת. ״הצליח״ נרשם ב-Claude Code; ב-Codex מסומן ״—״. נספרו מספרים בלבד: אין כאן שם קובץ, פקודה או ערך, ושום דבר לא נשלח. הבודק החינמי סופר לפי סוגי קבצים ודפוסים גלויים; שער NoData קורא גם את תוכן המידע, מזהה בו מידע אישי ומחליט מה מותר לחשוף. הקוד והכללים פתוחים: ‎@nodatachat/protect.",
    "Events found in the agent's local history only: an attempt is not an exposure, and history that was deleted is not counted. \"Succeeded\" is recorded by Claude Code; Codex shows \"—\". Numbers only: no file name, command or value is here, and nothing was sent. The free check counts by file type and open patterns; the NoData gate also reads the content, finds personal data in it and decides what may be shown. The code and its rules are open: @nodatachat/protect.",
  )}</p>
</div></div></body></html>`;
}
