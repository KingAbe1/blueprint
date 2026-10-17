# Contributing

Specs and scans stay on the user's machine. Please keep it that way unless there is a written, opt-in design.

Read [README.md](./README.md) and [docs/overview.md](./docs/overview.md) if you need context. [SECURITY.md](./SECURITY.md) for vulnerabilities. [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) applies.

Contributions are MIT-licensed like the rest of the repo ([LICENSE](./LICENSE)).

## Setup

```bash
npm install
npm run dev
npm run tauri:dev   # when testing folder export
npm run build       # must pass before PR
```

## Good PRs

- Fixes or docs that match what the app actually does today.
- New brownfield profiles: implement under `src/services/frameworks/`, register in `src/constants/supportedAnalysisProfiles.ts` (copy Next.js as the example).
- Small diffs, one topic each when you can.
- Match existing style in the file you touch.

## Please don't

- Ship analytics, cloud sync of specs/scans, or silent third-party calls.
- Commit keys, `.env`, or your local paths.
- Force greenfield to a single stack in code; stack-specific handoff belongs behind detection (see `greenfieldStackPolicy.ts`).
- Prompt changes in `aiService.ts` without saying what behavior changed in the PR description.

## Process

Fork [KingAbe1/blueprint](https://github.com/KingAbe1/blueprint), branch from `main`, open a PR with how you tested (web and/or Tauri if relevant).

Issues: version or commit, OS, steps, expected vs actual. No secrets in tickets.
