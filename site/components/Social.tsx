import { facts } from "@/lib/facts";
import { founder, links } from "@/lib/links";

const GH = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>;
const NPM = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="1.5" /><path d="M7 15v-6h3v6M10 11v4M13 15V9h3v4h-1.5M18 15V9" /></svg>;
const IN = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" /></svg>;

/** Where the project lives and who is behind it. Every number shown is read from the package. */
export function Social({ dark = false }: { dark?: boolean }) {
  const cards: Array<{ href: string; icon: React.ReactNode; kicker: string; title: string; body: string; cta: string }> = [
    { href: links.repo, icon: GH, kicker: "OPEN SOURCE", title: "daviderez4/nodatachat-core", body: `The check, its rules and this site. ${facts.license}. Star it, watch releases, open an issue.`, cta: "Star on GitHub ↗" },
    { href: links.npm, icon: NPM, kicker: "NPM", title: facts.package, body: `v${facts.version}, published from the public repo with provenance. Node ${facts.node}.`, cta: "View on npm ↗" },
  ];
  if (founder.linkedin && founder.name)
    cards.push({ href: founder.linkedin, icon: IN, kicker: "THE PERSON BEHIND IT", title: founder.name, body: founder.title || "Follow the work as it happens.", cta: "Follow on LinkedIn ↗" });

  const bg = dark ? "var(--night-2)" : "var(--card)";
  const line = dark ? "var(--night-line)" : "var(--line)";
  const muted = dark ? "var(--snow-2)" : "var(--muted)";
  const accent = dark ? "var(--teal-hi)" : "var(--teal)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      {cards.map((c) => (
        <a key={c.href} href={c.href} style={{ background: bg, border: `1px solid ${line}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12, color: "inherit", textDecoration: "none", minHeight: 200 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, color: accent }}>{c.icon}<span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em" }}>{c.kicker}</span></span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 500, wordBreak: "break-all" }}>{c.title}</span>
          <span style={{ fontSize: 14, lineHeight: 1.55, color: muted }}>{c.body}</span>
          <span style={{ marginTop: "auto", fontSize: 14, fontWeight: 600, color: accent }}>{c.cta}</span>
        </a>
      ))}
    </div>
  );
}
