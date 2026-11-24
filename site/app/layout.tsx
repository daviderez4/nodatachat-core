import type { Metadata } from "next";
// Fonts are served from this site (OFL-1.1, @fontsource): a visit contacts no one else.
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/newsreader";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Consent } from "@/components/Consent";
import { StarInvite } from "@/components/StarInvite";

export const metadata: Metadata = {
  metadataBase: new URL("https://whatmyagentsaw.com"),
  title: { default: "What My Agent Saw", template: "%s · What My Agent Saw" },
  description: "See what your AI agent attempted, what succeeded, and what actually reached it. Open source, free, runs on your history.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "What did your agent actually see?",
    description: "See what your AI agent attempted, what succeeded, and what actually reached it.",
    url: "https://whatmyagentsaw.com",
    siteName: "What My Agent Saw",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <Consent />
        <StarInvite />
      </body>
    </html>
  );
}
