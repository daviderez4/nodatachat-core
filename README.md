<div align="center">

<img src="assets/banner.svg" alt="NoData — Information Access Processor" width="100%"/>

**Don't trust NoData. Verify NoData.**

[![npm](https://img.shields.io/npm/v/@nodatachat/protect?color=C8A24B&label=%40nodatachat%2Fprotect)](https://www.npmjs.com/package/@nodatachat/protect)

</div>

This repository is the source of [`@nodatachat/protect`](https://www.npmjs.com/package/@nodatachat/protect),
NoData's verification layer: the formats, their specs, test vectors, and the readable code
that checks them. It does not run NoData and makes no network calls.

Every version is published from this repository by GitHub Actions, with an npm
**provenance** attestation: npm shows which commit and which workflow built the package
you install, so you can read exactly the code you run.

```bash
npx @nodatachat/protect@3 check-vectors     # the code matches the published formats
npx @nodatachat/protect@3 verify-pack pack.json
npx @nodatachat/protect@3 inspect-seal file.ndc
```

What each command proves, and what it does not, is in
[`packages/protect/README.md`](packages/protect/README.md) and the format specs next to it.

## What is here

| Path | What |
|---|---|
| [`packages/protect`](packages/protect) | `@nodatachat/protect` 3.x: specs, vectors and verifiers. License: [Apache-2.0](packages/protect/LICENSE.md) |
| [`legacy/`](legacy) | The 1.x open core (Apache-2.0), kept as published, not maintained |

NoData's product (the server, the MCP, the SDK, the CLI) is not in this repository.
What is here is what you need to verify what NoData says about it.

## Build it yourself

```bash
cd packages/protect
npm ci && npm run build
node dist/bin.js check-vectors
```

The build output matches the published package file for file; compare with
`npm pack @nodatachat/protect@<version>`.
