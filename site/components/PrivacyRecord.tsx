"use client";
import { useEffect, useState } from "react";
import { copy, T } from "@/lib/copy";
import { readHeld, writeHeld, viewRecord, eraseRecord } from "@/lib/consent-record";

// The form for sections 13 and 14: the agreement id and key, filled from this browser,
// sent only to the operator's consent door. Nothing is shown without both.
const c = copy.privacy;
type Rec = Record<string, string | null>;
const ORDER = ["code", "terms_version", "sentence", "accepted_at", "ip", "user_agent", "retain_until", "erased_at", "receipt_hash"] as const;

export function PrivacyRecord() {
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [rec, setRec] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = readHeld();
    if (h?.code) {
      setCode(h.code);
      setSecret(h.secret);
    } else setNote(h?.pending ? c.pending : c.none);
  }, []);

  const fail = (status: number) => setNote(status === 404 ? c.notFound : c.unavailable);

  const view = async () => {
    setBusy(true); setNote(null); setRec(null);
    const r = await viewRecord(code.trim(), secret.trim());
    setBusy(false);
    if (r.ok) setRec(r.data as Rec);
    else fail(r.status);
  };

  const erase = async () => {
    if (!window.confirm(c.eraseConfirm)) return;
    setBusy(true); setNote(null); setRec(null);
    const r = await eraseRecord(code.trim(), secret.trim());
    setBusy(false);
    if (!r.ok) return fail(r.status);
    // The record no longer stands as evidence, so this browser forgets the agreement too.
    if (readHeld()?.code === code.trim().toUpperCase()) {
      writeHeld(null);
      try { localStorage.removeItem("wmas-terms"); } catch { /* nothing kept */ }
    }
    setNote(c.erased);
  };

  const ready = code.trim().length > 0 && secret.trim().length > 0 && !busy;
  const input: React.CSSProperties = { width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 15 };
  const show = (k: string, v: string | null) => (v == null ? (k === "ip" || k === "user_agent" ? c.erasedValue : "—") : v);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20, borderRadius: 14, background: "var(--paper-2)", border: "1px solid var(--line)" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>{c.formTitle}</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--ink-2)" }}>{c.formBody}</p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
        {c.codeLabel}
        <input className="mono" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} style={input} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
        {c.secretLabel}
        <input className="mono" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} type="password" style={input} />
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={view} disabled={!ready} className="btn btn-ink" style={{ minHeight: 44, opacity: ready ? 1 : 0.5 }}>{busy ? c.busy : c.view}</button>
        <button type="button" onClick={erase} disabled={!ready} className="btn btn-ghost" style={{ minHeight: 44, opacity: ready ? 1 : 0.5 }}>{c.erase}</button>
      </div>
      {note ? <p role="status" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}><T s={note} /></p> : null}
      {rec ? (
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(110px, auto) 1fr", gap: "8px 14px", padding: 14, borderRadius: 10, background: "var(--card)", fontSize: 14 }}>
          {ORDER.map((k) => (
            <div key={k} style={{ display: "contents" }}>
              <dt style={{ color: "var(--faint)" }}>{c.fields[k]}</dt>
              <dd className={k === "code" || k === "receipt_hash" || k === "ip" ? "mono" : undefined} style={{ margin: 0, wordBreak: "break-word" }}>{show(k, rec[k] ?? null)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
