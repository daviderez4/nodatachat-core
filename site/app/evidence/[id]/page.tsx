import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { evidence, itemUrl } from "@/lib/evidence";
import { EvidenceCard } from "@/components/EvidenceCard";

// One page per item, so a shared post carries that item's headline and claim.
export const dynamicParams = false;
export function generateStaticParams() {
  return evidence.map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = evidence.find((i) => i.id === id);
  if (!item) return {};
  return {
    title: item.headline,
    description: item.claim,
    alternates: { canonical: itemUrl(item) },
    openGraph: { title: item.headline, description: item.claim, url: itemUrl(item), type: "article" },
    twitter: { card: "summary", title: item.headline, description: item.claim },
  };
}

export default async function EvidenceItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = evidence.find((i) => i.id === id);
  if (!item) notFound();
  return (
    <section className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 880, marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/evidence/" className="mono" style={{ fontSize: 12, letterSpacing: "0.06em" }}>← ALL EVIDENCE</Link>
      <EvidenceCard item={item} headingLevel={1} link={false} />
    </section>
  );
}
