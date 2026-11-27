import type { Metadata } from "next";
import { RUN } from "@/lib/facts";
import { copy, T } from "@/lib/copy";
import { tools } from "@/lib/toolbox";
import { CopyCommand } from "@/components/CopyCommand";
import { Toolbox } from "@/components/Toolbox";

const c = copy.toolbox;

export const metadata: Metadata = {
  title: "Enforcement toolbox",
  description: c.metaDescription,
};

export default function ToolboxPage() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6.4vw, 72px)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 700, maxWidth: 1000 }}>{c.title}</h1>
        <p className="lede" style={{ fontSize: 19, maxWidth: 760 }}>{c.lede}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640, marginTop: 6 }}>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>{c.checkFirst}</span>
          {/* The command comes from the tool's own code (generated/facts.json), never from the copy. */}
          <CopyCommand command={RUN} />
        </div>
      </section>

      <Toolbox tools={tools} c={c} />

      {/* POLICY: the rules themselves live on /next/, so they are not repeated here. */}
      <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 64, paddingBottom: 64, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="eyebrow">{c.policyEyebrow}</div>
          <h2 className="h2">{c.policyTitle}</h2>
          <p className="lede" style={{ maxWidth: 760 }}>{c.policyLede}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", fontSize: 16, fontWeight: 600 }}>
            <span><T s={c.policyNext} /></span>
            <span><T s={c.policyLab} /></span>
          </div>
        </div>
      </section>

      <section className="dark">
        <div className="wrap" style={{ paddingTop: 64, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 className="h2">{c.ctaTitle}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", fontSize: 17, fontWeight: 600 }}>
            <span><T s={c.ctaEvidence} linkStyle={{ color: "var(--teal-hi)" }} /></span>
            <span><T s={c.ctaLab} linkStyle={{ color: "var(--teal-hi)" }} /></span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--snow-2)", maxWidth: 760 }}><T s={c.suggest} linkStyle={{ color: "var(--teal-hi)" }} /></p>
        </div>
      </section>
    </>
  );
}
