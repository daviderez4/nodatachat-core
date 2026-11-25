// The record of the visitor's agreement to the terms, kept by NoData Capsule, the
// operator (Privacy Protection Law, sections 13 and 14: the person can see it and
// erase it on /privacy). This is the one request the site makes to anyone: to the
// operator's own consent door, only when the visitor agrees, views or erases.
//
// What is kept there: the terms version, the sentence agreed to, the time, the IP
// address and the browser (encrypted), for 7 years. What stays in this browser: the
// agreement id and its key, so the person can open the record without an account.
import { links } from "./links";

const DOOR = `${links.nodata}/api/public/signup`;
const SITE = "whatmyagentsaw";
export const RECORD = "wmas-consent";

export interface Held { code: string; secret: string; version: string; pending?: boolean }

export function readHeld(): Held | null {
  try {
    const v = JSON.parse(localStorage.getItem(RECORD) ?? "null");
    return v && typeof v.version === "string" ? (v as Held) : null;
  } catch {
    return null;
  }
}
export function writeHeld(h: Held | null) {
  try {
    if (h) localStorage.setItem(RECORD, JSON.stringify(h));
    else localStorage.removeItem(RECORD);
  } catch {
    /* storage blocked: the id is shown on screen to copy */
  }
}

/** One call to the consent door. text/plain keeps it a simple request (no preflight). */
async function call(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(DOOR, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ site_consent: body }), signal: ctrl.signal, credentials: "omit" });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Record the agreement. On failure the agreement is marked pending in this browser and
 * tried again on the next visit: the site never claims a record that does not exist.
 */
export async function recordAgreement(version: string, sentence: string): Promise<Held | null> {
  const r = await call({ action: "accept", site: SITE, terms_version: version, sentence });
  if (r.ok && typeof r.data.code === "string" && typeof r.data.secret === "string") {
    const h = { code: r.data.code, secret: r.data.secret, version };
    writeHeld(h);
    return h;
  }
  writeHeld({ code: "", secret: "", version, pending: true });
  return null;
}

export const viewRecord = (code: string, secret: string) => call({ action: "view", code, secret });
export const eraseRecord = (code: string, secret: string) => call({ action: "erase", code, secret });
