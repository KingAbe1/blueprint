# Security policy

## Supported versions

Fixes land on the default branch (`main`). No LTS releases yet - use latest `main` or your release tag.

## Reporting a vulnerability

Do not post exploit details in a public issue.

Contact the maintainer privately (GitHub profile or site contact on [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/)). Include impact, steps to reproduce, and version or commit when you can.

## Scope

In scope: blueprint studio app code (web + Tauri + Rust handoff paths), unsafe export paths, cross-project localStorage leaks.

Out of scope: user AI keys, malicious code inside scanned third-party repos, compromised developer machines.

## Contributors

No secrets in git. New network calls must be opt-in and documented ([CONTRIBUTING.md](./CONTRIBUTING.md)).
