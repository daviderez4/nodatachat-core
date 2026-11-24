# CLAUDE.md: whatmyagentsaw.com (`site/`)

The site for `agent-check`, built from this repository. Read this before changing anything under `site/`.
The person who owns it is David (Founder, NoData). Reply to him in Hebrew. When he must run something
(Vercel, DNS, npm), hand him the exact command or the exact click path.

## What the site is

A place to see what AI agents actually do with the access they were given: a free tool
(`npx @nodatachat/protect@3 agent-check`), a lab that teaches how to read the evidence, and research on
where agents can be misled. NoData maintains it and is linked from it. The site sells nothing.

- `/`: Agent Activity Map, the Exposure Report, developers, threat library, built in the open, vision.
- `/lab`: 8 scenarios, request to decision, with the deciding source lines.
- `/agentic-web`: agents compromised by what they read, and where the history's view ends.
- `/about`: who maintains it, what is open, how we work, what the site collects.

## The rules (each one exists because it was broken once)

1. **No fact is typed by hand.** Versions, flags, categories, counts, verdicts, the check command and the
   CLI output all come from `packages/protect`, through `scripts/protect-facts.mjs`, at build time.
   A page that types one is a bug.
2. **Words live in `content/copy.json`; facts do not.** The copy may name a fact only through a
   `{token}`. The build refuses a copy file that:
   - types a version, a command or the package;
   - uses an unknown token;
   - links to a key missing from `lib/links.ts`, or to a page that does not exist;
   - describes a flag the CLI lacks, or a number `src/bin.ts` does not use.
3. **Scenarios are data, checked against the code.**
   - `content/scenarios.json` (the lab) and `content/agentic-web.json` run through the real readers,
     `toEvents()` and `exposure()`.
   - If a scenario's `expect` differs from what the code decides, the build fails, and the message
     says what the code decides.
   - Fix the words, never the check.
4. **Evidence and its limits.** Every finding says what it shows and what it does not prove. Unknown is
   not safe. An attempt is not an exposure. A key-shaped value is not proof a key works.
5. **No numbers without a primary source.** Read the study itself, with its method, scope and limits.
   Never quote a secondary article. Simulated data is labelled simulated.
6. **NoData is described as it behaves.**
   - It does not judge content.
   - Its gate marks a session that read outside content and decides the next outbound step by the
     owner's rules: a warning by default, a person's approval where a rule asks for one.
   - Never write "blocks" for something that only warns.
7. **npm is what people run.** The site reads `dist-tags.latest` at build time. When the source is
   ahead, the pages say both. Never show a version npm does not serve as if it did.
8. **No third-party requests.** Fonts are self-hosted (`@fontsource-variable/*`). Do not add analytics,
   trackers, Google Fonts or CDNs: `/about` promises that a visit contacts no one else.
9. **No key-shaped literal in the repo.** Scenarios use `{{KEY}}`, expanded at build time. GitHub's push
   protection would block a real-looking key anyway.
10. **Example domains only** in scenarios (`*.example`, `example.net`) and invented package names.
    Never point an attack scenario at a real site or package.

## How a change ships

1. **A branch and a PR** to `main` in `daviderez4/nodatachat-core`.
2. **Vercel builds a preview** for the PR. David reviews it and can comment on the preview page.
3. **David merges.** A person merges, never an agent, by THE RELEASE LAW: this site is a release
   channel, row `site_whatmyagentsaw` in the private repo's `apps/web/src/lib/release-policy/channels.ts`.
4. **Production deploys** to whatmyagentsaw.com. A bad deploy is withdrawn by promoting the previous
   deployment in Vercel, or by a revert.

The protect package (`packages/protect`), its CI (`.github/workflows/protect.yml`) and its npm release are
not the site's. A site change never touches them. A change to `packages/protect` comes from the private
repo through `protect-public-sync`, not from here.

## Commands (from `site/`)

```bash
npm ci
npm run facts    # read packages/protect, check copy and scenarios, write generated/facts.json
npm run dev      # http://localhost:3000
npm run build    # the check above, then the static export in out/
npm run check    # facts + tsc
```

**Before you call a change done:**
- `npm run build` and `npx tsc --noEmit -p tsconfig.json` both pass.
- Screenshots at 1440 px and 390 px show no horizontal scroll and no console errors.
- When only words changed, every page's text matches what you intended, and nothing else moved.

## Where things are

| What | Where |
|---|---|
| Every sentence | `content/copy.json` |
| Lab scenarios | `content/scenarios.json` |
| Agentic Web scenarios | `content/agentic-web.json` |
| Every outward link, the founder card | `lib/links.ts` |
| Facts from the code (generated, git-ignored) | `generated/facts.json` |
| The build check | `scripts/protect-facts.mjs` |
| Colours, fonts | `app/globals.css` (tokens on `:root`) |
| Interactive pieces | `components/ActivityMap.tsx`, `Lab.tsx`, `AgenticWeb.tsx` |

Small labels inside the interactive components (step names, legend) are still in the component files.
