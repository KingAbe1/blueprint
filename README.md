# blueprint studio

*Architectural rigor for the generative era.*

Local-first workstation for **planning new products** and **understanding existing codebases**, with exportable agent handoff packages for Cursor, Claude Code, VS Code, Codex, JetBrains, and other IDEs.

**Product overview:** [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/)

---

## What it does

| Mode | Start from home | Outcome |
| --- | --- | --- |
| **Plan a new project** | Product brief → build questions → architecture map | Reviewable **build handoff** (`AGENTS.md`, `blueprint/*.md`, IDE rules) to zip or write into a repo |
| **Understand a codebase** | Pick a local folder | Overview, structure, quality signals, optional AI review on selected files |

Greenfield and brownfield are separate project types in the app (you choose one path per project).

Brownfield runs a **baseline scan** on any folder. **Deep language/framework profiles** (parsers, rules, specialization UI) apply when the repo matches a [supported profile](src/constants/supportedAnalysisProfiles.ts) - **Next.js (JavaScript / TypeScript)** today, with more planned.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run tauri:dev    # desktop shell + Vite (recommended for folder pick & handoff export)
npm run tauri:build  # production desktop build
npm run build        # web build
```

macOS: `./launch-desktop.sh` opens the dev app in a standalone browser window.

**Desktop vs browser:** Tauri adds native folder dialogs, handoff export, and “open folder” after export. The web build works for greenfield planning; folder scan/export need Chromium File System Access API or desktop.

---

## AI & privacy

- **Optional AI** (one global setup in the app): polish brief, build questions, final architecture, brownfield file review. Prompts go **directly to the provider you configure** (OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or custom URL) - not through blueprint studio servers.
- **Projects and scans** stay in **browser localStorage** on your machine. Export JSON from the project menu to back up. Code is read locally for scans; it is not uploaded to a blueprint studio cloud.
- **Optional GitHub token** and **npm/OSV advisory lookups** use only what you configure or lockfile metadata (names/versions), not your full source tree.
- No account or login.

More detail: [docs/overview.md](./docs/overview.md).

---

## Open source

| | |
| --- | --- |
| [LICENSE](./LICENSE) | MIT |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup, PR expectations, project rules |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community standards |
| [SECURITY.md](./SECURITY.md) | Report vulnerabilities privately |

**Trademark:** *blueprint studio* is this project’s name. The MIT license does not grant use of the name or branding to imply endorsement; forks should use their own branding unless maintainers agree otherwise.

Contributors: fork, branch, ensure `npm run build` passes, open a PR with a test plan.

---

## Stack

React 19, Vite, Tailwind CSS 4, Tiptap, TypeScript, Tauri 2.
