# What My Agent Saw

**What did your AI agent try to access, and what did it actually see?**

```sh
npx what-my-agent-saw
```

Your AI coding agent (Claude Code, Codex) keeps a history of every tool call on your
computer. This reads it, locally, and counts, per category (files that hold credentials,
commands that print a credential, searches for passwords and keys, data files, commands
that send data out):

- **tried**: the agent asked a tool to touch it;
- **succeeded**: the tool did not report an error;
- **secrets returned**: a key-shaped value came back into the agent's context.

An attempt is not an exposure. Values from tests, examples or code the agent wrote
itself are set apart, not counted. History that was deleted is not counted either, so
the result is a floor, not a complete record.

**Nothing is sent.** No install of anything else, no account. The report and the card it
writes hold numbers and category names only: never a path, a command or a value.
`--events` prints a local report with where each finding is; it is printed on your screen
and written nowhere else.

## Options

```sh
npx what-my-agent-saw --days 90     # a longer window
npx what-my-agent-saw --lang he     # Hebrew (the default where the system is in Hebrew)
npx what-my-agent-saw --events      # the local report, one finding per line
npx what-my-agent-saw --no-card     # no shareable card file
```

## What runs

This package is a few lines: it runs `agent-check` from
[`@nodatachat/protect`](https://www.npmjs.com/package/@nodatachat/protect), NoData's open
verification layer, published with npm provenance from
[nodatachat-core](https://github.com/daviderez4/nodatachat-core). The rules are plain
patterns in `packages/protect/src/agent-rules.ts`: read them, and argue with them.

Before you protect your AI agent, find out what it has already seen.
[NoData](https://nodatacapsule.com) is how you then decide what it may see.

Apache-2.0. See `LICENSE.md` and `NOTICE`.
