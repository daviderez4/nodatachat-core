import type { Metadata } from "next";
import { copy, T } from "@/lib/copy";

const c = copy.terms;

export const metadata: Metadata = {
  title: "Terms",
  description: c.metaDescription,
};

export default function TermsPage() {
  return (
    <section className="wrap" style={{ paddingTop: 72, paddingBottom: 88, maxWidth: 820, marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(36px, 5vw, 52px)", lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 700 }}>{c.title}</h1>
        <p className="mono" style={{ margin: 0, fontSize: 12, color: "var(--faint)" }}>{c.updated}: {c.version}</p>
      </div>
      {c.sections.map(([h, b], i) => (
        <section key={h} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{i + 1}. {h}</h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)" }}><T s={b} /></p>
        </section>
      ))}
    </section>
  );
}
