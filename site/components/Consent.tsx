"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { copy, T } from "@/lib/copy";

// The visitor agrees to the terms once per terms version. The agreement is kept in
// this browser only (localStorage): no cookie, no request, nothing leaves the page.
// If storage is blocked, the window shows on every visit rather than not at all.
const KEY = "wmas-terms";
const c = copy.consent;

export function Consent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let agreed = false;
    try {
      agreed = localStorage.getItem(KEY) === copy.terms.version;
    } catch {
      /* storage blocked: ask */
    }
    setOpen(!agreed);
  }, []);

  useEffect(() => {
    if (open) button.current?.focus();
  }, [open]);

  // The terms page itself stays readable: the window would cover the text it asks you to read.
  if (!open || pathname?.startsWith("/terms")) return null;

  const agree = () => {
    try {
      localStorage.setItem(KEY, copy.terms.version);
    } catch {
      /* not stored: the agreement holds for this visit */
    }
    setOpen(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,13,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" style={{ width: "100%", maxWidth: 520, background: "var(--card)", borderRadius: 16, padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 id="consent-title" style={{ margin: 0, fontFamily: "var(--display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.title}</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          {c.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <p style={{ margin: 0, fontSize: 14 }}><T s={c.termsLink} /></p>
        <button ref={button} type="button" onClick={agree} className="btn btn-ink" style={{ width: "100%", minHeight: 48 }}>{c.agree}</button>
        <p style={{ margin: 0, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>{c.stored}</p>
      </div>
    </div>
  );
}
