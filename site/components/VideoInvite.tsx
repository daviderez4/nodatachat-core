"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";

// The 73-second film on the home page, in a window that opens by itself once and can always
// be closed. It opens after the visitor has agreed to the terms (never over the consent
// window), and not again once closed in this browser. The Watch button in the hero opens it
// at any time. The file is served from this site: no player, no third party, nothing loads
// until the window opens (preload="none"). The numbers in it are one real run of agent-check.
const SEEN = "wmas-video-seen";
const c = copy.home.video;

function read(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function write(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* not kept: it may open again */ }
}

export function VideoInvite() {
  const [open, setOpen] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const close = useCallback(() => {
    video.current?.pause();
    write(SEEN, String(Date.now()));
    setOpen(false);
  }, []);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("wmas:video", show);
    // First visit: once the terms are agreed (now or earlier), open it by itself, once.
    const auto = () => {
      if (read(SEEN) || read("wmas-terms") !== copy.terms.version) return;
      setTimeout(() => { if (!read(SEEN)) setOpen(true); }, 1200);
    };
    auto();
    window.addEventListener("wmas:agreed", auto);
    return () => { window.removeEventListener("wmas:video", show); window.removeEventListener("wmas:agreed", auto); };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div data-wmas-video onClick={close} style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(10,13,16,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="video-title" onClick={(e) => e.stopPropagation()} style={{ width: "min(980px, 100%)", background: "var(--night)", color: "var(--snow)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", border: "1px solid var(--night-line-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span id="video-title" style={{ fontFamily: "var(--display)", fontSize: 18, fontWeight: 700 }}>{c.title}</span>
          <button ref={closeBtn} type="button" onClick={close} aria-label={c.close} style={{ flex: "none", width: 44, height: 44, borderRadius: 10, border: "1px solid var(--night-line-2)", background: "transparent", color: "var(--snow)", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <video ref={video} controls playsInline preload="none" poster="/video/what-my-agent-saw-poster.jpg" style={{ width: "100%", height: "auto", borderRadius: 10, background: "#000", display: "block" }}>
          <source src="/video/what-my-agent-saw.mp4" type="video/mp4" />
        </video>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--snow-2)" }}>{c.caption}</p>
      </div>
    </div>
  );
}

/** The hero's Watch button: opens the window at any time. */
export function WatchButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("wmas:video"))} className="btn btn-ghost" style={{ minHeight: 56, gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      {c.button}
    </button>
  );
}
