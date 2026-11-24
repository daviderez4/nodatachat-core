import type { Metadata } from "next";
import { facts } from "@/lib/facts";
import { links } from "@/lib/links";
import { Social } from "@/components/Social";
import { copy, T } from "@/lib/copy";

const c = copy.about;

export const metadata: Metadata = {
  title: "About",
  description: c.metaDescription,
};


export default function AboutPage() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 56, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000, marginLeft: "auto", marginRight: "auto" }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 700 }}>
          {c.title}
        </h1>
        <p className="lede" style={{ fontSize: 19, maxWidth: 780 }}>
          {c.lede}
        </p>
      </section>

      {/* VISION */}
      <section className="dark">
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="eyebrow">{c.visionEyebrow}</div>
          <p style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(34px, 5vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 700, maxWidth: 1000 }}>
            {c.visionTitle} <span style={{ color: "var(--teal-hi)" }}>{c.visionAccent}</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
            {c.visionCards.map(([h, b]) => (
              <div key={h} style={{ border: "1px solid var(--night-line)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{h}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "#9AA4AD" }}>{b}</span>
              </div>
            ))}
          </div>
          <p className="lede" style={{ marginTop: 8 }}><T s={c.visionClose} linkStyle={{ color: "var(--teal-hi)" }} /></p>
        </div>
      </section>

      {/* WHO */}
      <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 40 }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="eyebrow">{c.whoEyebrow}</div>
            <h2 className="h2" style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>{c.whoTitle}</h2>
            {c.who.map((w) => <p key={w} className="lede"><T s={w} /></p>)}
            <p className="lede" style={{ fontWeight: 500, color: "var(--ink)" }}>{c.whoClose}</p>
          </div>
          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--teal)" }}>{c.openKicker} · {facts.license.toUpperCase()}</span>
              <span style={{ fontSize: 15, lineHeight: 1.55 }}><T s={c.open} /></span>
              <a href={links.repo} style={{ fontSize: 14 }}>daviderez4/nodatachat-core ↗</a>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>{c.notOpenKicker}</span>
              <span style={{ fontSize: 15, lineHeight: 1.55 }}>{c.notOpen}</span>
            </div>
            <a href={links.nodata} className="btn btn-ink" style={{ alignSelf: "flex-start" }}>{c.visitButton}</a>
          </div>
        </div>
      </section>

      {/* FOLLOW */}
      <section className="wrap" style={{ paddingTop: 72 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>{c.followEyebrow}</div>
        <Social />
      </section>

      {/* HOW */}
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 56 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>{c.howEyebrow}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {c.principles.map(([h, b]) => (
            <div key={h} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: "var(--display)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{h}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}><T s={b} /></span>
            </div>
          ))}
        </div>
      </section>

      {/* THIS SITE */}
      <section className="wrap" style={{ paddingTop: 16, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 460px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow">{c.siteEyebrow}</div>
          {c.site.map((x) => <p key={x} style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>{x}</p>)}
        </div>
        <div style={{ flex: "1 1 360px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow">{c.contactEyebrow}</div>
          {c.contact.map((x) => <span key={x}><T s={x} /></span>)}
        </div>
      </section>
    </>
  );
}
