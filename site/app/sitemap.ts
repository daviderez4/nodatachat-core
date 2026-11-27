import type { MetadataRoute } from "next";
import { evidence, SITE_URL } from "@/lib/evidence";

// A static export: the sitemap is written once at build time, with the site's trailing-slash URLs.
export const dynamic = "force-static";

const PAGES = ["/", "/next/", "/toolbox/", "/lab/", "/agentic-web/", "/evidence/", "/principles/", "/about/", "/terms/", "/privacy/"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p}` })),
    ...evidence.map((i) => ({ url: `${SITE_URL}/evidence/${i.id}/` })),
  ];
}
