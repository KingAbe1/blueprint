import {
  RemixArchitecturalImprovement,
  RemixBundleAudit,
  RemixConfigAudit,
  RemixMutationAudit,
  RemixResilienceAudit,
  RemixSecurityAudit,
  RemixSeoAudit,
  RemixLoaderActionFileAudit,
} from '../../../types/framework';

export const AUTH_SIGNAL =
  /\b(?:auth\s*\(|getSession|getUser\s*\(|requireUser|requireAuth|authenticator|isAuthenticated|getToken\s*\(|verifySession|session\b|cookies\s*\()/i;

export const VALIDATION_SIGNAL =
  /\b(?:z\.|valibot|yup|zod|schema\.parse|safeParse|parseWithZod|conform)\b/i;

const SERVER_ONLY_IMPORT =
  /\bfrom\s*['"](?:fs|node:fs|path|node:path|crypto|node:crypto|child_process|node:child_process|@remix-run\/node|@prisma\/client|prisma|drizzle-orm|pg|mysql2|ioredis|redis|better-sqlite3)['"]/i;

const SECRET_ENV =
  /\bprocess\.env\.(?!REMIX_PUBLIC_)[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PRIVATE|DATABASE|DB_|API_KEY|AUTH|JWT|CREDENTIAL)[A-Z0-9_]*/i;

const HEAVY_CLIENT_LIBS =
  /\bfrom\s*['"](?:three|@react-three\/fiber|chart\.js|recharts|d3|monaco-editor|@monaco-editor\/react|leaflet|mapbox-gl|pdfjs-dist|xlsx|exceljs)['"]/i;

/** Heuristic: mutations that must not run in a loader (CSRF / GET-side effects). */
const LOADER_MUTATION_SIGNAL =
  /\b(?:\.create\(|\.update\(|\.delete\(|\.upsert\(|\.remove\(|insert(?:Into)?\b|logout\b|signOut\b|destroySession\b|commitSession\b|setCookie\b|deleteCookie\b|prisma\.\w+\.(?:create|update|delete|upsert)|db\.\w+\.(?:insert|update|delete)|await\s+\w+\.(?:save|destroy|remove)\s*\()/i;

const SECURITY_HEADER_SIGNAL =
  /Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options|Referrer-Policy|Permissions-Policy/i;

function fileName(path: string): string {
  return path.split('/').pop() || path;
}

function isSourceFile(path: string): boolean {
  return /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(path) && !/\.(?:test|spec|d)\.[^/]+$/i.test(path);
}

function looksPublicRoute(path: string): boolean {
  return /(?:^|\/)(?:login|signin|sign-in|signup|sign-up|register|auth|public|webhook|health|ready|ping|status|csrf)(?:\/|$|\.|_)/i.test(
    path.toLowerCase(),
  );
}

/** Roughly isolate an exported loader/action body for targeted heuristics. */
function extractNamedExportBlock(content: string, exportName: string): string | null {
  const pattern = new RegExp(
    `export\\s+(?:async\\s+)?(?:function\\s+${exportName}\\b|const\\s+${exportName}\\b)[\\s\\S]*`,
    'm',
  );
  const match = content.match(pattern);
  if (!match || match.index === undefined) return null;
  const rest = content.slice(match.index);
  const nextExport = rest.slice(24).search(/\nexport\s+/);
  return nextExport >= 0 ? rest.slice(0, nextExport + 24) : rest.slice(0, 3000);
}

export function isRemixRouteModule(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return (
    /(^|\/)app\/routes\//i.test(normalized) &&
    isSourceFile(normalized) &&
    !/\.(?:test|spec)\./i.test(normalized)
  );
}

export function auditRemixRouteHandlers(
  routePaths: string[],
  sourceContents: Record<string, string>,
  improvements: RemixArchitecturalImprovement[],
): { loaderAudit: RemixMutationAudit; actionAudit: RemixMutationAudit; resourceRouteCount: number } {
  const loaderFiles: RemixLoaderActionFileAudit[] = [];
  const actionFiles: RemixLoaderActionFileAudit[] = [];
  let resourceRouteCount = 0;
  let unvalidatedLoaders = 0;
  let unprotectedLoaders = 0;
  let complexLoaders = 0;
  let mutatingLoaders = 0;
  let unvalidatedActions = 0;
  let unprotectedActions = 0;
  let complexActions = 0;
  let totalLoaders = 0;
  let totalActions = 0;

  for (const path of routePaths) {
    const content = sourceContents[path] || '';
    if (!content) continue;
    const name = fileName(path);
    const lines = content.split(/\r\n|\n|\r/).length;
    const hasLoader = /\bexport\s+(?:async\s+)?function\s+loader\b|\bexport\s+const\s+loader\b/.test(content);
    const hasAction = /\bexport\s+(?:async\s+)?function\s+action\b|\bexport\s+const\s+action\b/.test(content);
    const hasClientLoader = /\bexport\s+(?:async\s+)?function\s+clientLoader\b|\bexport\s+const\s+clientLoader\b/.test(content);
    const hasClientAction = /\bexport\s+(?:async\s+)?function\s+clientAction\b|\bexport\s+const\s+clientAction\b/.test(content);
    const hasDefault =
      /\bexport\s+default\b/.test(content) || /\bas\s+default\b/.test(content);
    const isResourceRoute = (hasLoader || hasAction) && !hasDefault;
    if (isResourceRoute) resourceRouteCount += 1;

    const hasValidation = VALIDATION_SIGNAL.test(content);
    const hasAuth = AUTH_SIGNAL.test(content);
    const publicish = looksPublicRoute(path);

    const entry: RemixLoaderActionFileAudit = {
      path,
      hasLoader,
      hasAction,
      hasClientLoader,
      hasClientAction,
      isResourceRoute,
      lineCount: lines,
      hasValidation,
      hasAuth,
    };

    if (hasLoader) {
      totalLoaders += 1;
      loaderFiles.push(entry);
      const loaderBlock = extractNamedExportBlock(content, 'loader') || '';
      // Mutations belong in actions — a loader that writes/deletes is a CSRF-class smell.
      if (
        LOADER_MUTATION_SIGNAL.test(loaderBlock) ||
        (/\brequest\.formData\s*\(/.test(loaderBlock) && /\b(?:create|update|delete|logout|destroy)\b/i.test(loaderBlock))
      ) {
        mutatingLoaders += 1;
        improvements.push({
          id: `loader-mutation-${path}`,
          category: 'loader-hygiene',
          severity: 'critical',
          title: `State Mutation Inside loader (${name})`,
          impact: `${path} appears to mutate state inside a loader. Loaders can run on GET navigations, so mutations here are a CSRF risk and break Remix’s action/loader contract.`,
          remediation: 'Move creates/updates/deletes/logouts into an `action` export. Keep loaders read-only.',
          file: path,
        });
      }
      // Loaders that clearly read params/request data benefit from auth on protected routes.
      if (!hasAuth && !publicish && lines > 40 && /\b(?:request|params|context)\b/.test(content)) {
        unprotectedLoaders += 1;
        improvements.push({
          id: `loader-unprotected-${path}`,
          category: 'loader-hygiene',
          severity: 'warning',
          title: `Missing Auth Guard in loader (${name})`,
          impact: `${path} exports a loader without an obvious session/auth check. Loaders run on the server for every matched request.`,
          remediation: 'Assert authentication/authorization at the start of the loader (or a shared requireUser helper) before returning sensitive data.',
          file: path,
        });
      }
      if (lines > 120) {
        complexLoaders += 1;
        improvements.push({
          id: `loader-complexity-${path}`,
          category: 'loader-hygiene',
          severity: 'warning',
          title: `Large loader module in ${name} (${lines} LOC)`,
          impact: `${path} is a large route module. Oversized loaders often mix data access, formatting, and auth in one place.`,
          remediation: 'Extract domain services and keep the loader as a thin orchestration layer.',
          file: path,
        });
      }
    }

    if (hasAction) {
      totalActions += 1;
      actionFiles.push(entry);
      const readsForm =
        /\brequest\.(?:formData|json)\s*\(|formData\b|Object\.fromEntries/i.test(content);
      if (readsForm && !hasValidation && !publicish) {
        unvalidatedActions += 1;
        improvements.push({
          id: `action-unvalidated-${path}`,
          category: 'action-hygiene',
          severity: 'warning',
          title: `Unvalidated Action Inputs in ${name}`,
          impact: `${path} reads form/JSON input in an action without runtime schema validation (Zod/Conform/Valibot).`,
          remediation: 'Validate action form data with Zod or Conform before mutations, and return field errors on failure.',
          file: path,
        });
      }
      if (!hasAuth && !publicish && lines > 30) {
        unprotectedActions += 1;
        improvements.push({
          id: `action-unprotected-${path}`,
          category: 'action-hygiene',
          severity: 'warning',
          title: `Missing Auth Guard in action (${name})`,
          impact: `${path} exports an action without an obvious auth check. Remix actions are public POST endpoints for the route.`,
          remediation: 'Verify the session at the start of the action and throw/redirect when unauthorized.',
          file: path,
        });
      }
      if (lines > 120) {
        complexActions += 1;
        improvements.push({
          id: `action-complexity-${path}`,
          category: 'action-hygiene',
          severity: 'optimization',
          title: `Large action module in ${name} (${lines} LOC)`,
          impact: `${path} mixes a large amount of logic in the route module.`,
          remediation: 'Move mutation business logic into shared server helpers outside the route file.',
          file: path,
        });
      }
    }

    // Track validation on loaders that parse search params heavily
    if (hasLoader && /\bnew\s+URL\s*\(|searchParams\b/.test(content) && !hasValidation && lines > 50) {
      unvalidatedLoaders += 1;
      improvements.push({
        id: `loader-unvalidated-${path}`,
        category: 'loader-hygiene',
        severity: 'optimization',
        title: `Unvalidated Search Params in loader (${name})`,
        impact: `${path} reads URL/search params without schema validation.`,
        remediation: 'Parse search params with Zod (or similar) so invalid query strings fail clearly.',
        file: path,
      });
    }
  }

  return {
    resourceRouteCount,
    loaderAudit: {
      totalHandlers: totalLoaders,
      filesCount: loaderFiles.length,
      unvalidatedFilesCount: unvalidatedLoaders,
      unprotectedFilesCount: unprotectedLoaders,
      complexFilesCount: complexLoaders,
      mutatingFilesCount: mutatingLoaders,
      files: loaderFiles,
    },
    actionAudit: {
      totalHandlers: totalActions,
      filesCount: actionFiles.length,
      unvalidatedFilesCount: unvalidatedActions,
      unprotectedFilesCount: unprotectedActions,
      complexFilesCount: complexActions,
      files: actionFiles,
    },
  };
}

export function auditRemixResilience(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  routePaths: string[],
  improvements: RemixArchitecturalImprovement[],
): RemixResilienceAudit {
  const rootPath = normalizedPaths.find(path => /(^|\/)app\/root\.(?:jsx?|tsx?)$/i.test(path));
  const rootContent = rootPath ? sourceContents[rootPath] || '' : '';
  const hasRoot = Boolean(rootPath);
  const hasRootErrorBoundary =
    /\bexport\s+(?:function|const)\s+ErrorBoundary\b/.test(rootContent) ||
    normalizedPaths.some(path => /(^|\/)app\/entry\.server\./i.test(path) && /\bErrorBoundary\b/.test(sourceContents[path] || ''));
  const hasRootLayoutExport = /\bexport\s+(?:function|const)\s+Layout\b/.test(rootContent);
  const hasHydrateFallback = routePaths.some(path =>
    /\bexport\s+(?:function|const)\s+HydrateFallback\b/.test(sourceContents[path] || ''),
  );

  let routeErrorBoundaryCount = 0;
  const missingErrorBoundaryRoutes: string[] = [];
  for (const path of routePaths) {
    const content = sourceContents[path] || '';
    if (!content) continue;
    const hasDefault = /\bexport\s+default\b/.test(content);
    if (!hasDefault) continue; // resource routes
    if (/\bexport\s+(?:function|const)\s+ErrorBoundary\b/.test(content)) {
      routeErrorBoundaryCount += 1;
    } else if (content.split(/\r\n|\n|\r/).length > 80) {
      missingErrorBoundaryRoutes.push(path);
    }
  }

  if (hasRoot && !hasRootErrorBoundary) {
    improvements.push({
      id: 'resilience-missing-root-error-boundary',
      category: 'route-resilience',
      severity: 'critical',
      title: 'Missing Root ErrorBoundary',
      impact: 'Without an ErrorBoundary on app/root.tsx, uncaught loader/render errors fall back to a generic Remix error page.',
      remediation: 'Export ErrorBoundary from app/root.tsx with a recoverable UI and optional error logging.',
      file: rootPath || 'app/root.tsx',
    });
  }

  if (missingErrorBoundaryRoutes.length >= 3) {
    const sample = missingErrorBoundaryRoutes.slice(0, 3).map(fileName).join(', ');
    improvements.push({
      id: 'resilience-missing-route-error-boundaries',
      category: 'route-resilience',
      severity: 'warning',
      title: `Missing ErrorBoundary on ${missingErrorBoundaryRoutes.length} large routes`,
      impact: `Larger route modules (${sample}${missingErrorBoundaryRoutes.length > 3 ? ', …' : ''}) have no local ErrorBoundary. Failures bubble to the root and can blank larger parts of the UI.`,
      remediation: 'Add route-level ErrorBoundary exports for critical sections (dashboard, settings, checkout).',
      file: missingErrorBoundaryRoutes[0],
    });
  }

  if (!hasHydrateFallback && routePaths.some(p => /\bclientLoader\b/.test(sourceContents[p] || ''))) {
    improvements.push({
      id: 'resilience-missing-hydrate-fallback',
      category: 'route-resilience',
      severity: 'optimization',
      title: 'clientLoader Without HydrateFallback',
      impact: 'Routes using clientLoader can flash empty UI during hydration without a HydrateFallback export.',
      remediation: 'Export HydrateFallback from routes that use clientLoader to show a loading state.',
    });
  }

  return {
    hasRoot,
    hasRootErrorBoundary,
    hasRootLayoutExport,
    routeErrorBoundaryCount,
    missingErrorBoundaryRoutes: missingErrorBoundaryRoutes.slice(0, 20),
    hasHydrateFallback,
  };
}

export function auditRemixBundle(
  routePaths: string[],
  sourceContents: Record<string, string>,
  improvements: RemixArchitecturalImprovement[],
): RemixBundleAudit {
  let clientLoaderCount = 0;
  let clientActionCount = 0;
  const heavyClientRouteFiles: string[] = [];

  for (const path of routePaths) {
    const content = sourceContents[path] || '';
    if (/\bclientLoader\b/.test(content)) clientLoaderCount += 1;
    if (/\bclientAction\b/.test(content)) clientActionCount += 1;
    if (HEAVY_CLIENT_LIBS.test(content)) {
      heavyClientRouteFiles.push(path);
      improvements.push({
        id: `bundle-heavy-client-${path}`,
        category: 'bundle-optimization',
        severity: 'optimization',
        title: `Heavy Client Library in ${fileName(path)}`,
        impact: `${path} imports a heavy visualization/editor library into a route module, which can inflate the client bundle.`,
        remediation: 'Lazy-load the heavy UI behind React.lazy / a deferred client-only component.',
        file: path,
      });
    }
  }

  if (clientLoaderCount >= 5) {
    improvements.push({
      id: 'bundle-many-client-loaders',
      category: 'bundle-optimization',
      severity: 'optimization',
      title: `${clientLoaderCount} clientLoader Exports Detected`,
      impact: 'Heavy use of clientLoader moves data fetching to the browser and can hurt first load and SEO compared to server loaders.',
      remediation: 'Prefer server loaders by default; use clientLoader only when the data must be browser-only.',
    });
  }

  return {
    clientLoaderCount,
    clientActionCount,
    routeModuleCount: routePaths.length,
    heavyClientRouteFiles,
  };
}

export function auditRemixConfig(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  routePaths: string[],
  improvements: RemixArchitecturalImprovement[],
): RemixConfigAudit {
  const remixConfig = normalizedPaths.find(path => /(^|\/)remix\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path));
  const viteConfig = normalizedPaths.find(path => /(^|\/)vite\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path));
  const viteContent = viteConfig ? sourceContents[viteConfig] || '' : '';
  const usesVite =
    Boolean(viteConfig) &&
    (/@remix-run\/dev|remix\(\)|vitePluginRemix/i.test(viteContent) ||
      Object.values(manifests).some(c => /@remix-run\/dev/.test(c)));
  const usesClassicCompiler = Boolean(remixConfig) && !usesVite;
  const hasSingleFetchFlag = /v3_singleFetch\s*:\s*true/.test(viteContent);

  let usesLegacyJsonDefer = false;
  let legacyJsonDeferHits = 0;
  for (const path of routePaths) {
    const content = sourceContents[path] || '';
    if (/\b(?:json|defer)\s*\(/.test(content) && /from\s*['"]@remix-run\/(?:node|cloudflare|deno)['"]/.test(content)) {
      legacyJsonDeferHits += 1;
    }
  }
  usesLegacyJsonDefer = legacyJsonDeferHits >= 3;

  let missingLintScript = false;
  let missingTypecheckSignal = false;
  const rootPkg = manifests['package.json'];
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg) as { scripts?: Record<string, string> };
      const scriptBlob = Object.entries(pkg.scripts || {})
        .map(([name, cmd]) => `${name} ${cmd}`)
        .join('\n');
      missingLintScript = !/\b(?:lint|eslint)\b/i.test(scriptBlob);
      missingTypecheckSignal =
        !/\b(?:type-?check|tsc\b)\b/i.test(scriptBlob) &&
        !normalizedPaths.some(path => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(path));
    } catch {
      // ignore
    }
  }

  if (usesClassicCompiler) {
    improvements.push({
      id: 'modernization-classic-compiler',
      category: 'modernization',
      severity: 'optimization',
      title: 'Classic Remix Compiler Detected',
      impact: 'remix.config without a Vite-based setup is the older compiler path. Vite is the current Remix standard for DX and build performance.',
      remediation: 'Migrate to the Remix Vite plugin (@remix-run/dev) when ready, following the official migration guide.',
      file: remixConfig,
    });
  }

  if (usesVite && !hasSingleFetchFlag && usesLegacyJsonDefer) {
    improvements.push({
      id: 'modernization-single-fetch',
      category: 'modernization',
      severity: 'optimization',
      title: 'Legacy json()/defer() Without Single Fetch',
      impact: `${legacyJsonDeferHits} route modules still use json()/defer() while Vite is configured without v3_singleFetch. Single Fetch is the modern Remix data path.`,
      remediation:
        'Enable `future.v3_singleFetch` in the Remix Vite plugin and migrate loaders/actions to return raw objects (or `data()` when setting status/headers).',
      file: viteConfig,
    });
  } else if (usesVite && hasSingleFetchFlag && usesLegacyJsonDefer) {
    improvements.push({
      id: 'modernization-single-fetch-cleanup',
      category: 'modernization',
      severity: 'optimization',
      title: 'json()/defer() Still Used With Single Fetch Enabled',
      impact: 'Single Fetch is on, but routes still wrap returns in json()/defer(). Raw objects (or data()) are preferred.',
      remediation: 'Replace json()/defer() returns with plain objects; use data() only when you need custom status/headers.',
      file: viteConfig,
    });
  }

  if (missingLintScript) {
    improvements.push({
      id: 'config-missing-lint-script',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'No Lint Script in package.json',
      impact: 'Without a lint script, contributors and CI lack a standard quality gate.',
      remediation: 'Add a lint script (ESLint) and run it in CI.',
      file: 'package.json',
    });
  }

  if (missingTypecheckSignal) {
    improvements.push({
      id: 'config-missing-typecheck',
      category: 'config-delivery',
      severity: 'warning',
      title: 'No Typecheck Signal Detected',
      impact: 'TypeScript Remix apps without tsc/typecheck miss loader/action typing regressions.',
      remediation: 'Add a typecheck script (`tsc --noEmit`) and run it in CI.',
      file: 'package.json',
    });
  }

  return {
    configFile: viteConfig || remixConfig,
    usesVite,
    usesClassicCompiler,
    hasSingleFetchFlag,
    usesLegacyJsonDefer,
    missingLintScript,
    missingTypecheckSignal,
    issueCount: [usesClassicCompiler, usesLegacyJsonDefer, missingLintScript, missingTypecheckSignal].filter(Boolean)
      .length,
  };
}

export function auditRemixSecurity(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  routePaths: string[],
  improvements: RemixArchitecturalImprovement[],
): RemixSecurityAudit {
  const secretEnvInClientFiles: string[] = [];
  const serverImportInClientFiles: string[] = [];
  const serverModuleLeakFiles: string[] = [];
  const unsignedCookieFiles: string[] = [];
  const openRedirectFiles: string[] = [];
  const secretInLoaderReturnFiles: string[] = [];

  const entryServerFile = normalizedPaths.find(path => /(^|\/)app\/entry\.server\.(?:jsx?|tsx?)$/i.test(path));
  const entryServerContent = entryServerFile ? sourceContents[entryServerFile] || '' : '';
  const hasHeadersSomewhere =
    SECURITY_HEADER_SIGNAL.test(entryServerContent) ||
    normalizedPaths.some(path => {
      const c = sourceContents[path] || '';
      return /(^|\/)app\//i.test(path) && SECURITY_HEADER_SIGNAL.test(c);
    });
  const missingHeaders = Boolean(entryServerFile && entryServerContent && !hasHeadersSomewhere);

  if (missingHeaders && entryServerFile) {
    improvements.push({
      id: 'security-missing-entry-headers',
      category: 'security',
      severity: 'warning',
      title: 'No Security Headers in entry.server',
      impact: `${entryServerFile} does not set CSP / frame / HSTS-style headers. Route-level headers() exports do not merge reliably across the tree.`,
      remediation:
        'Apply baseline security headers in entry.server (and handleDataRequest for data requests), or document equivalent CDN/proxy headers.',
      file: entryServerFile,
    });
  }

  // Remix doesn't use 'use client'; treat *.client.* and clientLoader-only modules as client-ish.
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path)) continue;
    const isClientNamed = /\.client\.(?:jsx?|tsx?)$/i.test(path);
    const hasClientExport = /\b(?:clientLoader|clientAction)\b/.test(content);
    const clientLikely = isClientNamed || (hasClientExport && !/\bexport\s+(?:async\s+)?function\s+loader\b/.test(content));

    if (!clientLikely) continue;
    const name = fileName(path);

    if (SERVER_ONLY_IMPORT.test(content)) {
      serverImportInClientFiles.push(path);
      improvements.push({
        id: `security-server-import-client-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Server-only Import in Client Module (${name})`,
        impact: `${path} appears client-oriented but imports Node/server libraries. This can leak secrets or break the browser bundle.`,
        remediation: 'Keep server imports in loaders/actions or `.server.ts` modules; use `.client.ts` only for browser code.',
        file: path,
      });
    }

    if (SECRET_ENV.test(content)) {
      secretEnvInClientFiles.push(path);
      improvements.push({
        id: `security-secret-env-client-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Secret-like Env Access in Client Module (${name})`,
        impact: `${path} reads process.env values that look secret-like from client-oriented code.`,
        remediation: 'Keep secrets in server loaders/actions only. Expose intentional public env vars deliberately.',
        file: path,
      });
    }

    // Importing *.server modules into client modules
    if (/\bfrom\s*['"][^'"]+\.server(?:\.[^'"]+)?['"]/.test(content)) {
      serverModuleLeakFiles.push(path);
      improvements.push({
        id: `security-server-module-import-${path}`,
        category: 'security',
        severity: 'critical',
        title: `.server Module Imported from Client (${name})`,
        impact: `${path} imports a \`.server\` module from client-oriented code, which can pull privileged logic into the browser bundle.`,
        remediation: 'Only import `.server` modules from loaders, actions, or other server files.',
        file: path,
      });
    }
  }

  for (const path of normalizedPaths) {
    if (!/\.client\.(?:jsx?|tsx?)$/i.test(path)) continue;
    const content = sourceContents[path];
    if (!content) continue;
    if (SECRET_ENV.test(content) && !secretEnvInClientFiles.includes(path)) {
      secretEnvInClientFiles.push(path);
      improvements.push({
        id: `security-secret-env-client-named-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Secret-like Env in ${fileName(path)}`,
        impact: `${path} is a .client module reading secret-like environment variables.`,
        remediation: 'Move secret access to a .server module or loader/action.',
        file: path,
      });
    }
  }

  // Cookie / session factories without signing or secure flags
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path)) continue;
    if (!/\bcreate(?:Cookie|CookieSessionStorage|SessionStorage)\b/.test(content)) continue;
    const weakSecrets =
      /secrets\s*:\s*\[\s*['"][^'"]{0,8}['"]\s*\]/.test(content) ||
      (/createCookie(?:SessionStorage)?\s*\(/.test(content) && !/\bsecrets\s*:/.test(content));
    const missingFlags =
      /\bcreateCookie\b/.test(content) &&
      (!/\bhttpOnly\s*:\s*true/.test(content) || !/\bsameSite\s*:/.test(content));
    if (weakSecrets || missingFlags) {
      unsignedCookieFiles.push(path);
      improvements.push({
        id: `security-cookie-hygiene-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Weak Cookie/Session Config in ${fileName(path)}`,
        impact: `${path} creates cookies/sessions without strong secrets and/or httpOnly/sameSite flags.`,
        remediation:
          'Use a long random `secrets` array from env, and set `httpOnly: true`, `secure` in production, and an explicit `sameSite`.',
        file: path,
      });
    }
  }

  // Open redirects in loaders/actions
  for (const path of [...routePaths, ...normalizedPaths.filter(p => /\.server\.(?:jsx?|tsx?)$/i.test(p))]) {
    const content = sourceContents[path];
    if (!content) continue;
    if (
      /\bredirect\s*\(\s*(?:new\s+URL\s*\()?[^)]*(?:searchParams|url\.search|request\.url|formData\.get\s*\(\s*['"]redirect)/i.test(
        content,
      ) &&
      !/\b(?:safeRedirect|safe-redirect|ALLOWED|allowlist|startsWith\s*\(\s*['"]\/)/i.test(content)
    ) {
      openRedirectFiles.push(path);
      improvements.push({
        id: `security-open-redirect-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Possible Open Redirect in ${fileName(path)}`,
        impact: `${path} redirects using request-controlled values without an obvious same-origin allowlist.`,
        remediation: 'Validate redirect targets with safeRedirect (or an allowlist) before calling redirect().',
        file: path,
      });
    }
  }

  // Secrets returned from loaders (serialized to the client)
  for (const path of routePaths) {
    const content = sourceContents[path] || '';
    const loaderBlock = extractNamedExportBlock(content, 'loader');
    if (!loaderBlock) continue;
    if (
      /return\s+(?:json\s*\()?\s*\{[^}]*(?:password|secret|privateKey|apiKey|accessToken|refreshToken|process\.env\.[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD))/i.test(
        loaderBlock,
      )
    ) {
      secretInLoaderReturnFiles.push(path);
      improvements.push({
        id: `security-secret-in-loader-return-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Secret-like Data Returned from loader (${fileName(path)})`,
        impact: `${path} appears to return secret-like fields from a loader. Loader data is serialized to the browser.`,
        remediation: 'Never return secrets, tokens, or private keys from loaders. Keep privileged values on the server only.',
        file: path,
      });
    }
  }

  return {
    secretEnvInClientFiles,
    serverImportInClientFiles,
    serverModuleLeakFiles,
    missingSecurityHeaders: missingHeaders,
    entryServerFile,
    unsignedCookieFiles,
    openRedirectFiles,
    secretInLoaderReturnFiles,
    issueCount:
      secretEnvInClientFiles.length +
      serverImportInClientFiles.length +
      serverModuleLeakFiles.length +
      (missingHeaders ? 1 : 0) +
      unsignedCookieFiles.length +
      openRedirectFiles.length +
      secretInLoaderReturnFiles.length,
  };
}

export function auditRemixSeo(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  routePaths: string[],
  improvements: RemixArchitecturalImprovement[],
): RemixSeoAudit {
  const rootPath = normalizedPaths.find(path => /(^|\/)app\/root\.(?:jsx?|tsx?)$/i.test(path));
  const rootContent = rootPath ? sourceContents[rootPath] || '' : '';
  const hasRootMeta = /\bexport\s+(?:const|function)\s+meta\b/.test(rootContent);
  const hasRootLinks = /\bexport\s+(?:const|function)\s+links\b/.test(rootContent);

  const routesMissingMeta: string[] = [];
  for (const path of routePaths) {
    const content = sourceContents[path] || '';
    if (!/\bexport\s+default\b/.test(content)) continue;
    if (/\bexport\s+(?:const|function)\s+meta\b/.test(content)) continue;
    if (content.split(/\r\n|\n|\r/).filter(l => l.trim()).length < 40) continue;
    routesMissingMeta.push(path);
  }

  if (!hasRootMeta) {
    improvements.push({
      id: 'seo-missing-root-meta',
      category: 'seo-metadata',
      severity: 'warning',
      title: 'Missing Root meta Export',
      impact: 'Without a meta export on app/root.tsx, document titles/descriptions rely on defaults and hurt SEO/share previews.',
      remediation: 'Export meta from app/root.tsx (and key routes) with title and description.',
      file: rootPath || 'app/root.tsx',
    });
  }

  if (!hasRootLinks) {
    improvements.push({
      id: 'seo-missing-root-links',
      category: 'seo-metadata',
      severity: 'optimization',
      title: 'Missing Root links Export',
      impact: 'Root links() is the usual place to declare stylesheets and preloads in Remix.',
      remediation: 'Export links from app/root.tsx for global CSS and important preloads.',
      file: rootPath || 'app/root.tsx',
    });
  }

  if (!hasRootMeta && routesMissingMeta.length >= 4) {
    improvements.push({
      id: 'seo-many-routes-missing-meta',
      category: 'seo-metadata',
      severity: 'optimization',
      title: `${routesMissingMeta.length} Routes Without meta`,
      impact: 'Multiple UI routes lack meta exports, so pages share generic titles.',
      remediation: 'Add route-level meta for indexable pages.',
      file: routesMissingMeta[0],
    });
  }

  return {
    hasRootMeta,
    hasRootLinks,
    routesMissingMeta: routesMissingMeta.slice(0, 20),
    issueCount: (hasRootMeta ? 0 : 1) + (hasRootLinks ? 0 : 1),
  };
}
