"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { copy, T } from "@/lib/copy";
import { Emblem } from "./Emblem";
import { readHeld, recordAgreement, type Held } from "@/lib/consent-record";

// The visitor agrees to the terms once per terms version. The agreement is recorded by
// the operator (lib/consent-record.ts) so it stands as evidence, and the person keeps the
// id and key to see or erase it on /privacy. An agreement made before it was recorded
// asks again once, so the person agrees with the collection stated. A failed record is
// tried again quietly on the next visit. If storage is blocked, the window shows on every
// visit rather than not at all.
const KEY = "wmas-terms";
const c = copy.consent;

export function Consent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [stage, setStage] = useState<"ask" | "saving" | "recorded" | "failed">("ask");
  const [held, setHeld] = useState<Held | null>(null);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let agreed = false;
    try {
      agreed = localStorage.getItem(KEY) === copy.terms.version;
    } catch {
      /* storage blocked: ask */
    }
    const h = readHeld();
    const onRecord = h?.version === copy.terms.version;
    if (agreed && onRecord && h?.pending) void recordAgreement(copy.terms.version, c.checkbox);
    setOpen(!(agreed && onRecord));
  }, []);

  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  // The terms page itself stays readable: the window would cover the text it asks you to read.
  // The evidence pages are reading, not using the tool: a reader arriving from a shared post
  // gets the article, and the terms still come up on the tool's pages.
  if (!open || pathname?.startsWith("/terms") || pathname?.startsWith("/principles") || pathname?.startsWith("/privacy") || pathname?.startsWith("/evidence")) return null;

  // Clickwrap: the box starts unchecked and the button stays disabled until the person ticks it.
  const agree = async () => {
    if (!checked || stage !== "ask") return;
    try {
      localStorage.setItem(KEY, copy.terms.version);
    } catch {
      /* not stored: the agreement holds for this visit */
    }
    setStage("saving");
    const h = await recordAgreement(copy.terms.version, c.checkbox);
    setHeld(h);
    setStage(h ? "recorded" : "failed");
  };

  const card: React.CSSProperties = { width: "100%", maxWidth: 520, background: "var(--card)", borderRadius: 16, padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", gap: 16 };
  const shade: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,13,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };

  if (stage === "recorded" || stage === "failed") {
    return (
      <div style={shade}>
        <div role="dialog" aria-modal="true" aria-labelledby="consent-title" style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Emblem size={56} />
            <h2 id="consent-title" style={{ margin: 0, fontFamily: "var(--display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{stage === "recorded" ? c.recordedTitle : c.title}</h2>
          </div>
          {held ? (
            <>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--ink-2)" }}><T s={c.recordedBody} /></p>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", padding: 14, borderRadius: 10, background: "var(--paper-2)", fontSize: 14 }}>
                <dt style={{ color: "var(--faint)" }}>{c.recordedId}</dt>
                <dd className="mono" style={{ margin: 0, fontWeight: 600, wordBreak: "break-all", userSelect: "all" }}>{held.code}</dd>
                <dt style={{ color: "var(--faint)" }}>{c.recordedKey}</dt>
                <dd className="mono" style={{ margin: 0, wordBreak: "break-all", userSelect: "all" }}>{held.secret}</dd>
              </dl>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--ink-2)" }}>{c.notRecorded}</p>
          )}
          <button type="button" autoFocus onClick={() => { setOpen(false); window.dispatchEvent(new Event("wmas:agreed")); }} className="btn btn-ink" style={{ width: "100%", minHeight: 48 }}>{c.done}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={shade}>
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Emblem size={56} />
          <h2 id="consent-title" style={{ margin: 0, fontFamily: "var(--display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.title}</h2>
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          {c.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}><T s={c.principles} /> <T s={c.termsLink} /></p>
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, cursor: "pointer", padding: 12, borderRadius: 10, background: "var(--paper-2)" }}>
          <input ref={box} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flex: "none", accentColor: "var(--ink)" }} />
          <span>{c.checkbox}</span>
        </label>
        <button type="button" onClick={agree} disabled={!checked || stage === "saving"} aria-disabled={!checked} className="btn btn-ink" style={{ width: "100%", minHeight: 48, opacity: checked ? 1 : 0.4, cursor: checked ? "pointer" : "not-allowed" }}>{stage === "saving" ? c.saving : c.agree}</button>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--faint)", textAlign: "center" }}><T s={c.stored} /></p>
      </div>
    </div>
  );
}
