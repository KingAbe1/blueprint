# Contributor overview

How the app is wired for contributors. Product narrative lives on the [website](https://blueprint-web-chi.vercel.app/) and in [README.md](../README.md).

## Greenfield tabs

Order: product blueprint → architecture map → build handoff. Map and handoff stay locked until build questions finish and a stack exists.

**Brief:** Tiptap editor, `description` (plain, for AI) + optional `descriptionHtml`. Polish/undo polish in `DomainIntentView` + `aiService`.

**Interview:** `generateArchitectureInterview(name, plain description)`. Multi-select when `allowMultiple` on a question. Review screen before commit.

**Architecture:** AI path calls `analyzeFrameworksWithAI` (single result). Offline path uses `recommendFrameworkFromText`. Topology/modules patched with `applyInterviewTopology`.

**Map:** `ArchitectureMapView`, layout in `spec.architectureMapLayout` (includes Simple/Detailed). Heuristics in `architectureMapFeatures.ts` add domain modules, operators, payments, realtime, search/media, secrets, analytics, and DR when decisions imply them; Detailed also adds cache, edge, messaging, and gateway. PNG/SVG via `architectureMapExport`.

**Handoff:** `handoffService` builds files; user can edit in UI. Zip: `handoffZipDownload`. Folder: `handoffExportService` + Tauri commands in `lib.rs`. Next.js-specific copy gated by `greenfieldStackPolicy` / `handoffNextJsGuidance`. Prefs: `greenfieldHandoffPrefsStorage`.

Export list shows conflict warnings for paths that already exist on disk; after a good export, those flip to an on-disk state until the package or folder changes.

## Brownfield

Scan via Tauri directory picker or browser `showDirectoryPicker`. Result stored on `project.codebaseAnalysis`.

Sections: overview, code analysis (tree + deps + scripts), quality. Framework panel when `frameworkRegistry` finds a match.

Baseline scan always runs. Deep parsers/rules use whatever is listed in `src/constants/supportedAnalysisProfiles.ts` (Next.js implementation in `frameworks/nextjs/`).

Rescan, markdown export, optional `AIReviewPanel` with user-picked files.

## Where code lives

| Thing | Path |
| --- | --- |
| Workbench UI | `src/components/workbench/` |
| Handoff | `src/services/handoffService.ts`, `handoffExportService.ts`, `handoffZipDownload.ts` |
| Heuristic stacks | `src/services/frameworkRecommender.ts` |
| AI prompts | `src/services/aiService.ts` |
| Scan pipeline | `src/services/codebaseAnalysisService.ts`, `codebaseAnalysisLoader.ts` |
| Tauri I/O | `src-tauri/src/lib.rs` |

## Browser vs desktop

Folder pick, handoff write, and “open folder” after export are smooth on Tauri. Browser can still plan greenfield; scan/export need FS Access API or fall back to zip download.
