# Security policy

## Reporting a vulnerability

Please report security issues privately, through GitHub:
**Security → Report a vulnerability** on this repository
(<https://github.com/daviderez4/nodatachat-core/security/advisories/new>).

Do not open a public issue for a vulnerability. We read every report and reply in the
advisory thread.

## In scope

- `@nodatachat/protect` 3.x (`packages/protect`): the verifiers, the format specs and
  test vectors, and `agent-check`.
- A verifier that accepts what it should reject, a test vector that does not match its
  spec, or `agent-check` putting a path, a command or a value into its report or card, or
  making any network request.

## Out of scope

- `legacy/`: the 1.x packages, kept as published and not maintained.
- NoData's product (the server, the MCP, the SDK, the CLI), which is not in this
  repository.

## Supported versions

The latest 3.x release on npm. Every version is published from this repository by GitHub
Actions with an npm provenance attestation.
