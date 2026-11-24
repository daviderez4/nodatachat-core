import type { Metadata } from "next";
import { facts, RUN } from "@/lib/facts";
import { copy, T } from "@/lib/copy";
import { CopyCommand } from "@/components/CopyCommand";

const c = copy.next;

export const metadata: Metadata = {
  title: "What to do with your report",
  description: c.metaDescription,
};

// Commands come from the tool's own code (generated/facts.json), never from the copy.
const COMMANDS: Record<string, string> = {
  run: RUN,
  events: `${RUN} --events`,
  gate: facts.gateCommand,
};

// Claude Code's own deny rules: a setting of the agent, not of NoData. Paths to adapt.
const CLAUDE_DENY = `{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  }
}`;

export default function NextPage() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000, marginLeft: "auto", marginRight: "auto" }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6.4vw, 72px)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 700 }}>{c.title}</h1>
        <p className="lede" style={{ fontSize: 19, maxWidth: 760 }}>{c.lede}</p>
        <p className="mono" style={{ margin: 0, fontSize: 13, color: "var(--teal)" }}>{c.promise}</p>
      </section>

      {/* THE SIX STEPS */}
      <section className="wrap" style={{ paddingBottom: 80, maxWidth: 1000, marginLeft: "auto", marginRight: "auto" }}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          {c.steps.map((s, i) => {
            const last = i === c.steps.length - 1;
            const step = s as { title: string; body: string; cmd?: string; note?: string; snippet?: string };
            return (
              <li key={s.title} id={`step-${i + 1}`} style={{ display: "flex", gap: 22, scrollMarginTop: 80 }}>
                {/* the rail: one number per step, joined, so the order reads at a glance */}
                <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                  <span className="mono" style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, background: last ? "var(--ink)" : "var(--card)", color: last ? "var(--paper)" : "var(--ink)", border: `1.5px solid ${last ? "var(--ink)" : "var(--teal-mid)"}` }}>{i + 1}</span>
                  {!last ? <span style={{ flex: 1, width: 2, background: "var(--line-2)", margin: "6px 0" }} /> : null}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 36, display: "flex", flexDirection: "column", gap: 12 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{c.stepLabel} {i + 1} / {c.steps.length}</span>
                  <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 26, letterSpacing: "-0.02em", fontWeight: 700 }}>{step.title}</h2>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 760 }}><T s={step.body} /></p>
                  {step.cmd ? <div style={{ maxWidth: 760 }}><CopyCommand command={COMMANDS[step.cmd]} /></div> : null}
                  {step.note ? <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}><T s={step.note} /></p> : null}
                  {step.snippet === "claude-deny" ? (
                    <pre style={{ margin: 0, maxWidth: 760, padding: 16, borderRadius: 10, background: "var(--night)", color: "#D5DBE0", fontSize: 13, lineHeight: 1.6, overflowX: "auto" }}>
                      <span style={{ color: "#6E7A84" }}>{"// .claude/settings.json in your project (adapt the paths)\n"}</span>
                      {CLAUDE_DENY}
                    </pre>
                  ) : null}
                  {last ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                      <div style={{ flex: "1 1 320px", minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--teal)" }}>{c.nodataAddsTitle}</span>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.5 }}>
                          {c.nodataAdds.map((x) => <li key={x}>{x}</li>)}
                        </ul>
                      </div>
                      <div style={{ flex: "1 1 280px", minWidth: 0, background: "var(--paper-2)", border: "1px dashed var(--line-2)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{c.nodataLimitsTitle}</span>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)" }}>
                          {c.nodataLimits.map((x) => <li key={x}>{x}</li>)}
                        </ul>
                      </div>
                      <p style={{ margin: 0, flexBasis: "100%", fontSize: 13, color: "var(--faint)" }}>{c.cardHint} <code>{facts.cardCommand}</code></p>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* BY FINDING */}
      <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 80, display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="eyebrow">{c.byCategoryEyebrow}</div>
          <h2 className="h2">{c.byCategoryTitle}</h2>
          <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr className="mono" style={{ fontSize: 11, color: "var(--faint)", textAlign: "left" }}>
                  {c.byCategoryHead.map((h) => <th key={h} scope="col" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {facts.categories.map((cat) => {
                  const row = (c.byCategory as Record<string, string[]>)[cat];
                  return (
                    <tr key={cat}>
                      <th scope="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", textAlign: "left", verticalAlign: "top" }}>
                        <span style={{ display: "block", fontWeight: 600 }}>{facts.labels[cat]}</span>
                        <code style={{ fontSize: 11, color: "var(--teal)", fontWeight: 400 }}>{cat}</code>
                      </th>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", color: "var(--muted)", verticalAlign: "top" }}>{row[0]}</td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", verticalAlign: "top" }}>{row[1]}</td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", color: "var(--muted)", verticalAlign: "top" }}>{row[2]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 8, maxWidth: 900 }}>
            <span style={{ fontWeight: 600 }}>{c.outsideTitle}</span>
            <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>{c.outside}</span>
          </div>
        </div>
      </section>
    </>
  );
}
