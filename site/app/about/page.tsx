import type { Metadata } from "next";
import Link from "next/link";
import { facts } from "@/lib/facts";
import { links } from "@/lib/links";
import { Social } from "@/components/Social";

export const metadata: Metadata = {
  title: "About",
  description: "Who builds What My Agent Saw, what is open, what is not, and how the site works.",
};

const PRINCIPLES: Array<[string, string]> = [
  ["Every fact comes from the code", `Versions, flags, categories and every verdict on this site are read from ${facts.package} when the site is built. If a page and the code disagree, the site does not build.`],
  ["Evidence, and its limits", "Every finding says what it shows and what it does not prove. Unknown is an answer. An attempt is not an exposure."],
  ["No numbers without a source", "We quote a measurement only after reading the primary study, with its method, scope and limits. Simulated data is marked as simulated."],
  ["You can argue with us", "The rules are plain patterns in the open. A wrong rule is an issue or a pull request, and the history of every change is public."],
];

export default function AboutPage() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 56, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000, marginLeft: "auto", marginRight: "auto" }}>
        <div className="eyebrow">About</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 700 }}>
          A place to see what AI agents actually do with the access you gave them.
        </h1>
        <p className="lede" style={{ fontSize: 19, maxWidth: 780 }}>
          Agents read files, run commands and fetch pages on your behalf. Most of it is invisible unless you go looking. What My Agent Saw is where you go looking: a free tool that reads your agent&apos;s own history, a lab that teaches how to read the evidence, and research on where agents can be misled.
        </p>
      </section>

      {/* VISION */}
      <section className="dark">
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="eyebrow">The vision</div>
          <p style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(34px, 5vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 700, maxWidth: 1000 }}>
            Control and sovereignty in the age of <span style={{ color: "var(--teal-hi)" }}>AI.</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
            {[
              ["Your information", "Agents may use it. They do not own it, and it does not have to leave your hands for them to work."],
              ["People hold the keys", "An agent can ask. A person, or a rule a person set, decides. An agent is never the one who approves."],
              ["The owner sets the rules", "Every action an agent takes on your information follows rules you can read, change, and check afterwards."],
            ].map(([h, b]) => (
              <div key={h} style={{ border: "1px solid var(--night-line)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{h}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "#9AA4AD" }}>{b}</span>
              </div>
            ))}
          </div>
          <p className="lede" style={{ marginTop: 8 }}>Information moves. Control stays. Seeing what agents do is the first step.</p>
        </div>
      </section>

      {/* WHO */}
      <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 40 }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="eyebrow">Who builds it</div>
            <h2 className="h2" style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>Maintained by NoData.</h2>
            <p className="lede">
              <a href={links.nodata}>NoData</a> builds the layer that decides what an agent may do with information: which file it may read, which key it may use, which step needs a person. Before you can decide that, you need to see what agents do today. This site is that first step, and it is useful on its own.
            </p>
            <p className="lede">
              The free check and NoData&apos;s gate classify with the same open rules (<a href={links.rules}>agent-rules.ts</a>): what this site counts is what the gate looks at. The difference is when. The check reads history after the fact; the gate decides before a step runs.
            </p>
            <p className="lede" style={{ fontWeight: 500, color: "var(--ink)" }}>You do not need NoData to use anything here.</p>
          </div>
          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--teal)" }}>OPEN · {facts.license.toUpperCase()}</span>
              <span style={{ fontSize: 15, lineHeight: 1.55 }}>
                <code>{facts.package}</code>: agent-check, its rules, the event format, and the verifiers that check NoData&apos;s own claims without trusting NoData. This site&apos;s code too.
              </span>
              <a href={links.repo} style={{ fontSize: 14 }}>daviderez4/nodatachat-core ↗</a>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>NOT OPEN</span>
              <span style={{ fontSize: 15, lineHeight: 1.55 }}>
                NoData&apos;s product: the gate, the server and the enforcement behind them. Only the verification layer is open source.
              </span>
            </div>
            <a href={links.nodata} className="btn btn-ink" style={{ alignSelf: "flex-start" }}>Visit NoData →</a>
          </div>
        </div>
      </section>

      {/* FOLLOW */}
      <section className="wrap" style={{ paddingTop: 72 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Follow the work</div>
        <Social />
      </section>

      {/* HOW */}
      <section className="wrap" style={{ paddingTop: 72, paddingBottom: 56 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>How we work</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {PRINCIPLES.map(([h, b]) => (
            <div key={h} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: "var(--display)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{h}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* THIS SITE */}
      <section className="wrap" style={{ paddingTop: 16, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 460px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow">This site</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>
            A static site: no accounts, no cookies, no analytics, and no request to anyone else. Fonts and scripts are served from this domain. The host keeps ordinary request logs, as every web host does.
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>
            The check itself runs on your computer. Nothing it reads is sent here, or anywhere.
          </p>
        </div>
        <div style={{ flex: "1 1 360px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow">Get in touch</div>
          <a href={links.newIssue}>A wrong rule, a scenario to add, a question: open an issue ↗</a>
          <a href={links.security}>A vulnerability: the security policy ↗</a>
          <a href={links.nodata}>Enforcement for a team: NoData ↗</a>
          <Link href="/lab/" style={{ marginTop: 6 }}>Or start with the lab →</Link>
        </div>
      </section>
    </>
  );
}
