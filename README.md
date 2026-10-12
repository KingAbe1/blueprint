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

Projects are persisted **on your machine only** (browser storage and/or `.blueprint_store.json` in dev/Tauri)—not on a Blueprint-hosted cloud.

## Data & privacy

- **Codebase scans** run locally. File contents used for analysis stay on your device except where you explicitly opt in (see below).
- **Blueprint does not** operate a cloud repository for your company code, scan results, or project specs.
- **Optional AI** (architecture interview, description polish, quality review): prompts are sent from your browser/desktop app **directly to the provider you configure** (OpenAI, Anthropic, Ollama on localhost, etc.). Use Ollama or your org’s gateway if nothing may leave your network.
- **Optional GitHub status** uses a token you supply; requests go to GitHub, not Blueprint.
- **Dependency advisories** may query public npm/OSV APIs using package names and versions from your lockfile—not your source tree.

When you add real login later, treat it as **identity and access** to the app—not as permission to sync source code to Blueprint servers.

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
