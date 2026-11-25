import type { Metadata } from "next";
import { copy, T } from "@/lib/copy";
import { PrivacyRecord } from "@/components/PrivacyRecord";

const c = copy.privacy;

export const metadata: Metadata = {
  title: "Privacy",
  description: c.metaDescription,
};

// Sections 13 and 14 of the Privacy Protection Law: what is kept, and the door to see it or erase it.
export default function PrivacyPage() {
  const h2: React.CSSProperties = { margin: 0, fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" };
  const p: React.CSSProperties = { margin: 0, fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)" };
  return (
    <section className="wrap" style={{ paddingTop: 56, paddingBottom: 88, maxWidth: 820, marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(34px, 5vw, 50px)", lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 700 }}>{c.title}</h1>
        <p style={{ ...p, fontSize: 17 }}><T s={c.lede} /></p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={h2}>{c.keptTitle}</h2>
        <dl style={{ margin: 0, display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {c.kept.map(([what, why], i) => (
            <div key={what} style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", padding: "14px 16px", borderTop: i ? "1px solid var(--line)" : "none", background: "var(--card)" }}>
              <dt style={{ flex: "1 1 240px", fontWeight: 600, fontSize: 15 }}>{what}</dt>
              <dd style={{ flex: "2 1 300px", margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--ink-2)" }}>{why}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={h2}>{c.whoTitle}</h2>
        <p style={p}><T s={c.who} /></p>
      </div>

      <PrivacyRecord />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={h2}>{c.otherTitle}</h2>
        <p style={p}><T s={c.other} /></p>
      </div>
    </section>
  );
}
