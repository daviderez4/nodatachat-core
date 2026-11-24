# whatmyagentsaw.com

The site for `agent-check`: see what your AI agent attempted, what succeeded, and what
actually reached it. A static Next.js site, built from this repository.

## Nothing about the tool is typed by hand

`scripts/protect-facts.mjs` runs before every build and reads `../packages/protect`:

- the version, the Node engine, the CLI flags and the command, from `package.json`, `src/bin.ts`
  and `src/agent-history-report.ts`;
- the categories and the names the CLI prints for them;
- the changelog, from the versioned headings of `packages/protect/README.md`;
- the lab: every scenario in `content/scenarios.json` is a log in the format the readers parse.
  It goes through the real `readClaudeTranscript` / `readCodexSession`, `toEvents` and `exposure`,
  compiled from `src/` for the build. The page shows what the code decided, and the homepage
  report is the CLI's real text output for the same calls.

If a scenario's `expect` differs from what the code decides, or a documented flag is gone from
`bin.ts`, the build fails. A rule change in `packages/protect` therefore either keeps the site
true or stops it from deploying.

No key-shaped literal is stored here: `{{KEY}}` in a scenario is expanded at build time.

## Run it

```bash
cd site
npm ci
npm run dev      # http://localhost:3000
npm run build    # static output in out/
```

## Deploy

A Vercel project with **Root Directory** `site` (the build reads `../packages/protect`, so
"Include files outside the root directory" must stay on). Every merge to `main` deploys.

## Add a lab scenario

Add an entry to `content/scenarios.json` with the two log lines and the `expect` you believe the
code decides, then `npm run facts`. If you are wrong, the script says what the code decides instead.

## Add an evidence item (the ticker and /evidence/)

The strip under the menu and `/evidence/` show items from `content/evidence.json`. Each one is held
by `scripts/evidence-check.mjs`, which runs before every build:

- `source_url` is the original document (https, no `utm_`), and `quote` is copied word for word from it;
- `verification_status` must be `opened_and_matched`: someone opened the page on `last_verified`;
- a lawsuit, court decision or enforcement action names its `legal_stage` (a filing is an allegation);
- `technical_status` is attempted, succeeded, exposed or unknown. `no_event` is refused: a news item
  cannot prove an absence;
- `date` is `null` when the source gives none, and the item then sorts last.

An item not re-verified in 120 days leaves the ticker and is marked on `/evidence/`. `source_id` is
the id in the NoData Evidence Intelligence registry. Share links are plain links: no third-party
script loads until the reader clicks.
