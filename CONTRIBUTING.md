# Contributing to blueprint studio

Thank you for helping improve blueprint studio. This project is **local-first**: specs and scans stay on the user’s machine unless they explicitly configure AI or other integrations.

## Before you start

1. Read [README.md](./README.md) for product scope (greenfield vs brownfield, Next.js-deep brownfield today).
2. Read [SECURITY.md](./SECURITY.md) if you find a vulnerability.
3. Agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing (issues, docs, or code), you agree that your contributions are licensed under the same terms as the project: the [MIT License](./LICENSE), and you have the right to submit them.

## Development setup

```bash
npm install
npm run dev          # web
npm run tauri:dev    # desktop
npm run build        # tsc + vite production build
```

Open a PR only after `npm run build` succeeds locally.

## What we welcome

- Bug fixes and tests for real behavior (not trivial assertions).
- Documentation that matches **current** behavior.
- Brownfield rules and analyzers (especially new framework profiles - Next.js is the reference implementation).
- Greenfield handoff and interview improvements that stay provider-agnostic unless explicitly scoped.
- Accessibility and UX fixes in existing patterns.
- Performance wins with measurable impact on scan or UI paths.

## Project guidelines (please follow)

### Privacy and trust

- **Do not** add analytics, crash reporting, or cloud sync that sends project specs, scan results, or file contents to blueprint studio-operated servers. There are no such servers today; keep it that way unless the maintainers publish an explicit, opt-in design.
- **Do not** send user data to third parties silently. AI and GitHub already require user configuration; new integrations must be **opt-in**, documented, and off by default.
- **Do not** commit secrets, API keys, `.env` files, or real paths from your machine.

### Scope and quality

- **Minimize diff size** - one concern per PR when possible.
- **Match existing code style** (TypeScript, React patterns, naming in the file you edit).
- **No drive-by refactors** unrelated to the issue you are solving.
- **Greenfield** stack choice must remain **multi-stack** (not hard-coded to one framework). Stack-specific handoff text belongs behind detection (see `greenfieldStackPolicy.ts` / `handoffNextJsGuidance.ts`).
- **Brownfield** deep analysis may be framework-specific; document limitations in README when adding partial support.

### AI and prompts

- Prompt changes in `aiService.ts` affect all users with AI enabled - describe behavior changes in the PR.
- Do not embed provider API keys or proprietary endpoints in the repo.

## Pull request process

1. Fork [KingAbe1/blueprint](https://github.com/KingAbe1/blueprint) and create a branch from `main` (or the default branch).
2. Describe **what** and **why** in the PR. Link an issue if one exists.
3. Include a **test plan** (manual steps are fine for UI/Tauri).
4. Wait for review. Maintainers may ask for changes or rebase.
5. **Do not** force-push to shared branches you do not own.

We may squash-merge to keep history readable.

## Reporting issues

Use GitHub Issues and include:

- blueprint studio version or commit, OS, web vs Tauri
- Steps to reproduce
- Expected vs actual behavior
- Redacted screenshots or logs (no API keys, no customer code)

## Governance

This is an open-source community project. Maintainers merge PRs and set direction. There is no CLA; the MIT license + contribution statement above is sufficient for typical contributions.

## Questions

Open a GitHub Discussion or issue labeled `question` if the repo has discussions enabled; otherwise use a generic issue.
