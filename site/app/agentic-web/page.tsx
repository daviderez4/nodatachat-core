import type { Metadata } from "next";
import { facts } from "@/lib/facts";
import { links } from "@/lib/links";
import { AgenticWeb } from "@/components/AgenticWeb";
import { copy, T } from "@/lib/copy";

const c = copy.agenticWeb;

export const metadata: Metadata = {
  title: "The Agentic Web",
  description: c.metaDescription,
};



export default function AgenticWebPage() {
  const rows = facts.agenticWeb.map((s) => {
    const recorded = s.calls.filter((c) => c.decided.length);
    const row = (c.rows as Record<string, string[]>)[s.id];
    return { id: s.id, title: s.title, happens: row[0], cannot: row[1], sees: recorded.length ? `${recorded.length} of ${s.calls.length} calls: ${recorded.flatMap((c) => c.decided.map((e) => e.category)).join(", ")}` : `No event for any of its ${s.calls.length} calls` };
  });

  return (
    <>
      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1080, marginLeft: "auto", marginRight: "auto" }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6.4vw, 72px)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 700 }}>
          {c.title}
        </h1>
        <p className="lede" style={{ fontSize: 19, maxWidth: 760 }}>{c.lede}</p>
      </section>

      {/* THREE LAYERS */}
      <section className="wrap" style={{ paddingBottom: 72 }}>
        <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)" }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr className="mono" style={{ fontSize: 11, color: "var(--faint)", textAlign: "left" }}>
                {c.layersHead.map((h) => <th key={h} scope="col" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {c.layers.map(([l, q, n, w]) => (
                <tr key={l} style={{ background: l === "Exposure" ? "#f3fbfa" : undefined }}>
                  <th scope="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", textAlign: "left", fontFamily: "var(--display)", fontSize: 16 }}>{l}</th>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>{q}</td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>{n}</td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SCENARIOS */}
      <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 820 }}>
            <div className="eyebrow">{c.scenariosEyebrow}</div>
            <h2 className="h2">{c.scenariosTitle}</h2>
            <p className="lede">{c.scenariosLede}</p>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)" }}>
            <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr className="mono" style={{ fontSize: 11, color: "var(--faint)", textAlign: "left" }}>
                  {c.tableHead.map((h) => <th key={h} scope="col" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", textAlign: "left", fontWeight: 600 }}>{r.title}</th>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>{r.happens}</td>
                    <td className="mono" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontSize: 12 }}>{r.sees}</td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>{r.cannot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AgenticWeb scenarios={facts.agenticWeb} />
        </div>
      </section>

      {/* VISIBILITY / ENFORCEMENT */}
      <section className="dark">
        <div className="wrap" style={{ paddingTop: 88, paddingBottom: 88, display: "flex", flexDirection: "column", gap: 28 }}>
          <p style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 700, maxWidth: 1000 }}>
            {c.visibility} <span style={{ color: "var(--teal-hi)" }}>{c.enforcement}</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {c.principles.map(([h, b]) => (
              <div key={h} style={{ border: "1px solid var(--night-line)", borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{h}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "#9AA4AD" }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid #1F4D47", background: "#0E1A19", borderRadius: 12, padding: 22, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, lineHeight: 1.6, color: "var(--snow-2)", maxWidth: 820 }}>{c.nodata}</span>
            <a href={links.nodata} className="btn btn-teal">{c.nodataButton}</a>
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow">{c.sourcesEyebrow}</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--muted)", maxWidth: 720 }}>{c.sources}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          {c.sourcesLinks.map((x) => <span key={x}><T s={x} /></span>)}
        </div>
      </section>
    </>
  );
}
