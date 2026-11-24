import type { Metadata } from "next";
import { evidence } from "@/lib/evidence";
import { EvidenceCard } from "@/components/EvidenceCard";

export const metadata: Metadata = {
  title: "Evidence",
  description: "Who controls what AI can access, what can be proven, and what remains unknown. Every item opened at its source and quoted word for word.",
};

const RULES: Array<[string, string]> = [
  ["Source before summary", "Every item links to the original document, quotes it word for word, and says when it was last opened. No secondary articles, no tracking links."],
  ["Evidence before conclusion", "A filed claim is an allegation. Legal items name their stage: allegation, evidence filed, finding of fact, court decision, final judgment."],
  ["Unknown is not safe", "When a source does not say what reached the agent, the item says unknown. A missing report is never shown as proof that nothing happened."],
];

export default function EvidencePage() {
  return (
    <section className="wrap" style={{ paddingTop: 64, paddingBottom: 80, maxWidth: 880, marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 28 }}>
      <div className="eyebrow">Research · Evidence</div>
      <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(36px, 5.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em", fontWeight: 700 }}>
        We don't just track what AI does.
      </h1>
      <p className="lede" style={{ fontSize: 19, margin: 0 }}>
        We study who controls what AI can access, what can be proven, and what remains unknown.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {RULES.map(([t, b]) => (
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
