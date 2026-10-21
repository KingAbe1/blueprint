import {
  FrameworkAnalyzer,
  FrameworkProfile,
  NextJsSpecialization,
  NextJsArchitecturalImprovement,
  UniversalRoute,
  UniversalBoundary,
} from '../../../types/framework';
import {
  AUTH_SIGNAL,
  VALIDATION_SIGNAL,
  auditApiRoutes,
  auditCachingAndData,
  auditNextConfig,
  auditPerformanceSignals,
  auditSecurity,
  auditSeoMetadata,
  pushResilienceExtras,
} from './nextJsDeepAudits';

export const nextJsAnalyzer: FrameworkAnalyzer<NextJsSpecialization> = {
  id: 'nextjs',
  name: 'Next.js',

  detect({ paths, manifests }): boolean {
    const hasNextConfig = paths.some(path =>
      /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path.replace(/\\/g, '/'))
    );
    const hasNextDep = Object.entries(manifests).some(([path, content]) =>
      /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && /["']next["']\s*:/i.test(content)
    );
    return hasNextConfig || hasNextDep;
  },

  analyze({ paths, manifests, sourceContents = {} }): FrameworkProfile<NextJsSpecialization> {
    const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));
    const improvements: NextJsArchitecturalImprovement[] = [];

    // 1. Detect Version
    let detectedVersion: string | undefined;
    for (const [path, content] of Object.entries(manifests)) {
      if (/(^|\/)package\.json$/i.test(path.replace(/\\/g, '/'))) {
        try {
          const parsed = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
          const v = parsed.dependencies?.next || parsed.devDependencies?.next;
          if (typeof v === 'string') {
            detectedVersion = v.replace(/^[^0-9]*/, '');
            break;
          }
        } catch {
          // Ignore
        }
      }
    }

    const majorVersion = detectedVersion ? Number(detectedVersion.match(/^\d+/)?.[0]) : undefined;
    const isNext15OrHigher = Boolean(majorVersion && majorVersion >= 15);
    const isNext16OrHigher = Boolean(majorVersion && majorVersion >= 16);

    // 2. Route Discovery
    const appPagePaths = normalizedPaths.filter(path => {
      const segments = path.toLowerCase().split('/');
      return segments.includes('app') && /\/page\.(?:js|jsx|ts|tsx)$/i.test(path);
    });

    const pagesRoutePaths = normalizedPaths.filter(path => {
      const segments = path.toLowerCase().split('/');
      const pagesIndex = segments.lastIndexOf('pages');
      if (pagesIndex < 0 || /\.(?:d\.ts)$/i.test(path)) return false;
      const routeSegments = segments.slice(pagesIndex + 1);
      const fileName = routeSegments.at(-1) || '';
      return (
        routeSegments.length > 0 &&
        !routeSegments.includes('api') &&
        !/^_(?:app|document|error)\./.test(fileName) &&
        /\.(?:js|jsx|ts|tsx)$/.test(fileName)
      );
    });

    const appApiPaths = normalizedPaths.filter(path => {
      const segments = path.toLowerCase().split('/');
      return segments.includes('app') && /\/route\.(?:js|ts)$/i.test(path);
    });

    const pagesApiPaths = normalizedPaths.filter(path => {
      const segments = path.toLowerCase().split('/');
      const pagesIndex = segments.lastIndexOf('pages');
      return pagesIndex >= 0 && segments[pagesIndex + 1] === 'api' && /\.(?:js|jsx|ts|tsx)$/.test(path);
    });

    const appRouterPresent =
      appPagePaths.length > 0 ||
      appApiPaths.length > 0 ||
      normalizedPaths.some(path =>
        path.toLowerCase().split('/').includes('app') &&
        /\/(?:layout|loading|error|not-found)\.(?:js|jsx|ts|tsx)$/i.test(path)
      );
    const pagesRouterPresent = pagesRoutePaths.length > 0 || pagesApiPaths.length > 0;

    const router: NextJsSpecialization['router'] =
      appRouterPresent && pagesRouterPresent
        ? 'Both routers'
        : appRouterPresent
        ? 'App Router'
        : pagesRouterPresent
        ? 'Pages Router'
        : 'Router not identified';

    // Universal Routes Mapping
    const universalRoutes: UniversalRoute[] = [];

    const formatAppRoutePattern = (path: string): string => {
      const segments = path.split('/');
      const appIndex = segments.map(s => s.toLowerCase()).lastIndexOf('app');
      const routeSegments = segments
        .slice(appIndex + 1, -1)
        .filter(s => !/^\([^)]*\)$/.test(s) && !s.startsWith('@'));
      return routeSegments.length ? `/${routeSegments.join('/')}` : '/';
    };

    const extractDynamicParams = (pattern: string): string[] => {
      const matches = pattern.match(/\[([^\]]+)\]/g);
      return matches ? matches.map(m => m.slice(1, -1)) : [];
    };

    for (const pagePath of appPagePaths) {
      const pattern = formatAppRoutePattern(pagePath);
      universalRoutes.push({
        path: pattern,
        pattern,
        type: 'page',
        file: pagePath,
        dynamicParams: extractDynamicParams(pattern),
      });
    }

    for (const apiPath of [...appApiPaths, ...pagesApiPaths]) {
      universalRoutes.push({
        path: apiPath,
        pattern: apiPath,
        type: 'api',
        file: apiPath,
      });
    }

    // 3. Server Actions & Mutation Hygiene Audit
    const actionCandidatePaths = normalizedPaths.filter(path => {
      const lower = path.toLowerCase();
      const isInActionsDir = lower.includes('/actions/') || lower.startsWith('actions/');
      const isSource = /\.(?:js|jsx|ts|tsx)$/i.test(path) && !/\.(?:test|spec|d)\.[^/]+$/.test(path);
      return isInActionsDir && isSource;
    });

    const otherServerActionPaths = normalizedPaths.filter(path => {
      if (actionCandidatePaths.includes(path)) return false;
      const content = sourceContents[path];
      return content ? /^\s*['"]use server['"]/m.test(content.slice(0, 500)) : false;
    });

    const allActionPaths = [...new Set([...actionCandidatePaths, ...otherServerActionPaths])];
    const auditedActionFiles: NextJsSpecialization['actionAudit']['actionFiles'] = [];
    let unvalidatedFilesCount = 0;
    let unprotectedFilesCount = 0;
    let complexActionsCount = 0;
    let totalActionsCount = 0;

    for (const actPath of allActionPaths) {
      const content = sourceContents[actPath] || '';
      const lines = content ? content.split(/\r\n|\n|\r/).length : 0;
      const fileName = actPath.split('/').pop() || actPath;

      const exportedActions: string[] = [];
      const exportFuncRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
      let match: RegExpExecArray | null;
      while ((match = exportFuncRegex.exec(content)) !== null) {
        exportedActions.push(match[1]);
      }
      const exportConstRegex = /export\s+const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async)?/g;
      while ((match = exportConstRegex.exec(content)) !== null) {
        if (!exportedActions.includes(match[1])) exportedActions.push(match[1]);
      }

      totalActionsCount += exportedActions.length;

      const hasValidation = VALIDATION_SIGNAL.test(content);
      const hasAuth = AUTH_SIGNAL.test(content);

      if (!hasValidation) {
        unvalidatedFilesCount += 1;
        improvements.push({
          id: `action-unvalidated-${actPath}`,
          category: 'action-hygiene',
          severity: 'critical',
          title: `Unvalidated Mutation Inputs in ${fileName}`,
          impact: `${actPath} processes mutations without runtime schema validation (Zod/Valibot). Malformed client inputs or missing fields can trigger runtime crashes or database corruption.`,
          remediation: `Wrap incoming action arguments in a Zod schema validation (e.g. z.object({...}).parse(payload)) before running mutations.`,
          file: actPath,
        });
      }

      if (!hasAuth && !fileName.toLowerCase().includes('login') && !fileName.toLowerCase().includes('public')) {
        unprotectedFilesCount += 1;
        improvements.push({
          id: `action-unprotected-${actPath}`,
          category: 'action-hygiene',
          severity: 'warning',
          title: `Missing Auth Guard in ${fileName}`,
          impact: `${actPath} appears to execute state mutations without verifying caller session context. In Next.js, Server Actions are public POST endpoints that anyone can invoke directly.`,
          remediation: `Verify session identity at the start of each action handler (e.g. const session = await auth(); if (!session) throw new Error('Unauthorized');).`,
          file: actPath,
        });
      }

      if (lines > 100) {
        complexActionsCount += 1;
        improvements.push({
          id: `action-complexity-${actPath}`,
          category: 'action-hygiene',
          severity: 'warning',
          title: `Monolithic Action Handler in ${fileName} (${lines} LOC)`,
          impact: `${actPath} spans ${lines} lines. Large action files often interleave business logic, data formatting, and database queries, making maintenance and unit testing error-prone.`,
          remediation: `Extract database mutations and third-party API calls into domain service functions outside the action file.`,
          file: actPath,
        });
      }

      auditedActionFiles.push({
        path: actPath,
        exportedActions,
        lineCount: lines,
        hasValidation,
        hasAuth,
      });
    }

    // 4. Component Distribution & Dead Weight Detection
    const componentCandidatePaths = normalizedPaths.filter(path => {
      const lower = path.toLowerCase();
      const isComponentExt = /\.(?:jsx|tsx)$/i.test(path);
      const isInsideAppOrComponents =
        lower.includes('/app/') ||
        lower.startsWith('app/') ||
        lower.includes('/components/') ||
        lower.startsWith('components/') ||
        lower.includes('/src/components/') ||
        lower.startsWith('src/components/');
      return isComponentExt && isInsideAppOrComponents && !/\.(?:test|spec|d)\.[^/]+$/.test(path);
    });

    const clientComponentFiles: string[] = [];
    const unnecessaryClientFiles: string[] = [];
    let serverComponentsCount = 0;

    for (const compPath of componentCandidatePaths) {
      const content = sourceContents[compPath];
      const fileName = compPath.split('/').pop() || compPath;

      if (content) {
        const topSlice = content.slice(0, 500);
        const hasUseClient = /^\s*['"]use client['"]/m.test(topSlice);

        if (hasUseClient) {
          clientComponentFiles.push(compPath);

          const hasHooks = /\buse(?:State|Effect|LayoutEffect|Reducer|Ref|Callback|Memo|Context|Transition|DeferredValue|SyncExternalStore|Router|Params|Pathname|SearchParams)\s*\(/i.test(content);
          const hasEvents = /\bon(?:Click|Change|Submit|KeyDown|KeyUp|MouseEnter|MouseLeave|Focus|Blur)\s*=/i.test(content);

          if (!hasHooks && !hasEvents) {
            unnecessaryClientFiles.push(compPath);
            improvements.push({
              id: `bundle-unnecessary-client-${compPath}`,
              category: 'bundle-optimization',
              severity: 'optimization',
              title: `Unnecessary 'use client' Directive in ${fileName}`,
              impact: `${compPath} is marked with 'use client' but contains no React hooks or event listeners. This needlessly bundles this component into client JavaScript.`,
              remediation: `Remove 'use client' to allow Next.js to render this component on the server, saving client bundle bandwidth.`,
              file: compPath,
            });
          }
        } else {
          serverComponentsCount += 1;
        }
      } else {
        if (compPath.toLowerCase().includes('/app/')) {
          serverComponentsCount += 1;
        } else {
          clientComponentFiles.push(compPath);
        }
      }
    }

    const clientComponentsCount = clientComponentFiles.length;
    const totalComponents = serverComponentsCount + clientComponentsCount;
    const serverRatio = totalComponents > 0 ? Math.round((serverComponentsCount / totalComponents) * 100) : 100;
    const clientRatio = 100 - serverRatio;

    // 5. UI Boundary Resilience & Route Isolation
    const layoutFiles = normalizedPaths.filter(p => /\/layout\.(?:js|jsx|ts|tsx)$/i.test(p) || /^layout\.(?:js|jsx|ts|tsx)$/i.test(p));
    const loadingFiles = normalizedPaths.filter(p => /\/loading\.(?:js|jsx|ts|tsx)$/i.test(p) || /^loading\.(?:js|jsx|ts|tsx)$/i.test(p));
    const errorFiles = normalizedPaths.filter(p => /\/error\.(?:js|jsx|ts|tsx)$/i.test(p) || /^error\.(?:js|jsx|ts|tsx)$/i.test(p));
    const notFoundFiles = normalizedPaths.filter(p => /\/not-found\.(?:js|jsx|ts|tsx)$/i.test(p) || /^not-found\.(?:js|jsx|ts|tsx)$/i.test(p));
    const globalErrorFiles = normalizedPaths.filter(p => /\/global-error\.(?:js|jsx|ts|tsx)$/i.test(p) || /^global-error\.(?:js|jsx|ts|tsx)$/i.test(p));
    const middlewareFiles = normalizedPaths.filter(p => /(^|\/)(?:proxy|middleware)\.(?:js|ts)$/i.test(p));

    const hasRootLayout = layoutFiles.some(p => /(^|\/)app\/layout\./i.test(p) || /(^|\/)src\/app\/layout\./i.test(p));
    const hasRootLoading = loadingFiles.some(p => /(^|\/)app\/loading\./i.test(p) || /(^|\/)src\/app\/loading\./i.test(p));
    const hasRootError = errorFiles.some(p => /(^|\/)app\/error\./i.test(p) || /(^|\/)src\/app\/error\./i.test(p));
    const hasRootNotFound = notFoundFiles.some(p => /(^|\/)app\/not-found\./i.test(p) || /(^|\/)src\/app\/not-found\./i.test(p));
    const hasGlobalError = globalErrorFiles.length > 0;

    const missingLoadingSegments: string[] = [];
    const missingErrorSegments: string[] = [];

    const appSegments = new Set<string>();
    for (const pagePath of appPagePaths) {
      const parts = pagePath.split('/');
      const appIdx = parts.map(s => s.toLowerCase()).lastIndexOf('app');
      if (appIdx >= 0 && parts.length > appIdx + 2) {
        const seg = parts[appIdx + 1];
        if (!seg.startsWith('(') && !seg.startsWith('@')) {
          appSegments.add(seg);
        }
      }
    }

    for (const segment of appSegments) {
      const hasLoading = loadingFiles.some(f => f.includes(`/${segment}/`));
      const hasError = errorFiles.some(f => f.includes(`/${segment}/`));

      if (!hasLoading) {
        missingLoadingSegments.push(segment);
      }
      if (!hasError) {
        missingErrorSegments.push(segment);
      }
    }

    if (!hasRootError && appPagePaths.length > 0) {
      improvements.push({
        id: 'resilience-missing-root-error',
        category: 'route-resilience',
        severity: 'critical',
        title: 'Missing Root error.tsx Boundary in App Router',
        impact: 'No root error.tsx boundary exists. If a Server Component or action throws an uncaught error, Next.js displays an unstyled server crash page instead of a graceful recovery UI.',
        remediation: 'Create app/error.tsx with a user-friendly error state and a reset() retry trigger.',
        file: 'app/error.tsx',
      });
    }

    if (missingLoadingSegments.length > 0) {
      improvements.push({
        id: 'resilience-missing-loading-skeletons',
        category: 'route-resilience',
        severity: 'warning',
        title: `Missing Loading Skeletons in ${missingLoadingSegments.slice(0, 3).join(', ')}`,
        impact: `Route segments (${missingLoadingSegments.slice(0, 3).join(', ')}) do not define loading.tsx. Users will experience blank screen transitions during slow server fetches.`,
        remediation: `Add loading.tsx with skeleton placeholders in critical route folders to enable instant streaming transitions.`,
      });
    }

    pushResilienceExtras(
      {
        hasRootNotFound,
        hasGlobalError,
        hasAppPages: appPagePaths.length > 0,
        missingErrorSegments,
        appPagePathsLength: appPagePaths.length,
      },
      improvements,
    );

    // 6. Modernization & Breaking Version Migration
    const hasLegacyMiddleware = middlewareFiles.some(p => /(^|\/)middleware\.(?:js|ts)$/i.test(p));
    if (isNext16OrHigher && hasLegacyMiddleware) {
      improvements.push({
        id: 'modernization-next16-middleware',
        category: 'modernization',
        severity: 'critical',
        title: 'Deprecated middleware.ts in Next.js 16 (Rename to proxy.ts)',
        impact: 'Next.js 16 deprecates the middleware.ts naming convention in favor of proxy.ts for network-level request boundaries.',
        remediation: 'Rename middleware.ts to proxy.ts and update config matcher rules to ensure seamless runtime compatibility.',
        file: middlewareFiles[0],
      });
    }

    if (pagesRoutePaths.length > 0 && appPagePaths.length > 0) {
      improvements.push({
        id: 'modernization-hybrid-migration',
        category: 'modernization',
        severity: 'optimization',
        title: `Hybrid Pages Router (${pagesRoutePaths.length} routes) Migration Opportunity`,
        impact: `Your application runs both the Pages Router (${pagesRoutePaths.length} routes) and the App Router (${appPagePaths.length} routes). Hybrid routing incurs double router bundle overhead.`,
        remediation: `Migrate remaining pages/ routes to app/ to unlock nested layouts, React Server Components, and smaller client bundle size.`,
      });
    }

    // 7. Deep audits (API, config, caching, security, SEO, performance)
    const apiAudit = auditApiRoutes(normalizedPaths, sourceContents, improvements);
    const configAudit = auditNextConfig(normalizedPaths, sourceContents, manifests, improvements);
    const cachingAudit = auditCachingAndData(
      normalizedPaths,
      sourceContents,
      appPagePaths,
      isNext15OrHigher,
      improvements,
    );
    const securityAudit = auditSecurity(normalizedPaths, sourceContents, middlewareFiles, improvements);
    const seoAudit = auditSeoMetadata(
      normalizedPaths,
      sourceContents,
      appPagePaths,
      appRouterPresent,
      improvements,
    );
    const performance = auditPerformanceSignals(normalizedPaths, sourceContents, manifests, improvements);

    // If Next 15+ but we found no sync misuse, skip blanket warning (caching audit covers real hits).
    // Keep a light modernization note only when version is known and no sync findings exist yet
    // and source was too sparse to inspect — omitted intentionally for lower noise.

    // 8. Route Topology
    const routeGroupsSet = new Set<string>();
    const parallelRoutesSet = new Set<string>();
    const interceptingRoutesSet = new Set<string>();
    let dynamicRoutesCount = 0;

    for (const path of appPagePaths) {
      const groupMatches = path.match(/\(([^)]+)\)/g);
      if (groupMatches) groupMatches.forEach(g => routeGroupsSet.add(g));
      const slotMatches = path.match(/@([a-zA-Z0-9_-]+)/g);
      if (slotMatches) slotMatches.forEach(s => parallelRoutesSet.add(s));
      if (/\/\(\.\.?/.test(path)) interceptingRoutesSet.add(path);
      if (/\[[^\]]+\]/.test(path)) dynamicRoutesCount += 1;
    }

    const universalBoundaries: UniversalBoundary[] = [];
    middlewareFiles.forEach(f => {
      universalBoundaries.push({
        type: 'middleware',
        file: f,
        details: f.includes('proxy') ? 'Next.js 16 Proxy boundary' : 'Edge Middleware',
      });
    });

    const specialization: NextJsSpecialization = {
      router,
      version: detectedVersion,
      majorVersion,
      actionAudit: {
        totalActionsCount,
        actionFilesCount: allActionPaths.length,
        unvalidatedFilesCount,
        unprotectedFilesCount,
        complexActionsCount,
        actionFiles: auditedActionFiles,
      },
      apiAudit,
      bundleAudit: {
        serverComponentsCount,
        clientComponentsCount,
        totalComponents,
        serverRatio,
        clientRatio,
        unnecessaryClientFiles,
        rawImgTagFiles: performance.rawImgTagFiles,
        missingNextFont: performance.missingNextFont,
        sharpMissingWithImages: performance.sharpMissingWithImages,
      },
      resilienceAudit: {
        hasRootLayout,
        hasRootLoading,
        hasRootError,
        hasRootNotFound,
        hasGlobalError,
        layoutCount: layoutFiles.length,
        loadingCount: loadingFiles.length,
        errorCount: errorFiles.length,
        notFoundCount: notFoundFiles.length,
        missingLoadingSegments,
        missingErrorSegments,
      },
      configAudit,
      cachingAudit,
      securityAudit,
      seoAudit,
      improvements,
      routeGroups: Array.from(routeGroupsSet),
      parallelRoutes: Array.from(parallelRoutesSet),
      interceptingRoutes: Array.from(interceptingRoutesSet),
      dynamicRoutesCount,
    };

    const apiRisks = apiAudit.unvalidatedFilesCount + apiAudit.unprotectedFilesCount;
    const securityRisks = securityAudit.issueCount;
    const configIssues = configAudit.issueCount;

    return {
      id: 'nextjs',
      name: 'Next.js',
      version: detectedVersion,
      ecosystem: 'node',
      routingModel: 'file-system',
      routes: universalRoutes,
      boundaries: universalBoundaries,
      stats: {
        'App Router Pages': appPagePaths.length,
        'API Routes': apiAudit.routeHandlerCount + apiAudit.pagesApiCount,
        'Action Risks': unvalidatedFilesCount + unprotectedFilesCount,
        'API Risks': apiRisks,
        'Security Signals': securityRisks,
        'Config Issues': configIssues,
        'Bundle Optimizations': unnecessaryClientFiles.length + performance.rawImgTagFiles.length,
        'Server Component Ratio': `${serverRatio}%`,
      },
      specialization,
    };
  },
};
