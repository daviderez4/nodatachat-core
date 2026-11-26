"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { Emblem } from "./Emblem";

type Lang = "en" | "he";
const P = copy.principles;
const KEY = "wmas-principles-lang";

// One plain line icon per commandment, drawn so anyone can read it at a glance.
const ICONS: React.ReactNode[] = [
  // 1 know your data: a magnifier over stacked data
  <><ellipse cx="11" cy="6" rx="6" ry="2.5" /><path d="M5 6v8c0 1.4 2.7 2.5 6 2.5M17 6v4" /><circle cx="18" cy="17" r="3" /><path d="M20.2 19.2 22 21" /></>,
  // 2 information leaves the organisation: an arrow out of a box
  <><path d="M14 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" /><path d="M10 12h11M17 8l4 4-4 4" /></>,
  // 3 policy before access: a document with a check
  <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="m9 14 2 2 4-4" /></>,
  // 4 not vendors' promises: an eye that looks for itself
  <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>,
  // 5 holding is not access: a file and a separate key
  <><path d="M4 3h8l3 3v9H4z" /><circle cx="17" cy="17" r="2.5" /><path d="M19 19l3 3M20.5 20.5l1.2-1.2" /></>,
  // 6 enforce: a gate that closes
  <><path d="M4 21V9M20 21V9M4 9h16" /><path d="M8 13l8 4M16 13l-8 4" /></>,
  // 7 proof before disclosure: a seal with a check
  <><circle cx="12" cy="10" r="6" /><path d="m9.5 10 1.8 1.8L14.8 8.3" /><path d="M8.5 15 7 21l5-2.5 5 2.5-1.5-6" /></>,
  // 8 what the system does not know: a question mark in a frame
  <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.5" /><path d="M12 17h.01" /></>,
  // 9 check, learn, improve: a loop
  <><path d="M20 8a8 8 0 0 0-14-2M4 4v3h3" /><path d="M4 16a8 8 0 0 0 14 2M20 20v-3h-3" /></>,
  // 10 control stays with the owner: a person holding a key
  <><circle cx="9" cy="7" r="3" /><path d="M3 21v-1a6 6 0 0 1 9-5.2" /><circle cx="17" cy="15" r="2.5" /><path d="M19 17l2.5 2.5M20.2 18.2l1-1" /></>,
];

function Icon({ i }: { i: number }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[i]}
    </svg>
  );
}

