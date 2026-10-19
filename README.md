# blueprint studio

Local studio to **plan a new product** or **scan an existing repo**. You get agent handoff files or a codebase report—not generated app code.

Works in the **browser** or as a **desktop app** (Tauri). Specs and scans stay on your machine; there is no hosted backend for your projects.

| | |
| --- | --- |
| Website | [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/) |
| Releases | [github.com/KingAbe1/blueprint/releases](https://github.com/KingAbe1/blueprint/releases) |
| Contributor notes | [docs/overview.md](./docs/overview.md) |

---

## What it does

### New project (greenfield)

1. Product brief (rich text; optional AI polish)
2. Build questions — platform, data, security, etc. (needs a configured AI provider)
3. Architecture map — stack + topology from your answers
4. Build handoff — preview, edit, download a zip, or write into a project folder

Handoff works with Cursor, VS Code, Claude Code, Codex, JetBrains, and similar tools. The stack follows what you chose in the interview—not a hard-coded template.

### Existing codebase (brownfield)

Pick a local folder for overview, tree, dependencies, scripts, and quality checks. Deeper framework review runs when the repo matches a [supported profile](src/constants/supportedAnalysisProfiles.ts) (Next.js today). Optional AI review on files you choose.

Use the **desktop app** for reliable folder access and writing handoffs to disk.

---

## Install

Download installers from **[Releases](https://github.com/KingAbe1/blueprint/releases)**:

| Platform | File to use |
| --- | --- |
| macOS Apple Silicon (M1–M5…) | `.dmg` with `aarch64` in the name |
| macOS Intel | `.dmg` with `x64` in the name |
| Windows | `.msi` or NSIS installer |
| Linux | `.deb` or `.AppImage` |

### macOS: “damaged and can’t be opened”

Builds are not Apple-notarized yet. After dragging the app to **Applications**:

```bash
xattr -cr "/Applications/blueprint studio.app"
```

Then open the app again (or right-click → **Open**). That clears the download quarantine flag; the app is not actually damaged.

---

## Develop from source

```bash
npm install
npm run dev          # browser — http://localhost:5173
npm run tauri:dev    # desktop (alias: npm run app)
npm run tauri:build  # local installers
npm run build        # frontend only
```

On macOS, `./launch-desktop.sh` opens the web UI in a standalone browser window.

Desktop CI builds for macOS, Windows, and Linux run via GitHub Actions. Publishing a tag like `v1.0.1` triggers a full [release](https://github.com/KingAbe1/blueprint/releases).

---

## AI

Optional. One settings panel for all projects. Requests go to **your** provider (OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or a custom base URL)—blueprint studio does not proxy them.

Much of the app works without AI. Greenfield **build questions** need a provider; scans and handoff preview do not.

## Privacy

- Specs and scan results stay local. Export/import JSON from the project menu to back up.
- Scans read files on disk; they are not uploaded to us.
- GitHub / npm advisory features only use credentials or lockfile data you already opted into.

---

## License & forks

[MIT](./LICENSE). Fork, modify, and ship your own product (keep the license notice).

The name **blueprint studio** and [blueprint-web-chi.vercel.app](https://blueprint-web-chi.vercel.app/) are the maintainer’s product. Forks are welcome—please use a different name and branding so users know who they are getting software from. That does not stop the maintainer from selling services, paid builds, or pursuing funding around the official project.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), and [SECURITY.md](./SECURITY.md).

Stack: React 19 · Vite · Tailwind 4 · Tiptap · TypeScript · Tauri 2
