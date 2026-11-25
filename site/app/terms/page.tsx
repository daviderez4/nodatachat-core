import type { Metadata } from "next";
import Link from "next/link";
import { copy, T } from "@/lib/copy";

const c = copy.terms;

export const metadata: Metadata = {
  title: "Terms",
  description: c.metaDescription,
};

export default function TermsPage() {
  return (
    <>
    {/* The principles come first, set apart from the legal agreement below. */}
    <section style={{ background: "var(--night)", color: "var(--snow)" }}>
      <Link href="/principles/" className="wrap" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 40, paddingBottom: 40, maxWidth: 820, marginLeft: "auto", marginRight: "auto", color: "inherit", textDecoration: "none" }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "#5EEAD4" }}>{c.principlesKicker}</span>
        <span style={{ fontFamily: "var(--display)", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{c.principlesTitle}</span>
        <span style={{ fontSize: 15, lineHeight: 1.6, color: "var(--snow-2)" }}>{c.principlesBody}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--teal-hi)" }}>{c.principlesLink}</span>
      </Link>
    </section>
    <section className="wrap" style={{ paddingTop: 56, paddingBottom: 88, maxWidth: 820, marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(36px, 5vw, 52px)", lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 700 }}>{c.title}</h1>
        <p className="mono" style={{ margin: 0, fontSize: 12, color: "var(--faint)" }}>{c.updated}: {c.version}</p>
        <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.6, fontWeight: 500, padding: 16, borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--line)" }}>{c.intro}</p>
      </div>
      {c.sections.map(([h, b], i) => (
        <section key={h} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{i + 1}. {h}</h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)" }}><T s={b} /></p>
        </section>
      ))}
    </section>
    </>
  );
}
