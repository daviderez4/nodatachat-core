import type { EvidenceItem } from "@/lib/evidence";
import { itemUrl } from "@/lib/evidence";

// Plain share links: no third-party script loads on this site, so a visit still contacts no one
// else. The network is reached only when the reader clicks. Each item has its own page, so the
// post shows that item's headline, not the homepage.
export function ShareLinks({ item, dark = false }: { item: EvidenceItem; dark?: boolean }) {
  const url = encodeURIComponent(itemUrl(item));
  const text = encodeURIComponent(`${item.headline} (source: ${item.source_name})`);
  const targets = [
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    { label: "X", href: `https://x.com/intent/post?text=${text}&url=${url}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
  ];
  const color = dark ? "var(--snow-2)" : "var(--muted)";
  const line = dark ? "var(--night-line-2)" : "var(--line-2)";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color }}>SHARE</span>
      {targets.map((t) => (
        <a
          key={t.label}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${t.label}`}
          style={{ fontSize: 13, fontWeight: 600, color, border: `1px solid ${line}`, borderRadius: 999, padding: "4px 12px", textDecoration: "none" }}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}
