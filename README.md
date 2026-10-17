# blueprint studio

Plan a new product or scan a repo you already have. Output is either a **handoff package** for your coding agent (`AGENTS.md`, `blueprint/*.md`, IDE hints) or a **saved codebase report** on your machine.

Runs in the browser or as a Tauri desktop app. Projects live in `localStorage`; there is no hosted backend for your specs or source.

Site: [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/)  
More detail for contributors: [docs/overview.md](./docs/overview.md)

## New project

1. Product brief (rich text; optional AI polish).
2. Build questions - interview about platform, data, security, etc. Needs a configured AI provider.
3. Architecture map - one stack + topology from your answers (AI or simple heuristics).
4. Build handoff - preview files, edit if you want, download a zip or write into a project folder.

Handoff works with Cursor, VS Code, Claude Code, Codex, JetBrains, and similar. Stack in the handoff follows what the interview picked (Next.js, mobile, desktop, API, etc.).

## Existing codebase

Pick a local folder. You get overview, tree, dependencies, scripts, and quality checks. Deeper rules kick in when the repo matches a **supported profile** ([list in code](src/constants/supportedAnalysisProfiles.ts) - Next.js today). Optional AI review on files you choose.

Use the desktop build for reliable folder access and export.

## AI

One settings panel for all projects. If you turn it on, requests go to **your** provider (OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or a custom base URL). blueprint studio does not proxy them.

You can use much of greenfield without AI except the build-question step.

## Privacy (short version)

- Specs and scan results: local only. Export/import JSON from the project menu to back up.
- Scans read files on disk; they are not uploaded to us.
- GitHub and npm advisory features only use credentials or lockfile metadata you already opted into.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run tauri:dev    # desktop (alias: npm run app)
npm run tauri:build
npm run build
```

`./launch-desktop.sh` on macOS opens the dev UI in a standalone browser window.

## License & forks

[MIT](./LICENSE). You can fork, modify, and ship your own product from this code (keep the license notice in copies).

The name **blueprint studio** and the build at [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/) are the maintainer’s product. Forks are welcome; please use a different name and branding so users are not confused about who they are getting software from. That does not stop the maintainer from selling services, paid builds, or pursuing funding or acquisition around the official project.

Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), [SECURITY.md](./SECURITY.md).

Built with React 19, Vite, Tailwind 4, Tiptap, TypeScript, Tauri 2.
