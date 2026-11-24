// The site's words live in content/copy.json, so they can be edited without touching code.
// Three markers, nothing else: `code`, [text](link key or /path), {fact token}.
// Facts are never typed in the copy: tokens are filled from generated/facts.json, and
// scripts/protect-facts.mjs refuses a copy file that types a version, a command or the package.
import Link from "next/link";
import raw from "@/content/copy.json";
import { facts } from "./facts";
import { links } from "./links";

export const copy = raw;

/** The facts a sentence may name, all read from the code at build time. */
const TOKENS: Record<string, string> = {
  package: facts.package,
  version: facts.version,
  license: facts.license,
  node: facts.node,
  labCount: String(facts.lab.length),
  calls: String(facts.session.tally.calls),
  samples: String(facts.session.tally.samples),
  latest: facts.changelog[0] ? `${facts.changelog[0].version}, ${facts.changelog[0].title.toLowerCase()}` : "",
};

/** A sentence with its tokens filled, as plain text (for metadata, alt text, keys). */
export function plain(s: string): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => TOKENS[k] ?? m).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]+)`/g, "$1");
}

const LINK = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;

/** A sentence with its markers rendered. `linkStyle` lets a dark section color its links. */
export function T({ s, linkStyle }: { s: string; linkStyle?: React.CSSProperties }) {
  const text = s.replace(/\{(\w+)\}/g, (m, k) => TOKENS[k] ?? m);
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[3] !== undefined) {
      out.push(<code key={m.index}>{m[3]}</code>);
    } else {
      const target = m[2];
      if (target.startsWith("/")) out.push(<Link key={m.index} href={target} style={linkStyle}>{m[1]}</Link>);
      else out.push(<a key={m.index} href={(links as Record<string, string>)[target] ?? "#"} style={linkStyle}>{m[1]}</a>);
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Every link key and token the copy uses, for the build check. */
export const COPY_TOKENS = Object.keys(TOKENS);
