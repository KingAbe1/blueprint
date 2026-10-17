# Security policy

## Supported versions

Security fixes are applied on the default branch (`main`). There are no long-term support releases yet - use the latest commit or release tag.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report them privately:

1. Use [GitHub private vulnerability reporting](https://github.com/KingAbe1/blueprint/security/advisories/new) (recommended).

Include when you can:

- Description of the issue and impact
- Steps to reproduce
- Affected version or commit SHA
- Any suggested fix (optional)

We aim to acknowledge reports within a few business days and will coordinate disclosure after a fix is available.

## Scope

In scope:

- blueprint studio application code (web UI, Tauri shell, Rust commands)
- Path handling for handoff export (`safe_handoff_path`, folder write APIs)
- Local storage handling that could leak data across origins or projects
- Dependency vulnerabilities in this repo’s direct build chain (report via maintainers or Dependabot)

Out of scope (user responsibility):

- Misconfiguration of AI providers (users supply keys and choose models)
- Malicious code inside **scanned third-party repositories**
- OS-level compromises on the developer machine

## Secure development expectations

Contributors must not commit API keys, tokens, or `.env` files. PRs that add network calls must document data flows and keep user content **opt-in**, consistent with [CONTRIBUTING.md](./CONTRIBUTING.md).
