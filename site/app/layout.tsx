import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
