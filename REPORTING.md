# Reporting a result that looks wrong

We do not promise a tool that is never wrong. We build tools that state their decisions, show
what they rest on, and let anyone report a failure, so that it can be looked at, reproduced,
fixed and checked again, in the open.

**Enforce every decision. Prove every release. Look into every reported failure.**

## What to report

Anything a result got wrong, including what did **not** happen:

- something sensitive was there and was not found;
- something was found that was not sensitive;
- the category is wrong;
- a file could not be read, or was read only in part;
- a file type is not supported;
- a decision does not match the rules;
- anything else that looks wrong.

Open an issue with the form **"A result looks wrong"**:
https://github.com/daviderez4/nodatachat-core/issues/new?template=finding-problem.yml

**Never paste a key, a password, a token, a file's content or personal data.** Issues are
public. Describe the shape ("an IBAN in a CSV column"). If we need a sample, we ask for a
made-up one. A vulnerability goes through [SECURITY.md](SECURITY.md), not an issue.

## What happens to a report

Every report gets a number (the issue number) and a status label, changed as it moves:

| Label | Meaning |
|---|---|
| `status: reported` | Received. |
| `status: under review` | Someone is looking at it. |
| `status: reproduced` | We made it happen again, from your description or a made-up sample. |
| `status: confirmed` | A real limit or a fault, not a misunderstanding. |
| `status: fixed` | Fixed in a release, named in the issue. |
| `status: verified` | The fix checked against the original case. |
| `status: closed` | Done. The issue says why: fixed, a known limit now documented, or not reproduced. |

A fix that changes what the tool decides also changes the lab and the site: their verdicts are
computed from the same code (see `site/README.md`), so a fix shows up there by itself.

## What we commit to, and what we do not

- We read every report and answer in the issue.
- We look into it as far as the information we have allows, and say what we found.
- We do not promise that every report will be reproduced or fixed, or fixed by a given date.
  The tool is provided as is, under the Apache License 2.0 and the
  [terms](https://whatmyagentsaw.com/terms/).
- A report never changes a past record. What a tool decided, and any signed record of it, stays
  as it was. The report and its outcome are added next to it.
