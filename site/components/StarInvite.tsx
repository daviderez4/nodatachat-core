"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { links } from "@/lib/links";

// A polite invitation to the repository: use it, read it, and if it helps, star it.
// Shown once the visitor has agreed to the terms and shown interest (a second page, or
// copying a command), never together with the consent window, and not again for 30
// days after it is closed. Remembered in this browser only; nothing is sent.
const SEEN = "wmas-star-seen";
const PAGES = "wmas-pages";
const WAIT_DAYS = 30;
const c = copy.star;

function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* not kept: it may show again */
  }
}

export function StarInvite() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/terms") || pathname?.startsWith("/principles")) return;
    // Every page counts, agreed or not, so "a second page" means the second the visitor saw.
    const pages = Number(read(PAGES) ?? 0) + 1;
    write(PAGES, String(pages));
    const agreed = read("wmas-terms") === copy.terms.version;
    const seen = Number(read(SEEN) ?? 0);
    if (!agreed || Date.now() - seen < WAIT_DAYS * 86_400_000) return;
    if (pages >= 2) {
      const t = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(t);
    }
    // On the first page: show it after a command is copied (CopyCommand dispatches this).
    const onCopy = () => setTimeout(() => setShow(true), 1500);
    window.addEventListener("wmas:copied", onCopy);
    return () => window.removeEventListener("wmas:copied", onCopy);
  }, [pathname]);

  if (!show) return null;
  const close = () => {
    write(SEEN, String(Date.now()));
    setShow(false);
  };

  return (
    <aside role="dialog" aria-labelledby="star-title" className="dark" style={{ position: "fixed", insetInlineEnd: 16, bottom: 16, zIndex: 40, width: "min(380px, calc(100vw - 32px))", background: "var(--night)", color: "var(--snow)", borderRadius: 16, padding: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--night-line-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <span id="star-title" style={{ fontFamily: "var(--display)", fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{c.title}</span>
        <button type="button" onClick={close} aria-label={c.close} style={{ flex: "none", width: 36, height: 36, borderRadius: 8, border: "1px solid var(--night-line-2)", background: "transparent", color: "var(--snow-2)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--snow-2)" }}>{c.body}</p>
      <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "var(--snow-2)" }}>
        {c.points.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{c.ask}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href={links.repo} onClick={close} className="btn btn-teal" style={{ fontSize: 14, minHeight: 44 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
          {c.cta}
        </a>
        <button type="button" onClick={close} className="btn btn-ghost" style={{ fontSize: 14, minHeight: 44 }}>{c.later}</button>
      </div>
    </aside>
  );
}
