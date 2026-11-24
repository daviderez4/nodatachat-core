import type { Metadata } from "next";
import { facts, RUN } from "@/lib/facts";
import { links } from "@/lib/links";
import { Lab } from "@/components/Lab";

export const metadata: Metadata = {
  title: "Agent Exposure Lab",
  description: "Step through real agent tool calls: the evidence in the log, the limits of what it proves, and the decision the open rules make.",
};

const GLOSSARY: Array<[string, string, string]> = [
  ["ATTEMPTED", "The action was tried.", "var(--ink)"],
  ["SUCCEEDED", "The tool reported no error.", "var(--teal)"],
  ["EXPOSED", "Evidence that sensitive content reached the agent. Not proof a key is valid.", "var(--amber)"],
  ["UNKNOWN", "Not enough evidence to decide.", "var(--indigo)"],
  ["NO EVENT", "Outside every rule. Not recorded, which is not the same as safe.", "var(--faint)"],
];

export default function LabPage() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 28, display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="eyebrow">Lab 01 · Reading the evidence</div>
          <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6vw, 56px)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 700 }}>Agent Exposure Lab</h1>
          <p className="lede" style={{ fontSize: 18, maxWidth: 660 }}>
            {facts.lab.length} tool calls. For each: the evidence in the log, the limits of what it proves, and the decision the open rules make.
          </p>
        </div>
        <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "var(--faint)", alignItems: "flex-end", textAlign: "right" }}>
          <span style={{ color: "var(--amber)", border: "1px solid #f1d7ae", borderRadius: 4, padding: "3px 7px" }}>SIMULATED LOGS · REAL RULES</span>
          <span>decided at build time by the source of {facts.package} {facts.version}</span>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 28 }}>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, background: "var(--line-2)", border: "1px solid var(--line-2)", borderRadius: 12, overflow: "hidden" }}>
          {GLOSSARY.map(([k, d, c]) => (
            <div key={k} style={{ background: "var(--card)", padding: "14px 16px" }}>
              <dt className="mono" style={{ fontSize: 11, fontWeight: 700, color: c }}>{k}</dt>
              <dd style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap" style={{ paddingBottom: 72 }}>
        <Lab scenarios={facts.lab} code={facts.code} command={RUN} />
      </section>

      <section style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 32, display: "flex", flexWrap: "wrap", gap: "8px 24px", justifyContent: "space-between", fontSize: 13, color: "var(--faint)" }}>
          <span>The logs are simulated. No real files, keys or services are touched. The decisions come from the published code.</span>
          <span><a href={links.scenarios}>The scenarios</a> · <a href={links.newIssue}>Propose a scenario</a> · <a href={links.rules}>Argue with a rule</a></span>
        </div>
      </section>
    </>
  );
}
