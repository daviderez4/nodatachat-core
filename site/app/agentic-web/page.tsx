import type { Metadata } from "next";
import Link from "next/link";
import { facts } from "@/lib/facts";
import { links } from "@/lib/links";
import { AgenticWeb } from "@/components/AgenticWeb";

export const metadata: Metadata = {
  title: "The Agentic Web",
  description: "When search results become attack vectors: four ways an agent is compromised by what it reads, what your history can show, and what it cannot prove.",
};

// The overview table: one row per scenario, the middle column from what the code decided.
const ROWS: Record<string, { happens: string; cannot: string }> = {
  domain: { happens: "A lapsed docs domain is re-registered and serves a changed install line.", cannot: "Who controlled the domain when the agent read it." },
  readme: { happens: "A README addresses the agent and asks it to read a credential file.", cannot: "Whether the text is what made the agent act." },
  typo: { happens: "A search result names a look-alike package, and the agent installs it.", cannot: "Whether the result, or the package, could be trusted." },
  cloak: { happens: "A page serves the agent a version with a hidden instruction.", cannot: "What a person would have seen at the same moment." },
};

const LAYERS: Array<[string, string, string, string]> = [
  ["Source", "What content is the agent relying on?", "Who published it, and can it be trusted?", "Not what agent-check does. A source's address is not its identity."],
  ["Exposure", "What did the agent actually receive?", "Evidence of what was read, run, and returned.", "This is agent-check: what was attempted, what succeeded, what came back."],
  ["Execution", "May the action it now asks for happen?", "A decision before the action, by a rule a person set.", "Enforcement. Not a free tool reading history after the fact."],
];

export default function AgenticWebPage() {
  const rows = facts.agenticWeb.map((s) => {
    const recorded = s.calls.filter((c) => c.decided.length);
    return { id: s.id, title: s.title, ...ROWS[s.id], sees: recorded.length ? `${recorded.length} of ${s.calls.length} calls: ${recorded.flatMap((c) => c.decided.map((e) => e.category)).join(", ")}` : `No event for any of its ${s.calls.length} calls` };
  });

  return (
    <>
      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1080, marginLeft: "auto", marginRight: "auto" }}>
        <div className="eyebrow">Research · The Agentic Web</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6.4vw, 72px)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 700 }}>
          Your agent can be compromised by what it reads, before it executes anything.
        </h1>
        <p className="lede" style={{ fontSize: 19, maxWidth: 760 }}>
          Nobody needs to hack the model. It is enough to put the right words where agents look: a docs page, a README, a search result. The attack is on the information the agent decides from.
        </p>
      </section>

      {/* THREE LAYERS */}
      <section className="wrap" style={{ paddingBottom: 72 }}>
        <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)" }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr className="mono" style={{ fontSize: 11, color: "var(--faint)", textAlign: "left" }}>
                {["LAYER", "THE QUESTION", "WHAT IT TAKES", "WHERE THIS SITE STANDS"].map((h) => <th key={h} scope="col" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {LAYERS.map(([l, q, n, w]) => (
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
            <div className="eyebrow">Four scenarios</div>
            <h2 className="h2">What happens, what your history shows, what it cannot prove.</h2>
            <p className="lede">These are not attacks agent-check detects. They are a map of where its view ends. Each verdict below was computed by the published rules from the session&apos;s log.</p>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)" }}>
            <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr className="mono" style={{ fontSize: 11, color: "var(--faint)", textAlign: "left" }}>
                  {["SCENARIO", "WHAT HAPPENS", "WHAT AGENT-CHECK RECORDS", "WHAT IT CANNOT PROVE"].map((h) => <th key={h} scope="col" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>{h}</th>)}
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
            Visibility shows what happened. <span style={{ color: "var(--teal-hi)" }}>Enforcement controls what can happen next.</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {[
              ["Origin is not trust", "Knowing a page came from the web, or from an API, says where it came from. Not whether it can be believed."],
              ["A warning is not enforcement", "A step is stopped only where a rule says so. Anything that only warns should never be described as blocking."],
              ["Proof of a decision is not proof of truth", "A record can prove what was decided and enforced. It cannot prove that what the agent read was true or harmless."],
            ].map(([h, b]) => (
              <div key={h} style={{ border: "1px solid var(--night-line)", borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{h}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "#9AA4AD" }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid #1F4D47", background: "#0E1A19", borderRadius: 12, padding: 22, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, lineHeight: 1.6, color: "var(--snow-2)", maxWidth: 820 }}>
              NoData does not judge whether content is malicious. Its gate marks a session that read content from outside, and decides the next outbound step by the owner&apos;s rules: a warning by default, a person&apos;s approval where the owner&apos;s rule asks for one. Every decision leaves a record.
            </span>
            <a href={links.nodata} className="btn btn-teal">From visibility to control →</a>
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow">Sources</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--muted)", maxWidth: 720 }}>
            Measurements of how often search results carry malicious content will appear here only after we have read the primary study, with its method, scope and limits. We do not build on secondary quotes. The scenarios above use example domains and invented package names.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <Link href="/lab/">Step through the Exposure Lab →</Link>
          <a href={links.newIssue}>Propose a scenario ↗</a>
          <a href={`${links.repo}/blob/main/site/content/agentic-web.json`}>The scenarios as data ↗</a>
        </div>
      </section>
    </>
  );
}
