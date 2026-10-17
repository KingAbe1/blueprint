# blueprint studio

*Architectural rigor for the generative era.*

AI makes it fast to generate code. **blueprint studio** helps you decide what *should* be built first: product intent, architecture choices, constraints, and a structured handoff so Cursor, Claude Code, VS Code, Codex, JetBrains, and similar tools implement against a shared plan - not ad-hoc prompts alone.

Everything runs **local-first** on your machine (browser or Tauri desktop). There is no blueprint studio cloud for your specs, scans, or source trees.

**Story & workflow:** [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/)

### Plan a new product (greenfield)

Turn a rough idea into something an agent can execute:

1. **Product blueprint** - capture who it’s for, scope, and first-release boundaries (optional AI polish).
2. **Build questions** - structured interview so platform, data, security, and shape decisions are explicit before stack selection.
3. **Architecture map** - one recommended stack and topology, visualized from your answers.
4. **Build handoff** - generated `AGENTS.md`, `blueprint/*.md` (product, architecture, roadmap, requirements, acceptance criteria), and IDE-specific rules. Preview, edit, then zip or write into a real project folder.

Greenfield supports **multiple stacks** from the interview (web, mobile, desktop, API, etc.); handoff text follows the stack you chose.

### Understand an existing codebase (brownfield)

Point at a local repo to see how it is put together:

- Languages, frameworks, layout, scripts, dependencies, and static quality signals.
- **Supported deep profiles** add framework-specific rules and review UI when the repo matches (see [supported profiles](src/constants/supportedAnalysisProfiles.ts) - **Next.js (JavaScript / TypeScript)** today, more planned).
- Optional **AI quality review** on files you pick, using your configured provider.

Each project is either greenfield or brownfield - you pick the path when you start.

---

## Quick reference

| Path | You start with | You leave with |
| --- | --- | --- |
| **Plan a new project** | A product idea / brief | Agent-ready blueprint package in your repo |
| **Understand a codebase** | A folder on disk | A saved scan + quality overview on this device |

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
