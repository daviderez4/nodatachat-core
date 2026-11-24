import Link from "next/link";
import { facts, RUN } from "@/lib/facts";
import { links } from "@/lib/links";
import { ActivityMap } from "@/components/ActivityMap";
import { CopyCommand } from "@/components/CopyCommand";
import { QuickstartTabs } from "@/components/QuickstartTabs";
import { Social } from "@/components/Social";

// The six calls of the homepage map, in the order they happen in the demo session.
const MAP_IDS = ["env", "aws", "src", "grep", "mcp", "curl"];

const FLAGS: Record<string, string> = {
  "--days": "The window, in days. Default 30, from 1 to 3650.",
  "--lang": "The report language: en (default) or he.",
  "--events": "The local report: one finding per line, with where. Printed only, never written.",
  "--json": "The report as JSON, instead of text.",
  "--out": "Where to write the HTML card. Default agent-check.html.",
  "--no-card": "Print the report, write no card.",
};

export default function Home() {
  const map = MAP_IDS.map((id) => facts.lab.find((s) => s.id === id)!).filter(Boolean);
  const t = facts.session.tally;
  const major = facts.version.split(".")[0];
  const base = `npx ${facts.package}@${major} agent-check`;

  return (
    <>
      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 88, paddingBottom: 40, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 26 }}>
        <div className="eyebrow">Make the invisible behavior of AI agents visible</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(44px, 8vw, 88px)", lineHeight: 0.98, letterSpacing: "-0.045em", fontWeight: 700, maxWidth: 1000 }}>
          What did your agent actually see?
        </h1>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.55, color: "var(--muted)", maxWidth: 700 }}>
          See what your AI agent attempted, what succeeded, and what actually reached it.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: "100%" }}>
          <CopyCommand command={RUN} />
          <a href="#map" className="btn btn-teal" style={{ minHeight: 56 }}>Explore a session ↓</a>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", fontSize: 13, color: "var(--faint)" }}>
          <span>Claude Code · Codex</span><span aria-hidden="true">·</span>
          <span>No account</span><span aria-hidden="true">·</span>
          <span>Reads your agent&apos;s history on your machine and sends nothing</span><span aria-hidden="true">·</span>
          <span>{facts.license}</span>
        </div>
        <p style={{ margin: "-10px 0 0", fontSize: 12, color: "#80868c", maxWidth: 640 }}>
          npx downloads the package from npm. After that the check makes no network request. <a href={links.history}>Read the source</a>
        </p>
      </section>

      {/* MAP */}
      <section id="map" className="wrap" style={{ paddingTop: 16, paddingBottom: 96 }}>
        <ActivityMap scenarios={map} />
        <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--faint)", textAlign: "center" }}>
          Every verdict above was computed by the published code, at build time, from the session&apos;s log. <a href={links.scenarios}>See the log</a> · <Link href="/lab/">Step through more in the lab →</Link>
        </p>
      </section>

      {/* THE TOOL */}
      <section id="check" style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="eyebrow">The tool</div>
            <h2 className="h2">Your own Agent Exposure Report, in one command.</h2>
            <p className="lede">It reads the history your agent already keeps on your computer and prints counts and category names. Never a path, a command or a value.</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 15, color: "var(--ink-2)" }}>
              <li style={{ display: "flex", gap: 10 }}><span className="mono" style={{ color: "var(--teal)" }}>→</span><span>Reads <code>~/.claude/projects</code> and <code>~/.codex/sessions</code>, nothing else</span></li>
              <li style={{ display: "flex", gap: 10 }}><span className="mono" style={{ color: "var(--teal)" }}>→</span><span>A floor, not a complete record: history that was deleted is not seen</span></li>
              <li style={{ display: "flex", gap: 10 }}><span className="mono" style={{ color: "var(--teal)" }}>→</span><span>Writes one HTML card where you run it, with no script and no paths (<code>--no-card</code> to skip)</span></li>
            </ul>
            <CopyCommand command={RUN} />
          </div>

          <figure style={{ flex: "1.4 1 560px", minWidth: 0, margin: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 24px 60px rgba(13,15,18,0.08)", overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 15 }}>Agent Exposure Report</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>the demo session · <span style={{ color: "var(--amber)" }}>DEMO</span></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", borderBottom: "1px solid var(--line)" }}>
              {[
                ["ATTEMPTED", t.events, "var(--ink)", "events"],
                ["SUCCEEDED", t.succeeded, "var(--teal)", "recorded as succeeded"],
                ["EXPOSED", t.yes, "var(--amber)", `${t.samples} of them a sample`],
                ["UNKNOWN", t.unknown, "var(--indigo)", "not enough evidence"],
              ].map(([k, n, c, sub]) => (
                <div key={k as string} style={{ padding: "18px 20px", borderRight: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{k}</div>
                  <div style={{ fontFamily: "var(--display)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4, color: c as string }}>{n}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)" }}>{sub}</div>
                </div>
              ))}
            </div>
            <pre style={{ margin: 0, padding: "18px 20px", background: "var(--night)", color: "#D5DBE0", fontSize: 12, lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre" }}>
              <span style={{ color: "#5c6872" }}>$ {RUN}{"\n\n"}</span>
              {facts.session.lines.join("\n")}
            </pre>
            <figcaption style={{ padding: "12px 20px 16px", fontSize: 12, color: "var(--faint)" }}>
              This is the CLI&apos;s real output for the {t.calls} demo calls above, produced by the report code at build time. Your report shows your own counts.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* DEVELOPERS */}
      <section id="developers" className="dark">
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="eyebrow">Developers</div>
              <h2 className="h2">Not just to read. To work.</h2>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span className="chip" style={{ borderColor: "#1F4D47", color: "var(--teal-hi)" }}>v{facts.version}</span>
              <span className="chip">Node {facts.node}</span>
              <span className="chip">{facts.license}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            <div style={{ flex: "1.3 1 520px", minWidth: 0, background: "var(--night-2)", border: "1px solid var(--night-line)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ fontSize: 13, color: "#6E7A84" }}>Quickstart</div>
              <h3 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>Check your agent in one minute</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--snow-2)" }}>No install, no account. The package runs from npm, reads your agent&apos;s own history, and prints a report.</p>
              <QuickstartTabs
                tabs={[
                  { label: "Run", comment: "the last 30 days", cmd: base },
                  { label: "--days", comment: "a longer window", cmd: `${base} --days 90` },
                  { label: "--events", comment: "one local finding per line, event format v1", cmd: `${base} --events` },
                  { label: "--lang he", comment: "the report in Hebrew", cmd: `${base} --lang he` },
                ]}
              />
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                <a href={links.readme} style={{ color: "var(--teal-hi)" }}>Full documentation ↗</a>
                <a href={links.protect} style={{ color: "var(--teal-hi)" }}>Read the source ↗</a>
              </div>
            </div>
            <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ background: "var(--night-2)", border: "1px solid var(--night-line)", borderRadius: 16, padding: 24 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--snow-3)", marginBottom: 12 }}>CLI REFERENCE · agent-check</div>
                <dl style={{ margin: 0, display: "flex", flexDirection: "column" }}>
                  {facts.flags.map((f) => (
                    <div key={f} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, padding: "9px 0", borderBottom: "1px solid #161C22" }}>
                      <dt className="mono" style={{ fontSize: 13, color: "var(--teal-hi)" }}>{f}</dt>
                      <dd style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--snow-2)" }}>{FLAGS[f]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div style={{ background: "var(--night-2)", border: "1px solid var(--night-line)", borderRadius: 16, padding: 24 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--snow-3)", marginBottom: 12 }}>CHANGELOG</div>
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {facts.changelog.slice(0, 3).map((c) => (
                    <li key={c.version + c.title} style={{ display: "flex", gap: 16, padding: "9px 0", borderBottom: "1px solid #161C22" }}>
                      <span className="mono" style={{ fontSize: 13, color: "var(--teal-hi)", width: 48, flex: "none" }}>{c.version}</span>
                      <span style={{ fontSize: 14, color: "#D5DBE0" }}>{c.title}</span>
                    </li>
                  ))}
                </ol>
                <a href={links.readme} style={{ display: "inline-block", marginTop: 12, fontSize: 14, color: "var(--teal-hi)" }}>All versions ↗</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AFTER YOUR FIRST CHECK */}
      <section id="threats" className="wrap" style={{ paddingTop: 96, paddingBottom: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 780, marginBottom: 32 }}>
          <div className="eyebrow">Threat library</div>
          <h2 className="h2">Five things agents reach for. Every one is a rule you can read.</h2>
          <p className="lede">The categories below are the ones the tool counts, named as the tool prints them. Each links to its pattern in the open code.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "var(--line-2)", border: "1px solid var(--line-2)", borderRadius: 16, overflow: "hidden" }}>
          {facts.categories.map((c) => (
            <a key={c} href={links.rules} style={{ background: "var(--card)", padding: 24, display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)", minHeight: 170, textDecoration: "none" }}>
              <code style={{ fontSize: 12, color: "var(--teal)" }}>{c}</code>
              <span style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.25 }}>{facts.labels[c]}</span>
              <span className="mono" style={{ marginTop: "auto", fontSize: 12, color: "var(--faint)" }}>agent-rules.ts ↗</span>
            </a>
          ))}
        </div>
      </section>

      <section id="research" className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 780, marginBottom: 32 }}>
          <div className="eyebrow">After your first check</div>
          <h2 className="h2">Learn what agents really do with the access you gave them.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Link href="/lab/" style={{ background: "var(--night)", color: "var(--snow)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12, minHeight: 230, textDecoration: "none", backgroundImage: "radial-gradient(circle at 85% 15%, rgba(20,184,166,0.25), transparent 50%)" }}>
            <span className="mono" style={{ fontSize: 11, color: "#5EEAD4" }}>LAB · OPEN NOW</span>
            <span style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>Agent Exposure Lab</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--snow-2)" }}>{facts.lab.length} scenarios. The evidence, the limits of the conclusion, and the decision, step by step.</span>
            <span style={{ marginTop: "auto", fontSize: 14, color: "var(--teal-hi)" }}>Open the lab →</span>
          </Link>
          <a href={links.newIssue} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)", textDecoration: "none" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--teal)" }}>CONTRIBUTE</span>
            <span style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Argue with a rule</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>A pattern that misses, a scenario the lab should have, a false alarm. Open an issue.</span>
            <span style={{ marginTop: "auto", fontSize: 14, color: "var(--teal)" }}>Open an issue ↗</span>
          </a>
          <a href={links.releases} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)", textDecoration: "none" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--teal)" }}>RELEASES</span>
            <span style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Watch the repository</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>New rules and versions land there first. Latest: {facts.changelog[0].version}, {facts.changelog[0].title.toLowerCase()}.</span>
            <span style={{ marginTop: "auto", fontSize: 14, color: "var(--teal)" }}>On GitHub ↗</span>
          </a>
          <Link href="/agentic-web/" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)", textDecoration: "none" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--teal)" }}>RESEARCH · THE AGENTIC WEB</span>
            <span style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>When search results become attack vectors</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>Four ways an agent is compromised by what it reads, and where your history&apos;s view ends.</span>
            <span style={{ marginTop: "auto", fontSize: 14, color: "var(--teal)" }}>Read it →</span>
          </Link>
        </div>
      </section>

      {/* BUILT IN THE OPEN */}
      <section className="wrap" style={{ paddingTop: 24, paddingBottom: 96 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="eyebrow">Built in the open</div>
            <h2 className="h2">Read the code. Follow the work.</h2>
          </div>
          <Link href="/about/" style={{ fontSize: 15 }}>Who is behind this →</Link>
        </div>
        <Social />
      </section>

      {/* VISION */}
      <section className="dark" style={{ borderBottom: "1px solid var(--night-line)" }}>
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 22 }}>
          <div className="eyebrow">The vision</div>
          <p style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(38px, 6vw, 72px)", lineHeight: 1.0, letterSpacing: "-0.045em", fontWeight: 700, maxWidth: 1060 }}>
            Control and sovereignty in the age of <span style={{ color: "var(--teal-hi)" }}>AI.</span>
          </p>
          <p className="lede" style={{ maxWidth: 720, fontSize: 19 }}>
            Agents will read, decide and act for us. The information stays yours, the keys stay with people, and the rules belong to whoever owns the data. Information moves. Control stays.
          </p>
          <p className="lede" style={{ maxWidth: 720 }}>It starts with seeing. Knowing what an agent meant to do is not enough: you need to know what actually happened.</p>
          <ol style={{ listStyle: "none", margin: "24px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              ["01 · The way in", "The checker", "See what your agent did, in one command."],
              ["02 · The reason to trust", "The method", "Evidence, limits and decisions, in the open."],
              ["03 · The reason to return", "The lab and the rules", "New scenarios, rules and releases."],
            ].map(([k, h, b]) => (
              <li key={k} style={{ border: "1px solid var(--night-line)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--teal-hi)", textTransform: "uppercase" }}>{k}</span>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{h}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: "#9AA4AD" }}>{b}</span>
              </li>
            ))}
            <li style={{ border: "1px solid #1F4D47", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8, background: "#0E1A19" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--teal-hi)" }}>04 · FROM VISIBILITY TO CONTROL</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>NoData</span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "#9AA4AD" }}>For teams that want to enforce what they now see. <a href={links.nodata} style={{ color: "var(--teal-hi)" }}>Learn more →</a></span>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
