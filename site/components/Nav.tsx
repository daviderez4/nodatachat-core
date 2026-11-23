import Link from "next/link";
import { links } from "@/lib/links";
import { Mark } from "./Mark";

// Only places that exist. Sections not built yet are not in the menu.
const items: Array<{ href: string; label: string; external?: boolean }> = [
  { href: "/#check", label: "Tool" },
  { href: "/lab/", label: "Lab" },
  { href: "/agentic-web/", label: "Agentic Web" },
  { href: "/#developers", label: "Developers" },
  { href: "/#threats", label: "Threat Library" },
  { href: links.readme, label: "Docs", external: true },
  { href: links.repo, label: "Open Source", external: true },
];

export function Nav() {
  return (
    <header style={{ borderBottom: "1px solid var(--line)", background: "rgba(250,250,248,0.94)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "saturate(1.4) blur(8px)" }}>
      <nav aria-label="Main" className="wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 28px", paddingTop: 12, paddingBottom: 12 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)", fontFamily: "var(--display)", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
          <Mark />
          What My Agent Saw
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 22px", fontSize: 14, flex: "1 1 420px" }}>
          {items.map((i) =>
            i.external ? (
              <a key={i.label} href={i.href} style={{ color: "var(--muted)" }}>{i.label} <span aria-hidden="true">↗</span></a>
            ) : (
              <Link key={i.label} href={i.href} style={{ color: "var(--muted)" }}>{i.label}</Link>
            ),
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href={links.repo} aria-label="GitHub repository" className="btn btn-ghost" style={{ padding: "0 12px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>
          </a>
          <Link href="/#check" className="btn btn-ink" style={{ fontSize: 14 }}>Run your first check</Link>
        </div>
      </nav>
    </header>
  );
}
