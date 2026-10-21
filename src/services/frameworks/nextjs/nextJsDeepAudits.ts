import {
  NextJsApiAudit,
  NextJsArchitecturalImprovement,
  NextJsCachingAudit,
  NextJsConfigAudit,
  NextJsSecurityAudit,
  NextJsSeoAudit,
} from '../../../types/framework';
import { firstMatchLine } from '../../findingLineResolve';

export const AUTH_SIGNAL =
  /\b(?:auth\s*\(|getServerSession|createClient|supabase\.auth|currentUser|getUser\s*\(|clerkClient|auth\(\)|requireAuth|requireUser|getToken\s*\(|verifyToken|session|cookies\s*\()/i;

export const VALIDATION_SIGNAL =
  /\b(?:z\.|valibot|yup|zod|schema\.parse|safeParse|parseAsync)\b/i;

const SERVER_ONLY_IMPORT =
  /\bfrom\s*['"](?:fs|node:fs|path|node:path|crypto|node:crypto|child_process|node:child_process|net|node:net|dns|node:dns|os|node:os|server-only|@prisma\/client|prisma|drizzle-orm|mongoose|mongodb|pg|mysql2|ioredis|redis|better-sqlite3)['"]/i;

const SECRET_ENV_IN_CLIENT =
  /\bprocess\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PRIVATE|DATABASE|DB_|API_KEY|AUTH|JWT|CREDENTIAL)[A-Z0-9_]*/i;

const HEAVY_CLIENT_LIBS =
  /\bfrom\s*['"](?:three|@react-three\/fiber|chart\.js|recharts|d3|monaco-editor|@monaco-editor\/react|leaflet|mapbox-gl|pdfjs-dist|xlsx|exceljs)['"]/i;

function fileName(path: string): string {
  return path.split('/').pop() || path;
}

function isSourceFile(path: string): boolean {
  return /\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/i.test(path) && !/\.(?:test|spec|d)\.[^/]+$/i.test(path);
}

function looksPublicOrAuthRoute(path: string): boolean {
  const lower = path.toLowerCase();
  return /(?:^|\/)(?:login|signin|sign-in|signup|sign-up|register|auth|public|webhook|health|ready|livez|readyz|ping|status|version|csrf|favicon|og|opengraph|cron|ingest)(?:\/|$|\.)/i.test(
    lower,
  );
}

function handlerMutatesState(content: string, kind: 'route-handler' | 'pages-api'): boolean {
  if (/\bexport\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/i.test(content)) return true;
  if (/\breq\.method\b[\s\S]{0,120}(?:POST|PUT|PATCH|DELETE)/i.test(content)) return true;
  if (/\brequest\.method\b[\s\S]{0,120}(?:POST|PUT|PATCH|DELETE)/i.test(content)) return true;
  // pages/api often uses a default export; only treat as mutation when body/write signals appear.
  if (kind === 'pages-api') {
    return /\breq\.body\b|\.json\s*\(|insert\b|update\b|delete\b|create\b|mutate\b/i.test(content);
  }
  return false;
}

function handlerReadsBody(content: string): boolean {
  return /\b(?:req\.body|request\.json\s*\(|req\.json\s*\(|formData\s*\()/i.test(content);
}

export function auditApiRoutes(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  improvements: NextJsArchitecturalImprovement[],
): NextJsApiAudit {
  const appRouteHandlers = normalizedPaths.filter(
    path =>
      path.toLowerCase().split('/').includes('app') &&
      /\/route\.(?:js|ts|mjs|cjs|mts|cts)$/i.test(path) &&
      isSourceFile(path),
  );

  const pagesApi = normalizedPaths.filter(path => {
    const segments = path.toLowerCase().split('/');
    const pagesIndex = segments.lastIndexOf('pages');
    return (
      pagesIndex >= 0 &&
      segments[pagesIndex + 1] === 'api' &&
      isSourceFile(path)
    );
  });

  const auditedFiles: NextJsApiAudit['auditedFiles'] = [];
  let unvalidatedFilesCount = 0;
  let unprotectedFilesCount = 0;

  const auditFile = (path: string, kind: 'route-handler' | 'pages-api') => {
    const content = sourceContents[path] || '';
    const name = fileName(path);
    const hasValidation = VALIDATION_SIGNAL.test(content);
    const hasAuth = AUTH_SIGNAL.test(content);
    const publicish = looksPublicOrAuthRoute(path);
    const mutates = handlerMutatesState(content, kind);
    const readsBody = handlerReadsBody(content);
    const getOnly =
      /\bexport\s+(?:async\s+)?(?:function|const)\s+GET\b/i.test(content) &&
      !/\bexport\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/i.test(content);

    // Skip trivial health/public GET handlers — validation/auth noise.
    if (publicish && (getOnly || content.length < 120)) {
      auditedFiles.push({ path, kind, hasValidation, hasAuth });
      return;
    }

    if (mutates && readsBody && !hasValidation && content.length > 80) {
      unvalidatedFilesCount += 1;
      improvements.push({
        id: `api-unvalidated-${path}`,
        category: 'api-hygiene',
        severity: 'warning',
        title: `Unvalidated API Inputs in ${name}`,
        impact: `${path} accepts request bodies without runtime schema validation. Malformed payloads can crash handlers or corrupt data.`,
        remediation:
          'Parse request JSON/query with Zod (or similar) before business logic, and return 400 on validation failure.',
        file: path,
        line: firstMatchLine(
          content,
          /request\.json\(|req\.body|export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)/i,
        ),
      });
    }

    if (mutates && !hasAuth && !publicish && content.length > 80) {
      unprotectedFilesCount += 1;
      improvements.push({
        id: `api-unprotected-${path}`,
        category: 'api-hygiene',
        severity: 'warning',
        title: `Missing Auth Guard in ${name}`,
        impact: `${path} appears to mutate or expose data without verifying caller identity. Route Handlers and pages/api endpoints are publicly reachable.`,
        remediation:
          'Verify session/token at the top of the handler and return 401/403 when unauthorized. Public webhooks should verify signatures instead.',
        file: path,
        line: firstMatchLine(
          content,
          /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE|GET)|req\.body|request\.json\(/i,
        ),
      });
    }

    auditedFiles.push({ path, kind, hasValidation, hasAuth });
  };

  for (const path of appRouteHandlers) auditFile(path, 'route-handler');
  for (const path of pagesApi) auditFile(path, 'pages-api');

  return {
    routeHandlerCount: appRouteHandlers.length,
    pagesApiCount: pagesApi.length,
    unvalidatedFilesCount,
    unprotectedFilesCount,
    auditedFiles,
  };
}

export function auditNextConfig(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  improvements: NextJsArchitecturalImprovement[],
): NextJsConfigAudit {
  const configPath = normalizedPaths.find(path =>
    /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path),
  );
  const content = configPath ? sourceContents[configPath] || '' : '';

  const ignoreBuildErrors = /typescript\s*:\s*\{[\s\S]*?ignoreBuildErrors\s*:\s*true/i.test(content);
  const ignoreDuringBuilds = /eslint\s*:\s*\{[\s\S]*?ignoreDuringBuilds\s*:\s*true/i.test(content);
  const hasSecurityHeaders =
    /\bheaders\s*[:(]/.test(content) ||
    /Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options/i.test(content);
  const hasStandaloneOutput = /output\s*:\s*['"]standalone['"]/i.test(content);
  const openImageRemotePatterns =
    /remotePatterns\s*:\s*\[[\s\S]*?hostname\s*:\s*['"]\*\*?['"]/i.test(content) ||
    /domains\s*:\s*\[[^\]]*['"]\*['"]/i.test(content);

  let missingLintScript = false;
  let missingTypecheckSignal = false;
  const rootPkg = manifests['package.json'];
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg) as {
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      const scripts = pkg.scripts || {};
      const scriptBlob = Object.entries(scripts)
        .map(([name, cmd]) => `${name} ${cmd}`)
        .join('\n');
      missingLintScript = !/\b(?:lint|next\s+lint|eslint)\b/i.test(scriptBlob);
      missingTypecheckSignal =
        !/\b(?:type-?check|tsc\b|next\s+build)\b/i.test(scriptBlob) &&
        !normalizedPaths.some(path => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(path));
      const hasEslintNext =
        Boolean(pkg.devDependencies?.['eslint-config-next'] || pkg.dependencies?.['eslint-config-next']) ||
        /\beslint-config-next\b/.test(rootPkg);
      if (!hasEslintNext && Object.keys(scripts).length > 0) {
        improvements.push({
          id: 'config-missing-eslint-config-next',
          category: 'config-delivery',
          severity: 'optimization',
          title: 'eslint-config-next Not Detected',
          impact:
            'Without eslint-config-next, App Router correctness rules (server/client boundaries, hook misuse) are easy to miss in CI.',
          remediation: 'Add eslint-config-next and wire `next lint` (or flat ESLint config) into your lint script.',
          file: 'package.json',
        });
      }
    } catch {
      // ignore invalid package.json
    }
  }

  if (ignoreBuildErrors && configPath) {
    improvements.push({
      id: 'config-ignore-build-errors',
      category: 'config-delivery',
      severity: 'critical',
      title: 'TypeScript Errors Ignored During next build',
      impact:
        'typescript.ignoreBuildErrors allows production builds with type errors, hiding correctness bugs until runtime.',
      remediation: 'Remove ignoreBuildErrors and fix type errors (or gate them in CI with tsc --noEmit).',
      file: configPath,
    });
  }

  if (ignoreDuringBuilds && configPath) {
    improvements.push({
      id: 'config-ignore-eslint-builds',
      category: 'config-delivery',
      severity: 'warning',
      title: 'ESLint Ignored During next build',
      impact: 'eslint.ignoreDuringBuilds skips lint failures on production builds, so regressions can ship unnoticed.',
      remediation: 'Remove ignoreDuringBuilds and run lint in CI before deploy.',
      file: configPath,
    });
  }

  if (configPath && content && !hasSecurityHeaders) {
    improvements.push({
      id: 'config-missing-security-headers',
      category: 'config-delivery',
      severity: 'warning',
      title: 'No Security Headers in next.config',
      impact:
        'Missing CSP / frame / content-type headers leaves the app more exposed to clickjacking and some XSS classes unless set at the CDN/proxy.',
      remediation:
        'Add a headers() async config returning Content-Security-Policy, X-Frame-Options, and related baselines—or document equivalent edge/CDN headers.',
      file: configPath,
    });
  }

  if (configPath && content && !hasStandaloneOutput) {
    const dockerfilePresent = normalizedPaths.some(
      path => /(^|\/)dockerfile$/i.test(path) || /(^|\/)docker-compose\./i.test(path),
    );
    if (dockerfilePresent) {
      improvements.push({
        id: 'config-missing-standalone',
        category: 'config-delivery',
        severity: 'optimization',
        title: 'Docker Detected Without output: "standalone"',
        impact:
          'Container deploys usually ship smaller, more reliable images when Next.js emits a standalone server output.',
        remediation: 'Set `output: "standalone"` in next.config and copy `.next/standalone` in the Dockerfile.',
        file: configPath,
      });
    }
  }

  if (openImageRemotePatterns && configPath) {
    improvements.push({
      id: 'config-open-image-remote',
      category: 'config-delivery',
      severity: 'warning',
      title: 'Overly Open next/image Remote Patterns',
      impact: 'Wildcard image hostnames can be abused for bandwidth theft and SSRF-style image proxying.',
      remediation: 'Restrict images.remotePatterns (or domains) to the exact hostnames you control.',
      file: configPath,
    });
  }

  if (missingLintScript) {
    improvements.push({
      id: 'config-missing-lint-script',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'No Lint Script in package.json',
      impact: 'Without a lint script, contributors and CI have no standard Next.js quality gate.',
      remediation: 'Add a `lint` script that runs `next lint` or ESLint with eslint-config-next.',
      file: 'package.json',
    });
  }

  if (missingTypecheckSignal) {
    improvements.push({
      id: 'config-missing-typecheck',
      category: 'config-delivery',
      severity: 'warning',
      title: 'No Typecheck Signal Detected',
      impact: 'TypeScript projects without tsc/typecheck (or relying only on an ignored build) miss correctness regressions.',
      remediation: 'Add a typecheck script (`tsc --noEmit`) and run it in CI alongside `next build`.',
      file: 'package.json',
    });
  }

  const issueFlags = [
    ignoreBuildErrors,
    ignoreDuringBuilds,
    Boolean(configPath && content && !hasSecurityHeaders),
    openImageRemotePatterns,
    missingLintScript,
    missingTypecheckSignal,
  ];

  return {
    configFile: configPath,
    ignoreBuildErrors,
    ignoreDuringBuilds,
    hasSecurityHeaders: Boolean(configPath && content ? hasSecurityHeaders : false),
    hasStandaloneOutput,
    openImageRemotePatterns,
    missingLintScript,
    missingTypecheckSignal,
    issueCount: issueFlags.filter(Boolean).length,
  };
}

export function auditCachingAndData(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  appPagePaths: string[],
  isNext15OrHigher: boolean,
  improvements: NextJsArchitecturalImprovement[],
): NextJsCachingAudit {
  const forceDynamicFiles: string[] = [];
  const zeroRevalidateFiles: string[] = [];
  const uncachedFetchFiles: string[] = [];
  const syncRequestApiFiles: string[] = [];
  const dynamicRoutesMissingStaticParams: string[] = [];

  const serverishPaths = normalizedPaths.filter(path => {
    if (!isSourceFile(path)) return false;
    const content = sourceContents[path];
    if (!content) return false;
    const top = content.slice(0, 400);
    if (/^\s*['"]use client['"]/m.test(top)) return false;
    return (
      path.toLowerCase().includes('/app/') ||
      path.toLowerCase().startsWith('app/') ||
      /\/(?:page|layout|route|loading|template)\.(?:js|jsx|ts|tsx)$/i.test(path) ||
      /^\s*['"]use server['"]/m.test(top)
    );
  });

  for (const path of serverishPaths) {
    const content = sourceContents[path] || '';
    const name = fileName(path);

    if (/\bexport\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content)) {
      forceDynamicFiles.push(path);
      improvements.push({
        id: `cache-force-dynamic-${path}`,
        category: 'data-caching',
        severity: 'optimization',
        title: `force-dynamic on ${name}`,
        impact: `${path} opts the whole route into fully dynamic rendering, which disables static optimization and can raise TTFB and infra cost.`,
        remediation:
          'Prefer granular `fetch` cache/revalidate options or `unstable_cache` instead of blanket force-dynamic when only some data is dynamic.',
        file: path,
      });
    }

    if (/\bexport\s+const\s+revalidate\s*=\s*0\b/.test(content)) {
      zeroRevalidateFiles.push(path);
      improvements.push({
        id: `cache-revalidate-zero-${path}`,
        category: 'data-caching',
        severity: 'optimization',
        title: `revalidate = 0 in ${name}`,
        impact: `${path} effectively disables ISR caching for the segment.`,
        remediation: 'Use a positive revalidate window, on-demand revalidation, or tag-based invalidation when freshness allows.',
        file: path,
      });
    }

    // Uncached fetch: only flag when options are clearly missing in a short call window.
    // Skip files that already opt into full dynamic rendering, and keep this as an optimization (not a warning).
    const alreadyDynamic =
      /\bexport\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content) ||
      /\bexport\s+const\s+revalidate\s*=\s*0\b/.test(content);
    if (!alreadyDynamic && !looksPublicOrAuthRoute(path) && uncachedFetchFiles.length < 5) {
      let flaggedUncached = false;
      const fetchRegex = /\bfetch\s*\(/g;
      let fetchMatch: RegExpExecArray | null;
      while ((fetchMatch = fetchRegex.exec(content)) !== null) {
        const window = content.slice(fetchMatch.index, fetchMatch.index + 220);
        if (/cache\s*:|next\s*:|revalidate\s*:/.test(window)) continue;
        // Same-origin relative fetches are often intentionally dynamic; skip those.
        if (/fetch\s*\(\s*[`'"]\//.test(window)) continue;
        if (!flaggedUncached) {
          flaggedUncached = true;
          uncachedFetchFiles.push(path);
          improvements.push({
            id: `cache-uncached-fetch-${path}`,
            category: 'data-caching',
            severity: 'optimization',
            title: `Unconfigured fetch() in ${name}`,
            impact: `${path} calls fetch() without explicit cache/revalidate options. Default caching behavior varies by Next version.`,
            remediation:
              'Pass `{ next: { revalidate: N } }`, `{ cache: "force-cache" }`, or `{ cache: "no-store" }` intentionally for each server fetch.',
            file: path,
          });
        }
        break;
      }
    }

    if (isNext15OrHigher) {
      const hasAwaitedCookies = /\bawait\s+cookies\s*\(/.test(content);
      const hasAwaitedHeaders = /\bawait\s+headers\s*\(/.test(content);
      const hasCookiesCall = /(?:^|[^.\w])cookies\s*\(\s*\)/.test(content);
      const hasHeadersCall = /(?:^|[^.\w])headers\s*\(\s*\)/.test(content);
      const syncCookies = hasCookiesCall && !hasAwaitedCookies;
      const syncHeaders = hasHeadersCall && !hasAwaitedHeaders;
      const syncParams =
        /\b(?:params|searchParams)\.[a-zA-Z_]/.test(content) &&
        !/await\s+(?:params|searchParams)\b/.test(content) &&
        !/\bconst\s*\{[^}]*\}\s*=\s*await\s+(?:params|searchParams)/.test(content);

      if ((syncCookies || syncHeaders || syncParams) && !syncRequestApiFiles.includes(path)) {
        const usesRequestApis =
          hasCookiesCall ||
          hasHeadersCall ||
          (/\b(?:params|searchParams)\b/.test(content) && /\/(?:page|layout|route)\./i.test(path));

        if (usesRequestApis && (syncCookies || syncHeaders || (syncParams && /\/(?:page|layout|route)\./i.test(path)))) {
          syncRequestApiFiles.push(path);
          improvements.push({
            id: `cache-sync-request-api-${path}`,
            category: 'data-caching',
            severity: 'warning',
            title: `Likely Sync Request API Use in ${name}`,
            impact: `${path} appears to call cookies()/headers() or read params/searchParams without await. Next.js 15+ treats these as async.`,
            remediation: 'Use `const cookieStore = await cookies()`, `await headers()`, and `const { id } = await params`.',
            file: path,
          });
        }
      }
    }
  }

  // Dynamic app routes missing generateStaticParams when sibling static generation cues exist.
  for (const pagePath of appPagePaths) {
    if (!/\[[^./\]]+\]/.test(pagePath)) continue;
    if (/\[\.\.\./.test(pagePath)) continue; // catch-alls often intentionally dynamic
    const content = sourceContents[pagePath] || '';
    if (!content) continue;
    if (/\bgenerateStaticParams\b/.test(content)) continue;
    if (/\bexport\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content)) continue;
    dynamicRoutesMissingStaticParams.push(pagePath);
  }

  if (dynamicRoutesMissingStaticParams.length > 0) {
    const sample = dynamicRoutesMissingStaticParams.slice(0, 4);
    improvements.push({
      id: 'cache-missing-generate-static-params',
      category: 'data-caching',
      severity: 'optimization',
      title: `Dynamic Routes Without generateStaticParams (${dynamicRoutesMissingStaticParams.length})`,
      impact: `Dynamic segments (${sample.map(fileName).join(', ')}${dynamicRoutesMissingStaticParams.length > 4 ? ', …' : ''}) have no generateStaticParams. They always render on demand unless other caching is configured.`,
      remediation:
        'Export generateStaticParams for known IDs/slugs when the set is finite, or mark the route force-dynamic intentionally.',
      file: sample[0],
    });
  }

  return {
    forceDynamicFiles,
    zeroRevalidateFiles,
    uncachedFetchFiles,
    syncRequestApiFiles,
    dynamicRoutesMissingStaticParams,
    issueCount:
      forceDynamicFiles.length +
      zeroRevalidateFiles.length +
      uncachedFetchFiles.length +
      syncRequestApiFiles.length +
      (dynamicRoutesMissingStaticParams.length > 0 ? 1 : 0),
  };
}

export function auditSecurity(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  middlewareFiles: string[],
  improvements: NextJsArchitecturalImprovement[],
): NextJsSecurityAudit {
  const serverImportInClientFiles: string[] = [];
  const secretEnvInClientFiles: string[] = [];

  const clientFiles = normalizedPaths.filter(path => {
    if (!isSourceFile(path)) return false;
    const content = sourceContents[path];
    if (!content) return false;
    return /^\s*['"]use client['"]/m.test(content.slice(0, 500));
  });

  for (const path of clientFiles) {
    const content = sourceContents[path] || '';
    const name = fileName(path);

    if (SERVER_ONLY_IMPORT.test(content)) {
      serverImportInClientFiles.push(path);
      improvements.push({
        id: `security-server-import-client-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Server-only Import in Client Component (${name})`,
        impact: `${path} is a Client Component but imports Node/server libraries. This can leak secrets, break the client bundle, or expose privileged APIs.`,
        remediation:
          'Move data access behind a Server Component, Server Action, or Route Handler. Mark privileged modules with `import "server-only"`.',
        file: path,
        line: firstMatchLine(content, SERVER_ONLY_IMPORT),
      });
    }

    if (SECRET_ENV_IN_CLIENT.test(content)) {
      secretEnvInClientFiles.push(path);
      improvements.push({
        id: `security-secret-env-client-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Non-public Env Access in Client Component (${name})`,
        impact: `${path} reads process.env values that look secret-like from a client bundle. Only NEXT_PUBLIC_* values are safe to expose.`,
        remediation:
          'Keep secrets server-side. Expose only intentional NEXT_PUBLIC_* values, or fetch through an authenticated server endpoint.',
        file: path,
        line: firstMatchLine(content, SECRET_ENV_IN_CLIENT),
      });
    }
  }

  let middlewareWithoutAuth = false;
  const middlewareFile = middlewareFiles[0];
  if (middlewareFile) {
    const content = sourceContents[middlewareFile] || '';
    const hasAuthSignals =
      AUTH_SIGNAL.test(content) ||
      /\b(?:getToken|authMiddleware|clerkMiddleware|withAuth|requireAuth)\b/i.test(content);
    // Edge utilities (i18n, headers, CSP, static asset skips) should not look like missing auth.
    const looksLikeEdgeUtility =
      /\b(?:locale|i18n|negotiator|geo|csp|Content-Security|X-Frame-Options|pathname\.startsWith\(\s*['"]\/_next)/i.test(
        content,
      );
    const looksLikeAuthGate =
      /\b(?:login|signin|sign-in|unauthorized|forbidden|dashboard|admin|protected|session)\b/i.test(content) &&
      /\b(?:NextResponse\.redirect|Response\.redirect|rewrite)\b/i.test(content);
    if (content && !hasAuthSignals && looksLikeAuthGate && !looksLikeEdgeUtility) {
      middlewareWithoutAuth = true;
      improvements.push({
        id: `security-middleware-no-auth-${middlewareFile}`,
        category: 'security',
        severity: 'warning',
        title: `Middleware Without Auth Checks (${fileName(middlewareFile)})`,
        impact: `${middlewareFile} redirects or rewrites around protected-looking paths, but no session/token verification signals were detected.`,
        remediation:
          'Verify auth in middleware (or proxy) for protected matchers, and keep authorization checks in Server Actions/Route Handlers as defense in depth.',
        file: middlewareFile,
      });
    }
  }

  // Open redirect heuristic in route handlers / middleware
  let openRedirectCount = 0;
  for (const path of [...middlewareFiles, ...normalizedPaths.filter(p => /\/route\.(?:js|ts)$/i.test(p))]) {
    const content = sourceContents[path];
    if (!content) continue;
    if (
      /(?:redirect|NextResponse\.redirect)\s*\(\s*(?:new\s+URL\s*\()?[^)]*(?:searchParams|req\.url|request\.url|query\.)/i.test(
        content,
      ) &&
      !/\b(?:startsWith|origin|ALLOWED|allowlist|safeUrl|isValid)\b/i.test(content)
    ) {
      openRedirectCount += 1;
      improvements.push({
        id: `security-open-redirect-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Possible Open Redirect in ${fileName(path)}`,
        impact: `${path} redirects using request-controlled values without an obvious allowlist check.`,
        remediation: 'Validate redirect targets against a same-origin allowlist before calling redirect().',
        file: path,
      });
    }
  }

  return {
    serverImportInClientFiles,
    secretEnvInClientFiles,
    middlewareWithoutAuth,
    middlewareFile,
    issueCount:
      serverImportInClientFiles.length +
      secretEnvInClientFiles.length +
      (middlewareWithoutAuth ? 1 : 0) +
      openRedirectCount,
  };
}

export function auditSeoMetadata(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  appPagePaths: string[],
  hasAppRouter: boolean,
  improvements: NextJsArchitecturalImprovement[],
): NextJsSeoAudit {
  if (!hasAppRouter) {
    return {
      hasRootMetadata: false,
      hasRobotsFile: false,
      hasSitemapFile: false,
      pagesMissingMetadata: [],
      issueCount: 0,
    };
  }

  const layoutFiles = normalizedPaths.filter(
    path => /\/layout\.(?:js|jsx|ts|tsx)$/i.test(path) || /^layout\.(?:js|jsx|ts|tsx)$/i.test(path),
  );
  const rootLayout = layoutFiles.find(
    path => /(^|\/)app\/layout\./i.test(path) || /(^|\/)src\/app\/layout\./i.test(path),
  );
  const rootLayoutContent = rootLayout ? sourceContents[rootLayout] || '' : '';
  const hasRootMetadata =
    /\bexport\s+const\s+metadata\b/.test(rootLayoutContent) ||
    /\bexport\s+(?:async\s+)?function\s+generateMetadata\b/.test(rootLayoutContent) ||
    layoutFiles.some(path => {
      const c = sourceContents[path] || '';
      return /\bexport\s+const\s+metadata\b/.test(c) || /\bgenerateMetadata\b/.test(c);
    });

  const hasRobotsFile = normalizedPaths.some(path =>
    /(^|\/)(?:src\/)?app\/robots\.(?:js|ts)$/i.test(path),
  );
  const hasSitemapFile = normalizedPaths.some(path =>
    /(^|\/)(?:src\/)?app\/sitemap\.(?:js|ts)$/i.test(path),
  );

  const pagesMissingMetadata: string[] = [];
  for (const pagePath of appPagePaths) {
    const content = sourceContents[pagePath] || '';
    if (!content) continue;
    const hasMeta =
      /\bexport\s+const\s+metadata\b/.test(content) || /\bgenerateMetadata\b/.test(content);
    // Dynamic marketing-ish pages benefit most; skip pure app shells under (app) if root has metadata
    if (!hasMeta && !hasRootMetadata) {
      pagesMissingMetadata.push(pagePath);
    }
  }

  if (!hasRootMetadata && appPagePaths.length > 0) {
    improvements.push({
      id: 'seo-missing-root-metadata',
      category: 'seo-metadata',
      severity: 'warning',
      title: 'Missing Root metadata / generateMetadata',
      impact:
        'App Router layouts/pages without metadata exports rely on defaults, which hurts SEO, social previews, and document titles.',
      remediation:
        'Export `metadata` or `generateMetadata` from app/layout.tsx (and key pages) with title, description, and Open Graph fields.',
      file: rootLayout || 'app/layout.tsx',
    });
  }

  if (!hasRobotsFile && appPagePaths.length > 0) {
    improvements.push({
      id: 'seo-missing-robots',
      category: 'seo-metadata',
      severity: 'optimization',
      title: 'No app/robots.ts Detected',
      impact: 'Without robots.ts (or a static robots.txt), crawler policy is left to hosting defaults.',
      remediation: 'Add `app/robots.ts` returning allow/disallow rules for production and preview environments.',
      file: 'app/robots.ts',
    });
  }

  if (!hasSitemapFile && appPagePaths.length > 2) {
    improvements.push({
      id: 'seo-missing-sitemap',
      category: 'seo-metadata',
      severity: 'optimization',
      title: 'No app/sitemap.ts Detected',
      impact: 'Public multi-page apps without a sitemap make discovery slower for search engines.',
      remediation: 'Add `app/sitemap.ts` for indexable routes, or document why the site is intentionally unlisted.',
      file: 'app/sitemap.ts',
    });
  }

  return {
    hasRootMetadata,
    hasRobotsFile,
    hasSitemapFile,
    pagesMissingMetadata: pagesMissingMetadata.slice(0, 20),
    issueCount:
      (hasRootMetadata ? 0 : 1) + (hasRobotsFile ? 0 : 1) + (hasSitemapFile || appPagePaths.length <= 2 ? 0 : 1),
  };
}

export function auditPerformanceSignals(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  improvements: NextJsArchitecturalImprovement[],
): {
  rawImgTagFiles: string[];
  missingNextFont: boolean;
  sharpMissingWithImages: boolean;
  heavyClientFiles: string[];
} {
  const rawImgTagFiles: string[] = [];
  const heavyClientFiles: string[] = [];
  let usesNextImage = false;
  let usesNextFont = false;

  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path)) continue;
    if (/\bfrom\s*['"]next\/image['"]/.test(content) || /<Image\b/.test(content)) usesNextImage = true;
    if (/\bfrom\s*['"]next\/font/.test(content)) usesNextFont = true;

    // Native <img> in app/components (skip svg and markdown-ish)
    if (
      /<(?:img)\b/i.test(content) &&
      !/\bfrom\s*['"]next\/image['"]/.test(content) &&
      /\.(?:jsx|tsx)$/i.test(path)
    ) {
      rawImgTagFiles.push(path);
      if (rawImgTagFiles.length <= 8) {
        improvements.push({
          id: `perf-raw-img-${path}`,
          category: 'bundle-optimization',
          severity: 'optimization',
          title: `Native <img> in ${fileName(path)}`,
          impact: `${path} uses a raw <img> tag. next/image provides sizing, lazy loading, and optimized formats by default.`,
          remediation: 'Replace decorative/content images with `next/image` (or document why a raw img is required).',
          file: path,
        });
      }
    }

    const top = content.slice(0, 400);
    if (/^\s*['"]use client['"]/m.test(top) && HEAVY_CLIENT_LIBS.test(content)) {
      heavyClientFiles.push(path);
      improvements.push({
        id: `perf-heavy-client-${path}`,
        category: 'bundle-optimization',
        severity: 'optimization',
        title: `Heavy Client Library in ${fileName(path)}`,
        impact: `${path} is a Client Component importing a heavy visualization/editor library, which can inflate the main bundle.`,
        remediation:
          'Lazy-load with `next/dynamic` (and `{ ssr: false }` when needed), or isolate the heavy UI behind a smaller interactive island.',
        file: path,
      });
    }
  }

  // Cap raw img findings noise: if many, add a summary and we already capped individual ones
  if (rawImgTagFiles.length > 8) {
    improvements.push({
      id: 'perf-raw-img-summary',
      category: 'bundle-optimization',
      severity: 'optimization',
      title: `${rawImgTagFiles.length} Files Using Native <img>`,
      impact: 'Multiple components bypass next/image, missing automatic optimization and CLS-friendly sizing.',
      remediation: 'Migrate high-traffic images to next/image; keep raw <img> only for special cases.',
      file: rawImgTagFiles[0],
    });
  }

  const cssOrLayoutHints = normalizedPaths.some(path =>
    /\.(?:css|scss)$/i.test(path) || /(^|\/)(?:src\/)?app\/layout\./i.test(path),
  );
  const googleFontsLink = Object.values(sourceContents).some(c =>
    /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(c),
  );
  const missingNextFont = Boolean((cssOrLayoutHints || googleFontsLink) && !usesNextFont && normalizedPaths.length > 5);

  if (missingNextFont && googleFontsLink) {
    improvements.push({
      id: 'perf-missing-next-font',
      category: 'bundle-optimization',
      severity: 'optimization',
      title: 'Google Fonts Link Without next/font',
      impact: 'External font stylesheets can block rendering and cause layout shift compared to next/font self-hosting.',
      remediation: 'Use `next/font/google` or `next/font/local` in the root layout instead of runtime Google Fonts links.',
      file: normalizedPaths.find(p => /(^|\/)(?:src\/)?app\/layout\./i.test(p)),
    });
  }

  let hasSharp = false;
  for (const [path, content] of Object.entries(manifests)) {
    if (!/(^|\/)package\.json$/i.test(path.replace(/\\/g, '/'))) continue;
    if (/["']sharp["']\s*:/.test(content)) hasSharp = true;
  }
  const sharpMissingWithImages = usesNextImage && !hasSharp;
  // sharp is usually optional on Vercel; only hint for docker/self-host signals
  const selfHostSignal = normalizedPaths.some(
    path => /(^|\/)dockerfile$/i.test(path) || /output\s*:\s*['"]standalone['"]/i.test(sourceContents[path] || ''),
  );
  if (sharpMissingWithImages && selfHostSignal) {
    improvements.push({
      id: 'perf-missing-sharp',
      category: 'bundle-optimization',
      severity: 'optimization',
      title: 'next/image Without sharp (Self-host Signal)',
      impact: 'Self-hosted Next.js image optimization performs best with sharp installed; without it, optimization may be slower or limited.',
      remediation: 'Add `sharp` as a dependency in production images that use next/image.',
      file: 'package.json',
    });
  }

  return {
    rawImgTagFiles,
    missingNextFont,
    sharpMissingWithImages: sharpMissingWithImages && selfHostSignal,
    heavyClientFiles,
  };
}

export function pushResilienceExtras(
  args: {
    hasRootNotFound: boolean;
    hasGlobalError: boolean;
    hasAppPages: boolean;
    missingErrorSegments: string[];
    appPagePathsLength: number;
  },
  improvements: NextJsArchitecturalImprovement[],
): void {
  const { hasRootNotFound, hasGlobalError, hasAppPages, missingErrorSegments, appPagePathsLength } = args;

  if (!hasRootNotFound && hasAppPages) {
    improvements.push({
      id: 'resilience-missing-root-not-found',
      category: 'route-resilience',
      severity: 'warning',
      title: 'Missing Root not-found.tsx',
      impact:
        'Without app/not-found.tsx, unknown routes fall back to a generic Next.js 404 instead of your product UI and navigation.',
      remediation: 'Add app/not-found.tsx with branded empty-state content and links back into the app.',
      file: 'app/not-found.tsx',
    });
  }

  if (!hasGlobalError && hasAppPages && appPagePathsLength >= 3) {
    improvements.push({
      id: 'resilience-missing-global-error',
      category: 'route-resilience',
      severity: 'optimization',
      title: 'No global-error.tsx Detected',
      impact:
        'Root layout failures bypass error.tsx. global-error.tsx is the last-resort UI when the root layout itself throws.',
      remediation: 'Add app/global-error.tsx (must include its own <html>/<body>) for catastrophic render failures.',
      file: 'app/global-error.tsx',
    });
  }

  if (missingErrorSegments.length > 0) {
    improvements.push({
      id: 'resilience-missing-segment-errors',
      category: 'route-resilience',
      severity: 'warning',
      title: `Missing error.tsx in ${missingErrorSegments.slice(0, 3).join(', ')}`,
      impact: `Route segments (${missingErrorSegments.slice(0, 5).join(', ')}) have no local error boundary. Failures bubble to the nearest parent and can blank larger parts of the UI.`,
      remediation: 'Add segment-level error.tsx for critical areas (dashboard, checkout, settings) with a reset action.',
    });
  }
}
