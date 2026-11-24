import type { Metadata } from "next";
import { evidence } from "@/lib/evidence";
import { EvidenceCard } from "@/components/EvidenceCard";
import { copy } from "@/lib/copy";

const c = copy.evidence;

export const metadata: Metadata = {
  title: "Evidence",
  description: c.metaDescription,
};

export default function EvidencePage() {
  return (
    <section className="wrap" style={{ paddingTop: 64, paddingBottom: 80, maxWidth: 880, marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 28 }}>
      <div className="eyebrow">{c.eyebrow}</div>
      <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(36px, 5.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em", fontWeight: 700 }}>
        {c.title}
      </h1>
      <p className="lede" style={{ fontSize: 19, margin: 0 }}>
        {c.lede}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {c.rules.map(([t, b]) => (
          <div key={t} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, background: "var(--card)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>{b}</div>
          </div>
        ))}
      </div>
      {evidence.map((i) => <EvidenceCard key={i.id} item={i} />)}
    </section>
  );
}
