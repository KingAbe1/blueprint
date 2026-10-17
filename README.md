# Blueprint Studio

**Website:** [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/) · **Source:** [github.com/KingAbe1/blueprint](https://github.com/KingAbe1/blueprint)

*Architectural rigor for the generative era* - a desktop and browser workstation for **spec-first greenfield planning** and **brownfield codebase analysis**, with exportable agent handoff packages for Cursor, Claude Code, VS Code, Codex, JetBrains, and other IDEs.

The [marketing site](https://blueprint-web-chi.vercel.app/) explains the product story and workflow; **this repository** is the open-source Blueprint Studio app (run locally or build the Tauri desktop shell).

Blueprint itself is a **Tauri 2 + Vite + React 19** app. Projects you create in greenfield mode can target **any stack** the interview selects (Next.js, Tauri, Expo, FastAPI, and others). Brownfield scanning works on any local folder; **deep code-quality profiles are implemented for Next.js (TypeScript/JavaScript) today**.

---

## Two project modes

| Mode | How you start | What you get |
| --- | --- | --- |
| **Greenfield** | Home → **Plan a new project** | Product brief → build questions → architecture map → agent handoff package |
| **Brownfield** | Home → **Understand an existing codebase** → pick a folder | Local scan stored on the project; overview, code analysis, and quality views |

A project is one or the other: greenfield projects have no `codebaseAnalysis`; brownfield projects skip the workbench phases and open the codebase workspace.

---

## Greenfield workflow

Header tabs (unlocked in order):

1. **Product blueprint** (`domain-intent`)
2. **Architecture map** (`architecture-map`) - after build questions are completed
3. **Build handoff** (`in-flight`) - after a final stack recommendation exists

### Product brief

- Rich-text editor (Tiptap) with optional **Preview** (read-only).
- Plain-text `description` is kept for AI and exports; optional `descriptionHtml` for display.
- **Polish with AI** (expand / tighten / polish) when a provider is configured; **Undo polish** restores the prior brief.
- AI is optional for the whole flow; without it, stack choice uses heuristics in `frameworkRecommender.ts`.

### Build questions (architecture interview)

- **Start build questions** calls `generateArchitectureInterview` using the **project name** and **plain product description** (not HTML).
- Questions are AI-generated when configured; inferred facts from the brief reduce duplicate questions.
- Supports **multi-select** answers where the model sets `allowMultiple`.
- Review step before finishing; completed interview drives **one final architecture** (not a menu of alternatives).

### Final architecture

- With AI: `analyzeFrameworksWithAI` returns a single JSON recommendation (stack, topology, modules, deploy target, etc.).
- Without AI: `recommendFrameworkFromText` suggests up to three stacks from keyword heuristics.
- Interview answers adjust topology and module names (`applyInterviewTopology`).

### Architecture map

- Interactive map of stack, topology, modules, and interview decisions.
- Layout (node positions, zoom, pan) persists in `spec.architectureMapLayout`.
- Export map as **PNG** or **SVG** (browser download or Tauri save dialog).

### Build handoff

Generates a preview-editable package, then:

- **Download ZIP** - save dialog on desktop; File System Access API or fallback download in the browser.
- **Add files to project** - pick a folder (Tauri or `showDirectoryPicker`), detect path conflicts, confirm overwrites, write files via Rust or the File System Access API.

**Handoff contents (typical):**

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Entry point and working agreement for coding agents |
| `blueprint/PRODUCT.md` | Product intent and boundaries |
| `blueprint/ARCHITECTURE.md` | Stack, topology, modules, decision table |
| `blueprint/ROADMAP.md` | Milestone-ordered implementation plan |
| `blueprint/REQUIREMENTS.md` | Functional and non-functional constraints |
| `blueprint/INTEGRATIONS.md` | External services and integration rules |
| `blueprint/OPERATIONS.md` | Hosting, delivery, runbooks |
| `blueprint/ACCEPTANCE_CRITERIA.md` | Definition of done |
| `blueprint/MANIFEST.md` | Generation metadata |
| IDE-specific file | e.g. `.cursor/rules/blueprint.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.aiassistant/rules/blueprint.md` |

When the selected stack is **Next.js**, handoff also injects App Router conventions, Milestone 0 (`create-next-app`, health route, etc.) via `handoffNextJsGuidance.ts`. Other stacks get generic milestone wording tied to the chosen recommendation.

**Target IDE** (handoff): Cursor, VS Code, Codex, Claude Code, JetBrains, Other.

**Folder status UI:** amber warnings mean a path **already exists** in the chosen folder and would be replaced on export; after a successful export, matching files show **on disk** until you edit the preview, change folder, or regenerate the package.

Handoff folder and IDE preferences are remembered per project in `greenfieldHandoffPrefsStorage`.

---

## Brownfield workflow

Pick a local directory (Tauri native dialog or browser File System Access API). Blueprint walks the tree, reads manifests and selected sources, and stores a `CodebaseAnalysis` snapshot on the project.

### Sections

- **Project overview** - hero summary, languages, frameworks, structure, suggestions, topology diagram, GitHub link (optional token).
- **Code analysis** - file tree, dependency inventory (packages tab), npm scripts (scripts tab), framework specialization panel when applicable.
- **Quality & risks** - scored dimensions, static findings, extended rules, optional **AI quality review** on chosen files.

### Next.js vs everything else

| Capability | Next.js TS/JS project | Other stacks |
| --- | --- | --- |
| Language / framework detection | Yes | Yes |
| Structure, scripts, dependencies | Yes | Yes |
| npm advisory scan (lockfile metadata) | Yes | Yes |
| Deep parse, App Router / RSC rules, `nextJsAnalyzer` | Yes | Not yet |
| Next.js specialization UI | Yes | Hidden; generic framework badges only |
| Quality checks message | Full profile when sources parse | “Profile not implemented” / partial signals |

Implementation lives under `src/services/frameworks/nextjs/`, `architectureAnalysisService.ts`, `codeQualityRules.ts`, and related views.

### Rescan and export

- **Rescan** re-runs analysis with progress overlay.
- **Export report** (toolbar) produces a markdown summary of the scan.
- Open in external IDE via protocol links or copied CLI commands (VS Code, Cursor, Windsurf, JetBrains, Zed, Sublime, etc.).

---

## AI configuration

One **global** AI setup (all projects), stored in `localStorage`:

- Providers: **OpenAI**, **Anthropic**, **Google Gemini**, **Ollama** (local), **OpenRouter**, **Custom** (OpenAI-compatible base URL).
- Used for: product polish, architecture interview, final stack JSON, optional brownfield file review.
- Prompts go **directly to the provider you configure** - not through Blueprint servers.
- Greenfield shows a dismissible banner until AI is connected or dismissed.

Without API keys, greenfield still works for brief editing, heuristic stack choice, map, and handoff; interview generation requires configuration (or fails with a clear error).

---

## Data and privacy

- **Projects and specs** - `localStorage` (`blueprint_projects_list`, active project id, tab preference, AI settings). Use **Export JSON** from the project menu for backup; import restores projects.
- **Codebase scans** - analysis results live on the project in localStorage; source files are read locally for scanning only and are not uploaded to Blueprint.
- **Optional GitHub** - token you supply; requests go to GitHub for repo metadata/status.
- **Dependency advisories** - may call public npm/OSV APIs using **package names and versions** from the lockfile, not your full source tree.
- No account or login.

---

## Run locally

```bash
npm install
npm run dev          # Vite → http://localhost:5173
npm run tauri:dev    # Tauri desktop shell + Vite (alias: npm run app)
npm run tauri:build  # Production desktop build
npm run build        # Web build (tsc + vite)
```

`launch-desktop.sh` (macOS) opens the dev server in a standalone browser app window (Chrome / Brave / Edge).

**Desktop vs browser**

| Feature | Tauri | Browser |
| --- | --- | --- |
| Brownfield folder pick | Native dialog | `showDirectoryPicker` where supported |
| Handoff export to folder | `export_handoff_files` | File System Access API |
| Handoff ZIP | Save dialog + write | Save picker or download |
| Open exported folder | `open_handoff_folder` | Manual |

---

## Repository layout (implementation)

| Area | Location |
| --- | --- |
| Greenfield UI | `src/components/workbench/` (`DomainIntentView`, `ArchitectureMapView`, `BuildHandoffView`, `ProductBriefRichEditor`) |
| Handoff generation | `src/services/handoffService.ts`, `handoffExportService.ts`, `handoffZipDownload.ts` |
| Stack heuristics | `src/services/frameworkRecommender.ts` |
| AI prompts | `src/services/aiService.ts` |
| Brownfield analysis | `src/services/codebaseAnalysisService.ts`, `codebaseAnalysisLoader.ts` |
| Next.js analyzer | `src/services/frameworks/nextjs/nextJsAnalyzer.ts` |
| Tauri commands | `src-tauri/src/lib.rs` (`inspect_handoff_conflicts`, `export_handoff_files`, `write_export_file`, …) |

---

## Stack (this app)

- React 19, Vite, Tailwind CSS 4, Tiptap (product brief)
- Tauri 2 + `@tauri-apps/plugin-dialog`
- TypeScript throughout

---

## Open source

| Document | Purpose |
| --- | --- |
| [LICENSE](./LICENSE) | **MIT** - use, modify, and distribute with attribution |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Setup, PR process, **project rules** (privacy, scope, no secrets) |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community behavior standards |
| [SECURITY.md](./SECURITY.md) | How to report vulnerabilities privately |

**Trademark:** The name *Blueprint Studio* identifies this project. The MIT license does not grant permission to use the name or branding to imply endorsement or ship a confusingly similar product. Forks should use their own name and logo unless maintainers agree otherwise.

Optional maintainer setup: enable [Dependabot](https://github.com/KingAbe1/blueprint/settings/security_analysis), [private vulnerability reporting](https://github.com/KingAbe1/blueprint/security/advisories), and a security contact on the repo profile. You may replace `Copyright (c) 2026 Blueprint Studio contributors` in [LICENSE](./LICENSE) with your legal name or organization.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). In short: fork, branch, `npm run build`, open a PR with a test plan.
