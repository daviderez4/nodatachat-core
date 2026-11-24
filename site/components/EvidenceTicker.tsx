import Link from "next/link";
import { tickerItems, TYPE_LABEL } from "@/lib/evidence";

// A strip under the menu: the latest verified items, each a link to its own page where the
// source, the quote and the share links are. Pure CSS motion, paused on hover or focus, and
// still for readers who ask for reduced motion.
export function EvidenceTicker() {
  if (!tickerItems.length) return null;
  // The track is drawn twice so the loop is seamless; the copy is hidden from readers and keyboards.
  const row = (copy: boolean) => tickerItems.map((i) => (
    <Link key={i.id} href={`/evidence/${i.id}/`} className="ev-item" tabIndex={copy ? -1 : undefined}>
      <span className="mono ev-type">{TYPE_LABEL[i.event_type] ?? i.event_type}</span>
      <span>{i.headline}</span>
      <span className="ev-src">· {i.source_name}</span>
    </Link>
  ));
  return (
    <div className="ev-ticker" role="region" aria-label="Verified evidence, latest first">
      <Link href="/evidence/" className="mono ev-label">EVIDENCE · VERIFIED AT SOURCE</Link>
      <div className="ev-viewport">
        <div className="ev-track">
          {row(false)}
          <span aria-hidden="true" className="ev-dup">{row(true)}</span>
        </div>
      </div>
    </div>
  );
}
