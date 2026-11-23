#!/usr/bin/env node
// What My Agent Saw — by NoData.
//
// What did your AI agent try to access, and what did it actually see?
// This is the whole program: it runs `agent-check` from @nodatachat/protect, NoData's
// open verification layer, which reads the history your AI coding agent (Claude Code,
// Codex) already keeps on this computer and counts what it tried, what succeeded, and
// which key-shaped values came back to it. Local only, counts only, nothing is sent.
// Read the code: https://github.com/daviderez4/nodatachat-core/tree/main/packages/protect
//
//   npx what-my-agent-saw              the last 30 days
//   npx what-my-agent-saw --days 90
//   npx what-my-agent-saw --lang he    the report in Hebrew (the default where the system is in Hebrew)
//   npx what-my-agent-saw --events     the LOCAL report: one finding per line, with where
//   npx what-my-agent-saw --no-card    no shareable card file
"use strict";

const { main } = require("@nodatachat/protect/dist/bin.js");

// A reader that stops early (`| head`) is not an error.
process.stdout.on("error", (err) => {
  if (err && err.code === "EPIPE") process.exit(0);
  throw err;
});

const args = process.argv.slice(2);
if (!args.includes("--lang")) {
  let locale = "";
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
  } catch {
    locale = "";
  }
  if (/^he\b|^iw\b/i.test(locale) || /^he/i.test(process.env.LANG || "")) args.push("--lang", "he");
}
const he = args[args.indexOf("--lang") + 1] === "he";
const quiet = args.includes("--events") || args.includes("--json");

if (!quiet) {
  process.stdout.write(
    he
      ? "What My Agent Saw · מה סוכן ה-AI שלך ניסה לראות, ומה באמת הגיע אליו?\n\n"
      : "What My Agent Saw · What did your AI agent try to access, and what did it actually see?\n\n",
  );
}

main(["agent-check", ...args]).then((code) => {
  if (!quiet) {
    process.stdout.write(
      he
        ? "\nלפני שמגינים על סוכן ה-AI, כדאי לדעת מה הוא כבר ראה. · NoData · nodatacapsule.com\n"
        : "\nBefore you protect your AI agent, find out what it has already seen. · NoData · nodatacapsule.com\n",
    );
  }
  process.exitCode = code;
});
