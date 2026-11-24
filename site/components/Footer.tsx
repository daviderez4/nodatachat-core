import Link from "next/link";
import { founder, links } from "@/lib/links";
import { facts, published } from "@/lib/facts";

export function Footer() {
  return (
    <footer className="dark">
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 48, display: "flex", flexWrap: "wrap", gap: "24px 48px", justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 16 }}>What My Agent Saw</span>
          <span style={{ fontSize: 14, color: "var(--snow-3)", lineHeight: 1.55, maxWidth: 360 }}>
            Make the invisible behavior of AI agents visible.
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, fontSize: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--snow-3)" }}>BUILD</span>
            <Link href="/#check" style={{ color: "var(--snow-2)" }}>Run the check</Link>
            <Link href="/next/" style={{ color: "var(--snow-2)" }}>What to do next</Link>
            <a href={links.readme} style={{ color: "var(--snow-2)" }}>Docs</a>
            <Link href="/lab/" style={{ color: "var(--snow-2)" }}>Lab</Link>
            <Link href="/agentic-web/" style={{ color: "var(--snow-2)" }}>The Agentic Web</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--snow-3)" }}>PROJECT</span>
            <a href={links.repo} style={{ color: "var(--snow-2)" }}>GitHub</a>
            <a href={links.npm} style={{ color: "var(--snow-2)" }}>npm</a>
            <a href={links.security} style={{ color: "var(--snow-2)" }}>Security</a>
            <Link href="/about/" style={{ color: "var(--snow-2)" }}>About</Link>
            <Link href="/principles/" style={{ color: "var(--snow-2)" }}>10 principles</Link>
            <Link href="/terms/" style={{ color: "var(--snow-2)" }}>Terms</Link>
            <Link href="/privacy/" style={{ color: "var(--snow-2)" }}>Privacy</Link>
            {founder.linkedin ? <a href={founder.linkedin} style={{ color: "var(--snow-2)" }}>LinkedIn</a> : null}
          </div>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 18, paddingBottom: 32, borderTop: "1px solid var(--night-line)", display: "flex", flexWrap: "wrap", gap: "8px 24px", justifyContent: "space-between", fontSize: 13, color: "var(--snow-3)" }}>
        <span>
          {facts.package} {published ?? `${facts.version} (source)`} · {facts.license} · Maintained by <a href={links.nodata} style={{ color: "var(--teal-hi)" }}>NoData</a>
        </span>
        <span>
          Need this enforced across a team? <a href={links.nodata} style={{ color: "var(--teal-hi)" }}>From visibility to control →</a>
        </span>
      </div>
    </footer>
  );
}
