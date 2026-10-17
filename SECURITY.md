# Security policy

## Supported versions

Fixes land on the default branch (`main`). No LTS releases yet - use latest `main` or your release tag.

## Reporting a vulnerability

Do **not** post exploit details in a public issue.

### If the repo is private (current)

GitHub’s **Security → Advisories** pages often return **404** for private repositories (and for people who are not collaborators). That is normal.

**Reporters who have repo access:** open a [private security advisory](https://github.com/KingAbe1/blueprint/security/advisories) from the repo (must be logged in with access). If that tab is missing, use a private issue or contact the maintainer below.

**Everyone else:** email the maintainer via the contact on [github.com/KingAbe1](https://github.com/KingAbe1) (profile email if listed) or an address you publish on [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/). Put “security - blueprint” in the subject.

Include when you can:

- What breaks and why it matters
- Steps to reproduce
- Commit or version
- Optional fix idea

### After the repo is public (recommended setup)

1. On GitHub: **Settings → General → Security → Private vulnerability reporting** → enable **Private vulnerability reporting**.
2. Then this link works for researchers: [Report a vulnerability](https://github.com/KingAbe1/blueprint/security/advisories/new) (they must be signed in; GitHub keeps the report private until you publish).

Optional: **Settings → Code security** → enable Dependabot alerts for dependency CVEs.

## Scope

In scope: blueprint studio app code (web + Tauri + Rust handoff paths), unsafe export paths, cross-project localStorage leaks.

Out of scope: user AI keys, malicious code inside scanned third-party repos, compromised developer machines.

## Contributors

No secrets in git. New network calls must be opt-in and documented ([CONTRIBUTING.md](./CONTRIBUTING.md)).
