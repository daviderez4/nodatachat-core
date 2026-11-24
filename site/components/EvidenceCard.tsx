import Link from "next/link";
import type { EvidenceItem } from "@/lib/evidence";
import { LEGAL_LABEL, TECH_LABEL, TYPE_LABEL } from "@/lib/evidence";
import { ShareLinks } from "./ShareLinks";

const chip = (text: string, color: string) => (
  <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color, border: `1px solid ${color}`, borderRadius: 999, padding: "2px 10px" }}>{text}</span>
);

/** One item: what the source says (its words), what we take from it, and where it stops. */
export function EvidenceCard({ item, headingLevel = 2, link = true }: { item: EvidenceItem; headingLevel?: 1 | 2; link?: boolean }) {
  const H = headingLevel === 1 ? "h1" : "h2";
  return (
    <article id={item.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {chip(TYPE_LABEL[item.event_type] ?? item.event_type, "var(--ink-2)")}
        {item.technical_status && chip(TECH_LABEL[item.technical_status], item.technical_status === "exposed" ? "var(--amber)" : "var(--muted)")}
        {item.legal_stage !== "not_legal" && chip(LEGAL_LABEL[item.legal_stage], "var(--indigo)")}
        {item.stale && chip("Needs re-verification", "var(--amber)")}
        <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>{item.date ?? "no date given by the source"} · {item.jurisdiction}</span>
      </div>
      <H style={{ margin: 0, fontFamily: "var(--display)", fontSize: headingLevel === 1 ? "clamp(28px, 4vw, 40px)" : 21, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
        {link ? <Link href={`/evidence/${item.id}/`} style={{ color: "inherit" }}>{item.headline}</Link> : item.headline}
      </H>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>{item.claim}</p>
      <blockquote style={{ margin: 0, padding: "10px 16px", borderLeft: "3px solid var(--teal)", background: "var(--paper-2)", fontFamily: "var(--serif)", fontSize: 16, lineHeight: 1.55 }}>
        “{item.quote}”
        <footer style={{ marginTop: 8, fontFamily: "var(--sans)", fontSize: 13 }}>
          <a href={item.source_url} rel="noopener noreferrer">{item.source_name} ↗</a>
          <span style={{ color: "var(--faint)" }}> · opened and matched {item.last_verified}</span>
        </footer>
      </blockquote>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}><strong>Why it matters.</strong> {item.why}</p>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}><strong>Where it stops.</strong> {item.limits}</p>
      <ShareLinks item={item} />
    </article>
  );
}