export function Principles() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "he" || saved === "en") setLang(saved);
    } catch {
      /* storage blocked: English */
    }
  }, []);
  const switchTo = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* not kept: this visit only */
    }
  };
  const c = P[lang];
  const rtl = lang === "he";

  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={lang} style={{ display: "flex", flexDirection: "column" }}>
      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 64, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1040, width: "100%", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="eyebrow" style={rtl ? { letterSpacing: 0, fontFamily: "var(--sans)", fontWeight: 600 } : undefined}>{c.eyebrow}</div>
          <button type="button" onClick={() => switchTo(rtl ? "en" : "he")} className="btn btn-ghost" style={{ fontSize: 14, minHeight: 40 }} aria-label={rtl ? "Switch to English" : "עבור לעברית"}>
            {c.lang}
          </button>
        </div>
        <Emblem size={132} label={c.title} />
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(36px, 5.6vw, 64px)", lineHeight: 1.04, letterSpacing: rtl ? "0" : "-0.035em", fontWeight: 700 }}>{c.title}</h1>
        <p style={{ margin: 0, fontSize: 22, lineHeight: 1.45, fontWeight: 600, color: "var(--teal)" }}>{c.lead}</p>
        {c.intro.map((x) => <p key={x} className="lede" style={{ fontSize: 18, maxWidth: 820 }}>{x}</p>)}
      </section>

      {/* THE DIAGRAM: from the commandments to practice */}
      <section className="wrap" style={{ paddingBottom: 48, maxWidth: 1040, width: "100%", marginLeft: "auto", marginRight: "auto" }}>
        <figure style={{ margin: 0, background: "var(--night)", color: "var(--snow)", borderRadius: 18, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <figcaption className="mono" style={{ fontSize: 11, letterSpacing: rtl ? 0 : "0.1em", color: "var(--snow-3)" }}>{c.diagramCaption}</figcaption>
          <div style={{ border: "1.5px dashed #1F4D47", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#5EEAD4", fontWeight: 600 }}>{c.frame}</div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {c.stages.map(([label, nums], i) => (
                <li key={label} style={{ position: "relative", background: i === 3 ? "#0E1A19" : "var(--night-3)", border: `1px solid ${i === 3 ? "var(--teal-mid)" : "var(--night-line-2)"}`, borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 6, minHeight: 96 }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--teal-hi)" }}>{i + 1} {rtl ? "←" : "→"}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{label}</span>
                  <span className="mono" dir="ltr" style={{ fontSize: 11, color: "var(--snow-3)", alignSelf: "flex-start" }}>#{nums}</span>
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--snow-2)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M20 8a8 8 0 0 0-14-2M4 4v3h3" /><path d="M4 16a8 8 0 0 0 14 2M20 20v-3h-3" /></svg>
              {c.loop}
            </div>
          </div>
        </figure>
      </section>

      {/* THE TEN */}
      <section className="wrap" style={{ paddingBottom: 56, maxWidth: 1040, width: "100%", marginLeft: "auto", marginRight: "auto" }}>
        <p style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 600 }}>{c.start}</p>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {c.items.map(([h, b], i) => (
            <li key={h} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, display: "flex", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "none" }}>
                <span className="mono" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{i + 1}</span>
                <span style={{ color: "var(--teal)" }}><Icon i={i} /></span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 19, fontWeight: 700, lineHeight: 1.3, letterSpacing: rtl ? 0 : "-0.01em" }}>{h}</h2>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* USE THEM: anything that helps behaviour is welcome; none of it replaces control and proof */}
      <section className="wrap" style={{ paddingBottom: 64, maxWidth: 1040, width: "100%", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28, padding: 28, borderRadius: 16, background: "var(--paper-2)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(22px, 2.6vw, 28px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: rtl ? 0 : "-0.02em" }}>{c.use.title}</h2>
            {c.use.body.map((x) => <p key={x} style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)" }}>{x}</p>)}
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, alignSelf: "center", minWidth: 0 }}>
            {c.use.line.map((x, i) => (
              <li key={x} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "12px 16px", borderRadius: 10, background: "var(--card)", border: "1px solid var(--line)", fontSize: 17, fontWeight: i === 0 ? 500 : 700 }}>
                <span className="mono" style={{ fontSize: 12, color: i === 0 ? "var(--faint)" : "var(--teal)", flex: "none" }}>{c.use.labels[i]}</span>
                <span>{x}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CLOSING */}
      <section className="dark">
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, maxWidth: 1040, width: "100%", marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(26px, 3.6vw, 40px)", lineHeight: 1.15, fontWeight: 700, letterSpacing: rtl ? 0 : "-0.025em" }}>{c.closingTitle}</p>
          {c.closing.map((x) => <p key={x} className="lede" style={{ maxWidth: 820 }}>{x}</p>)}
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <span dir="ltr" style={{ fontSize: 20, fontWeight: 600, color: "var(--teal-hi)", textAlign: rtl ? "right" : "left" }}>{P.tagline}</span>
            <span dir="ltr" className="mono" style={{ fontSize: 14, color: "var(--snow-2)", textAlign: rtl ? "right" : "left" }}>{P.brand}</span>
          </div>
        </div>
      </section>

      {/* BETWEEN THE TWO: the one sentence, then the legal agreement */}
      <section style={{ background: "var(--paper-2)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 64, paddingBottom: 64, maxWidth: 1040, width: "100%", marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
          <blockquote style={{ margin: 0, padding: rtl ? "0 20px 0 0" : "0 0 0 20px", borderInlineStart: "4px solid var(--teal-mid)", fontFamily: "var(--display)", fontSize: "clamp(24px, 3.2vw, 36px)", lineHeight: 1.25, fontWeight: 700, letterSpacing: rtl ? 0 : "-0.02em" }}>
            {c.highlight}
          </blockquote>
          <Link href="/terms/" className="btn btn-ink" style={{ alignSelf: "flex-start" }}>{c.toTerms}</Link>
        </div>
      </section>
    </div>
  );
}
