import Link from "next/link";
import { facts, published, RUN, sourceAhead } from "@/lib/facts";
import { links } from "@/lib/links";
import { copy, T } from "@/lib/copy";
import { ActivityMap } from "@/components/ActivityMap";
import { CopyCommand } from "@/components/CopyCommand";
import { QuickstartTabs } from "@/components/QuickstartTabs";
import { Social } from "@/components/Social";
import { Emblem } from "@/components/Emblem";
import { VideoInvite, WatchButton } from "@/components/VideoInvite";

// The six calls of the homepage map, in the order they happen in the demo session.
const MAP_IDS = ["env", "aws", "src", "grep", "mcp", "curl"];

export default function Home() {
  const c = copy.home;
  const map = MAP_IDS.map((id) => facts.lab.find((s) => s.id === id)!).filter(Boolean);
  const t = facts.session.tally;
  const major = facts.version.split(".")[0];
  const base = `npx ${facts.package}@${major} agent-check`;
  const tabs = c.developers.tabs;
  const metrics: Array<[string[], number, string]> = [
    [c.tool.metrics.attempted, t.events, "var(--ink)"],
    [c.tool.metrics.succeeded, t.succeeded, "var(--teal)"],
    [c.tool.metrics.exposed, t.yes, "var(--amber)"],
    [c.tool.metrics.unknown, t.unknown, "var(--indigo)"],
  ];
  const cardBase = { borderRadius: 16, padding: 28, display: "flex", flexDirection: "column" as const, gap: 12, textDecoration: "none" };
  const lightCard = { ...cardBase, background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)" };

  return (
    <>
      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 88, paddingBottom: 40, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 26 }}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h1 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(44px, 8vw, 88px)", lineHeight: 0.98, letterSpacing: "-0.045em", fontWeight: 700, maxWidth: 1000 }}>{c.title}</h1>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.55, color: "var(--muted)", maxWidth: 700 }}>{c.lede}</p>
        {/* The same promise in Hebrew. "Exposed" is the tool's own word: content that came back to the agent, never a leak outside. */}
        <p dir="rtl" lang="he" style={{ margin: "-14px 0 0", fontSize: 19, lineHeight: 1.5, fontWeight: 600, color: "var(--ink)", maxWidth: 700 }}>{c.ledeHe}</p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: "100%" }}>
          <CopyCommand command={RUN} />
          <WatchButton />
          <a href="#map" className="btn btn-teal" style={{ minHeight: 56 }}>{c.exploreButton}</a>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", fontSize: 13, color: "var(--faint)" }}>
          {c.badges.map((b, i) => (
            <span key={b} style={{ display: "contents" }}>
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              <span><T s={b} /></span>
            </span>
          ))}
        </div>
        <p style={{ margin: "-10px 0 0", fontSize: 12, color: "#80868c", maxWidth: 640 }}><T s={c.networkNote} /></p>
      </section>

      {/* MAP */}
      <section id="map" className="wrap" style={{ paddingTop: 16, paddingBottom: 96 }}>
        <ActivityMap scenarios={map} />
        <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--faint)", textAlign: "center" }}><T s={c.mapCaption} /></p>
      </section>

      {/* THE 10 PRINCIPLES: the site's own mark, right after the first thing it shows */}
      <section className="dark" style={{ borderTop: "1px solid var(--night-line)", borderBottom: "1px solid var(--night-line)", backgroundImage: "radial-gradient(circle at 12% 50%, rgba(20,184,166,0.18), transparent 45%)" }}>
        <div className="wrap" style={{ paddingTop: 64, paddingBottom: 64, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "28px 48px" }}>
          <div style={{ flex: "none" }}><Emblem size={168} dark /></div>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <span className="mono" style={{ fontSize: 12, letterSpacing: "0.14em", color: "#5EEAD4" }}>{c.principles.kicker}</span>
            <h2 className="h2" style={{ color: "var(--snow)" }}>{c.principles.title}</h2>
            <p className="lede" style={{ maxWidth: 640 }}>{c.principles.lede}</p>
            <ol style={{ listStyle: "none", margin: "4px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px 20px" }}>
              {copy.principles.en.items.map(([h], i) => (
                <li key={h} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 14, color: "var(--snow-2)" }}>
                  <span className="mono" style={{ color: i === 6 ? "var(--teal-hi)" : "#6E7A84", fontWeight: 700, width: 20, flex: "none" }}>{i + 1}</span>
                  <span style={{ color: i === 6 ? "var(--snow)" : undefined, fontWeight: i === 6 ? 600 : 400 }}>{h}</span>
                </li>
              ))}
            </ol>
            <Link href="/principles/" className="btn btn-teal" style={{ alignSelf: "flex-start", marginTop: 6 }}>{c.principles.cta}</Link>
          </div>
        </div>
      </section>

      {/* THE TOOL */}
      <section id="check" style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="eyebrow">{c.tool.eyebrow}</div>
            <h2 className="h2">{c.tool.title}</h2>
            <p className="lede">{c.tool.lede}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 15, color: "var(--ink-2)" }}>
              {c.tool.points.map((p) => (
                <li key={p} style={{ display: "flex", gap: 10 }}><span className="mono" style={{ color: "var(--teal)" }}>→</span><span><T s={p} /></span></li>
              ))}
            </ul>
            <CopyCommand command={RUN} />
          </div>

          <figure style={{ flex: "1.4 1 560px", minWidth: 0, margin: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 24px 60px rgba(13,15,18,0.08)", overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 15 }}>{c.tool.reportTitle}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{c.tool.reportTag} · <span style={{ color: "var(--amber)" }}>DEMO</span></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", borderBottom: "1px solid var(--line)" }}>
              {metrics.map(([[k, sub], n, color]) => (
                <div key={k} style={{ padding: "18px 20px", borderRight: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{k}</div>
                  <div style={{ fontFamily: "var(--display)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4, color }}>{n}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)" }}><T s={sub} /></div>
                </div>
              ))}
            </div>
            <pre style={{ margin: 0, padding: "18px 20px", background: "var(--night)", color: "#D5DBE0", fontSize: 12, lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre" }}>
              <span style={{ color: "#5c6872" }}>$ {RUN}{"\n\n"}</span>
              {facts.session.lines.join("\n")}
            </pre>
            <figcaption style={{ padding: "12px 20px 16px", fontSize: 12, color: "var(--faint)" }}>
              <T s={c.tool.reportCaption} />{sourceAhead ? ` npm serves ${published} until ${facts.version} is released, so its wording may differ.` : ""} Your report shows your own counts.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* WHAT NEXT: the continuation of the report, in order */}
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <Link href="/next/" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "18px 32px", justifyContent: "space-between", background: "var(--ink)", color: "var(--paper)", borderRadius: 18, padding: "28px 32px", textDecoration: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 420px", minWidth: 0 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "#5EEAD4" }}>{c.nextBand.kicker}</span>
            <span style={{ fontFamily: "var(--display)", fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 700, letterSpacing: "-0.025em" }}>{c.nextBand.title}</span>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 14, color: "#B4BDC5" }}>
              {copy.next.steps.map((s, i) => <li key={s.title}><span className="mono" style={{ color: "#5EEAD4" }}>{i + 1}</span> {s.title}</li>)}
            </ol>
          </div>
          <span className="btn btn-teal" style={{ flex: "none" }}>{c.nextBand.cta}</span>
        </Link>
      </section>

      {/* DEVELOPERS */}
      <section id="developers" className="dark">
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="eyebrow">{c.developers.eyebrow}</div>
              <h2 className="h2">{c.developers.title}</h2>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {published ? <span className="chip" style={{ borderColor: "#1F4D47", color: "var(--teal-hi)" }}>v{published} on npm</span> : null}
              {!published || sourceAhead ? <span className="chip">source {facts.version}{sourceAhead ? ", awaiting release" : ""}</span> : null}
              <span className="chip">Node {facts.node}</span>
              <span className="chip">{facts.license}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            <div style={{ flex: "1.3 1 520px", minWidth: 0, background: "var(--night-2)", border: "1px solid var(--night-line)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ fontSize: 13, color: "#6E7A84" }}>{c.developers.quickstartKicker}</div>
              <h3 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>{c.developers.quickstartTitle}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--snow-2)" }}>{c.developers.quickstartLede}</p>
              <QuickstartTabs
                tabs={[
                  { label: tabs.run[0], comment: tabs.run[1], cmd: base },
                  { label: tabs.days[0], comment: tabs.days[1], cmd: `${base} --days 90` },
                  { label: tabs.events[0], comment: tabs.events[1], cmd: `${base} --events` },
                  { label: tabs.he[0], comment: tabs.he[1], cmd: `${base} --lang he` },
                ]}
              />
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                <a href={links.readme} style={{ color: "var(--teal-hi)" }}>{c.developers.docsLink}</a>
                <a href={links.protect} style={{ color: "var(--teal-hi)" }}>{c.developers.sourceLink}</a>
              </div>
            </div>
            <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ background: "var(--night-2)", border: "1px solid var(--night-line)", borderRadius: 16, padding: 24 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--snow-3)", marginBottom: 12 }}>{c.developers.cliTitle}</div>
                <dl style={{ margin: 0, display: "flex", flexDirection: "column" }}>
                  {facts.flags.map((f) => (
                    <div key={f} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, padding: "9px 0", borderBottom: "1px solid #161C22" }}>
                      <dt className="mono" style={{ fontSize: 13, color: "var(--teal-hi)" }}>{f}</dt>
                      <dd style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--snow-2)" }}>{(c.developers.flags as Record<string, string>)[f]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div style={{ background: "var(--night-2)", border: "1px solid var(--night-line)", borderRadius: 16, padding: 24 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--snow-3)", marginBottom: 12 }}>{c.developers.changelogTitle}</div>
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {facts.changelog.slice(0, 3).map((ch) => (
                    <li key={ch.version + ch.title} style={{ display: "flex", gap: 16, padding: "9px 0", borderBottom: "1px solid #161C22" }}>
                      <span className="mono" style={{ fontSize: 13, color: "var(--teal-hi)", width: 48, flex: "none" }}>{ch.version}</span>
                      <span style={{ fontSize: 14, color: "#D5DBE0" }}>{ch.title}</span>
                    </li>
                  ))}
                </ol>
                <a href={links.readme} style={{ display: "inline-block", marginTop: 12, fontSize: 14, color: "var(--teal-hi)" }}>{c.developers.allVersions}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREAT LIBRARY */}
      <section id="threats" className="wrap" style={{ paddingTop: 96, paddingBottom: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 780, marginBottom: 32 }}>
          <div className="eyebrow">{c.threats.eyebrow}</div>
          <h2 className="h2">{c.threats.title}</h2>
          <p className="lede">{c.threats.lede}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "var(--line-2)", border: "1px solid var(--line-2)", borderRadius: 16, overflow: "hidden" }}>
          {facts.categories.map((cat) => (
            <a key={cat} href={links.rules} style={{ background: "var(--card)", padding: 24, display: "flex", flexDirection: "column", gap: 12, color: "var(--ink)", minHeight: 170, textDecoration: "none" }}>
              <code style={{ fontSize: 12, color: "var(--teal)" }}>{cat}</code>
              <span style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.25 }}>{facts.labels[cat]}</span>
              <span className="mono" style={{ marginTop: "auto", fontSize: 12, color: "var(--faint)" }}>{c.threats.ruleLink}</span>
            </a>
          ))}
        </div>
      </section>

      {/* AFTER YOUR FIRST CHECK */}
      <section id="research" className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 780, marginBottom: 32 }}>
          <div className="eyebrow">{c.after.eyebrow}</div>
          <h2 className="h2">{c.after.title}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Link href="/lab/" style={{ ...cardBase, background: "var(--night)", color: "var(--snow)", minHeight: 230, backgroundImage: "radial-gradient(circle at 85% 15%, rgba(20,184,166,0.25), transparent 50%)" }}>
            <span className="mono" style={{ fontSize: 11, color: "#5EEAD4" }}>{c.after.lab[0]}</span>
            <span style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{c.after.lab[1]}</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--snow-2)" }}><T s={c.after.lab[2]} /></span>
            <span style={{ marginTop: "auto", fontSize: 14, color: "var(--teal-hi)" }}>{c.after.lab[3]}</span>
          </Link>
          {([[c.after.contribute, links.newIssue, false], [c.after.releases, links.releases, false], [c.after.research, "/agentic-web/", true]] as Array<[string[], string, boolean]>).map(([card, href, internal]) => {
            const body = (
              <>
                <span className="mono" style={{ fontSize: 11, color: "var(--teal)" }}>{card[0]}</span>
                <span style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{card[1]}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}><T s={card[2]} /></span>
                <span style={{ marginTop: "auto", fontSize: 14, color: "var(--teal)" }}>{card[3]}</span>
              </>
            );
            return internal ? <Link key={card[1]} href={href} style={lightCard}>{body}</Link> : <a key={card[1]} href={href} style={lightCard}>{body}</a>;
          })}
        </div>
      </section>

      {/* BUILT IN THE OPEN */}
      <section className="wrap" style={{ paddingTop: 24, paddingBottom: 96 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="eyebrow">{c.open.eyebrow}</div>
            <h2 className="h2">{c.open.title}</h2>
          </div>
          <Link href="/about/" style={{ fontSize: 15 }}>{c.open.aboutLink}</Link>
        </div>
        <Social />
      </section>

      {/* VISION */}
      <section className="dark" style={{ borderBottom: "1px solid var(--night-line)" }}>
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 22 }}>
          <div className="eyebrow">{c.vision.eyebrow}</div>
          <p style={{ margin: 0, fontFamily: "var(--display)", fontSize: "clamp(38px, 6vw, 72px)", lineHeight: 1.0, letterSpacing: "-0.045em", fontWeight: 700, maxWidth: 1060 }}>
            {c.vision.title} <span style={{ color: "var(--teal-hi)" }}>{c.vision.titleAccent}</span>
          </p>
          <p className="lede" style={{ maxWidth: 720, fontSize: 19 }}>{c.vision.lede}</p>
          <p className="lede" style={{ maxWidth: 720 }}>{c.vision.second}</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}><T s={c.vision.principlesLink} linkStyle={{ color: "var(--teal-hi)" }} /></p>
          <ol style={{ listStyle: "none", margin: "24px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {c.vision.steps.map(([k, h, b]) => (
              <li key={k} style={{ border: "1px solid var(--night-line)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--teal-hi)", textTransform: "uppercase" }}>{k}</span>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{h}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: "#9AA4AD" }}>{b}</span>
              </li>
            ))}
            <li style={{ border: "1px solid #1F4D47", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8, background: "#0E1A19" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--teal-hi)" }}>{c.vision.nodata[0]}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{c.vision.nodata[1]}</span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "#9AA4AD" }}><T s={c.vision.nodata[2]} linkStyle={{ color: "var(--teal-hi)" }} /></span>
            </li>
          </ol>
        </div>
      </section>
      <VideoInvite />
    </>
  );
}
