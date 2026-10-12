# Blueprint Studio

Desktop and browser workstation for **spec-first greenfield planning** and **brownfield codebase analysis**, with exportable agent handoff packages for Cursor, Claude Code, VS Code, and JetBrains.

## What it does

### New product (greenfield)

1. **Product blueprint** — Describe the product; optional AI to expand the description, infer architecture facts, and run a structured architecture interview.
2. **Architecture map** — Review framework recommendation, topology, and interview decisions on an interactive map.
3. **Build handoff** — Generate `AGENTS.md`, `blueprint/*.md`, and IDE-specific rules; preview, edit, and export to a project folder (Tauri desktop or browser).

### Existing codebase (brownfield)

- Scan a local folder (Tauri or File System Access API).
- Surface languages, frameworks, structure, scripts, static quality findings, dependency inventory, and optional npm advisory scan.
- Next.js-specific analysis when detected.
- Optional AI quality review on selected source files (requires configured provider).

Projects are persisted locally (browser storage and/or `.blueprint_store.json` on disk when using Tauri).

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run tauri:dev    # native desktop shell + Vite
```

`launch-desktop.sh` opens the dev server in a standalone browser app window on macOS (Chrome / Brave / Edge).

## Stack

- React 19 + Vite + Tailwind CSS 4
- Tauri 2 (optional desktop: folder pick, file read/write for scans and handoff export)

## Contributing

Fork, branch, commit with clear rationale, open a PR.
