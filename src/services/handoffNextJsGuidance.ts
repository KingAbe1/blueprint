/** Shared Next.js conventions injected into greenfield handoff documents. */
export function nextJsHandoffArchitectureSection(): string {
  return `
## Next.js implementation conventions

- Scaffold with \`create-next-app\` using **TypeScript**, **ESLint**, **Tailwind CSS**, and the **App Router** (\`app/\`).
- Default to **React Server Components**; add \`'use client'\` only when the UI needs browser-only APIs or local interaction state.
- Place pages and layouts under \`app/\`; use **Route Handlers** (\`app/api/.../route.ts\`) or **Server Actions** for trusted mutations—avoid bolting on a separate Node HTTP server unless architecture explicitly requires it.
- Colocate feature modules (\`src/features/<domain>/\` or \`app/(app)/...\`) to match the blueprint domain boundaries.
- Read \`cookies()\`, \`headers()\`, and dynamic route \`params\` asynchronously (Next.js 15+).
- Keep secrets in environment variables; document names in \`.env.example\` only.
- Run \`next build\`, lint, and typecheck in CI before deploy.
`.trim();
}

export function nextJsMilestoneZeroBullets(): string {
  return `- Run \`npx create-next-app@latest\` (App Router, TypeScript, Tailwind) and commit the baseline.
- Add \`.env.example\`, formatting, \`next lint\`, and \`tsc --noEmit\` (or \`next build\`) to npm scripts.
- Create a health route (e.g. \`app/api/health/route.ts\`) and one vertical read/write slice through Server Components + a Server Action or Route Handler.
- Wire PostgreSQL (or chosen store from architecture) with migrations and a single repository module.
- Configure preview/production deploy (Vercel or container) with environment parity documented in \`blueprint/OPERATIONS.md\`.`;
}

export function nextJsAgentsWorkingAgreementBullets(): string {
  return `- Follow **Next.js App Router** patterns: Server Components first, client components only when necessary, mutations via Server Actions or Route Handlers.
- Keep new routes and modules aligned with \`blueprint/ARCHITECTURE.md\` domain boundaries.`;
}
