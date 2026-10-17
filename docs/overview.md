# blueprint studio - product & implementation overview

User-facing story and workflow live on the [marketing site](https://blueprint-web-chi.vercel.app/). This document is for contributors and power users who want more depth than the [README](../README.md).

---

## Greenfield workflow

Workbench tabs (unlocked in order):

1. **Product blueprint** (`domain-intent`)
2. **Architecture map** (`architecture-map`) - after build questions complete
3. **Build handoff** (`in-flight`) - after a final stack recommendation exists

### Product brief

- Rich-text editor (Tiptap) with optional read-only preview.
- Plain-text `description` for AI and exports; optional `descriptionHtml` for display.
- **Polish with AI** when a provider is configured; **Undo polish** restores the prior brief.
- Without AI: brief editing, heuristic stack choice, map, and handoff still work; interview generation needs AI (or shows an error).

### Build questions

- AI-generated when configured, scoped to project name + plain description.
- Multi-select answers where the model sets `allowMultiple`.
- Review step; one final architecture (not multiple competing stacks).

### Final architecture

- With AI: `analyzeFrameworksWithAI` → single recommendation (stack, topology, modules, deploy target, etc.).
- Without AI: `recommendFrameworkFromText` (up to three heuristic options; first is primary).
- Interview adjusts topology and modules (`applyInterviewTopology`).

### Architecture map

- Interactive stack, topology, modules, decisions.
- Layout persists in `spec.architectureMapLayout`.
- Export PNG or SVG (Tauri save dialog or browser download).

### Build handoff

- Preview, edit, then **Download ZIP** or **Add files to project** (folder pick, conflict detection, overwrite confirm).
- IDE targets: Cursor, VS Code, Codex, Claude Code, JetBrains, Other.
- Typical files: `AGENTS.md`, `blueprint/PRODUCT.md`, `blueprint/ARCHITECTURE.md`, `blueprint/ROADMAP.md`, `blueprint/REQUIREMENTS.md`, `blueprint/INTEGRATIONS.md`, `blueprint/OPERATIONS.md`, `blueprint/ACCEPTANCE_CRITERIA.md`, `blueprint/MANIFEST.md`, plus IDE-specific rules.
- When the chosen stack is Next.js, extra App Router / Milestone 0 guidance is injected (`handoffNextJsGuidance.ts`).
- Export UI: amber = path exists and would be replaced; green “on disk” after a successful export until preview edit, folder change, or regenerate.
- Per-project handoff prefs: `greenfieldHandoffPrefsStorage`.

---

## Brownfield workflow

Local directory scan → `CodebaseAnalysis` on the project.

### Sections

- **Overview** - summary, languages, frameworks, structure, suggestions, topology, optional GitHub.
- **Code analysis** - tree, dependencies, scripts, framework specialization when a deep profile matches.
- **Quality & risks** - dimensions, static findings, optional AI review on selected files.

### Supported profiles

Baseline scan always. Deep profiles listed in [`src/constants/supportedAnalysisProfiles.ts`](../src/constants/supportedAnalysisProfiles.ts). Implementations under `src/services/frameworks/`. Reference today: Next.js (`nextJsAnalyzer.ts`), `architectureAnalysisService.ts`, `codeQualityRules.ts`.

Rescan, export markdown report, open in external IDE (protocol / CLI hints).

---

## Repository layout

| Area | Location |
| --- | --- |
| Greenfield UI | `src/components/workbench/` |
| Handoff | `src/services/handoffService.ts`, `handoffExportService.ts`, `handoffZipDownload.ts` |
| Stack heuristics | `src/services/frameworkRecommender.ts` |
| AI | `src/services/aiService.ts` |
| Brownfield | `src/services/codebaseAnalysisService.ts`, `codebaseAnalysisLoader.ts` |
| Tauri | `src-tauri/src/lib.rs` |

---

## Desktop vs browser (handoff & scan)

| Feature | Tauri | Browser |
| --- | --- | --- |
| Brownfield folder pick | Native dialog | `showDirectoryPicker` where supported |
| Handoff to folder | `export_handoff_files` | File System Access API |
| Handoff ZIP | Save dialog | Save picker or download |
| Open exported folder | `open_handoff_folder` | Manual |
