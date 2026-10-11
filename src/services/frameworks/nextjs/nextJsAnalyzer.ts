import {
  FrameworkAnalyzer,
  FrameworkProfile,
  NextJsSpecialization,
  UniversalRoute,
  UniversalBoundary,
  NextJsServerActionFile,
} from '../../../types/framework';

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
          // Ignore json parse error
        }
      }
    }

    const majorVersion = detectedVersion ? Number(detectedVersion.match(/^\d+/)?.[0]) : undefined;
    const isNext14OrHigher = Boolean(majorVersion && majorVersion >= 14);
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

    for (const apiPath of appApiPaths) {
      const pattern = formatAppRoutePattern(apiPath);
      universalRoutes.push({
        path: pattern,
        pattern,
        type: 'api',
        file: apiPath,
        dynamicParams: extractDynamicParams(pattern),
      });
    }

    // 3. Component Distribution (Server vs Client Components)
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
    let serverComponentsCount = 0;

    for (const compPath of componentCandidatePaths) {
      const content = sourceContents[compPath];
      if (content) {
        // Check for 'use client' or "use client" directive in the first 500 chars
        const topSlice = content.slice(0, 500);
        if (/^\s*['"]use client['"]/m.test(topSlice)) {
          clientComponentFiles.push(compPath);
        } else {
          serverComponentsCount += 1;
        }
      } else {
        // Fallback: Default to server component if in App Router, client if inside generic components
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

    // 4. Server Actions Inventory ('use server')
    const actionFiles: NextJsServerActionFile[] = [];
    const actionCandidatePaths = normalizedPaths.filter(path => {
      const lower = path.toLowerCase();
      const isInActionsDir = lower.includes('/actions/') || lower.startsWith('actions/');
      const isSource = /\.(?:js|jsx|ts|tsx)$/i.test(path) && !/\.(?:test|spec|d)\.[^/]+$/.test(path);
      return isInActionsDir && isSource;
    });

    // Also check any file with 'use server'
    const otherServerActionPaths = normalizedPaths.filter(path => {
      if (actionCandidatePaths.includes(path)) return false;
      const content = sourceContents[path];
      return content ? /^\s*['"]use server['"]/m.test(content.slice(0, 500)) : false;
    });

    const allActionPaths = [...new Set([...actionCandidatePaths, ...otherServerActionPaths])];
    let totalActionsCount = 0;

    for (const actPath of allActionPaths) {
      const content = sourceContents[actPath] || '';
      const lines = content ? content.split(/\r\n|\n|\r/).length : 0;
      const exportedActions: string[] = [];

      // Extract exported functions
      const exportFuncRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
      let match: RegExpExecArray | null;
      while ((match = exportFuncRegex.exec(content)) !== null) {
        exportedActions.push(match[1]);
      }

      const exportConstRegex = /export\s+const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async)?/g;
      while ((match = exportConstRegex.exec(content)) !== null) {
        if (!exportedActions.includes(match[1])) {
          exportedActions.push(match[1]);
        }
      }

      actionFiles.push({
        path: actPath,
        exportedActions,
        lineCount: lines,
      });

      totalActionsCount += exportedActions.length;
    }

    // 5. UI Boundary Health (Layouts, Loading, Error, Not-Found)
    const layoutFiles = normalizedPaths.filter(p => /\/layout\.(?:js|jsx|ts|tsx)$/i.test(p) || /^layout\.(?:js|jsx|ts|tsx)$/i.test(p));
    const loadingFiles = normalizedPaths.filter(p => /\/loading\.(?:js|jsx|ts|tsx)$/i.test(p) || /^loading\.(?:js|jsx|ts|tsx)$/i.test(p));
    const errorFiles = normalizedPaths.filter(p => /\/error\.(?:js|jsx|ts|tsx)$/i.test(p) || /^error\.(?:js|jsx|ts|tsx)$/i.test(p));
    const notFoundFiles = normalizedPaths.filter(p => /\/not-found\.(?:js|jsx|ts|tsx)$/i.test(p) || /^not-found\.(?:js|jsx|ts|tsx)$/i.test(p));
    const middlewareFiles = normalizedPaths.filter(p => /(^|\/)(?:proxy|middleware)\.(?:js|ts)$/i.test(p));

    const hasRootLayout = layoutFiles.some(p => /(^|\/)app\/layout\./i.test(p) || /(^|\/)src\/app\/layout\./i.test(p));
    const hasRootLoading = loadingFiles.some(p => /(^|\/)app\/loading\./i.test(p) || /(^|\/)src\/app\/loading\./i.test(p));
    const hasRootError = errorFiles.some(p => /(^|\/)app\/error\./i.test(p) || /(^|\/)src\/app\/error\./i.test(p));
    const hasRootNotFound = notFoundFiles.some(p => /(^|\/)app\/not-found\./i.test(p) || /(^|\/)src\/app\/not-found\./i.test(p));

    // 6. Route Topology Patterns (Route Groups, Parallel Slots, Intercepting Routes)
    const routeGroupsSet = new Set<string>();
    const parallelRoutesSet = new Set<string>();
    const interceptingRoutesSet = new Set<string>();
    let dynamicRoutesCount = 0;

    for (const path of appPagePaths) {
      // Route groups: (name)
      const groupMatches = path.match(/\(([^)]+)\)/g);
      if (groupMatches) {
        groupMatches.forEach(g => routeGroupsSet.add(g));
      }
      // Parallel routes: @slot
      const slotMatches = path.match(/@([a-zA-Z0-9_-]+)/g);
      if (slotMatches) {
        slotMatches.forEach(s => parallelRoutesSet.add(s));
      }
      // Intercepting routes: (..) or (.)
      if (/\/\(\.\.?/.test(path)) {
        interceptingRoutesSet.add(path);
      }
      // Dynamic route count
      if (/\[[^\]]+\]/.test(path)) {
        dynamicRoutesCount += 1;
      }
    }

    // 7. Universal Boundaries
    const universalBoundaries: UniversalBoundary[] = [];
    middlewareFiles.forEach(f => {
      universalBoundaries.push({
        type: 'middleware',
        file: f,
        details: f.includes('proxy') ? 'Next.js 16 Proxy runtime' : 'Edge Middleware',
      });
    });
    actionFiles.forEach(f => {
      universalBoundaries.push({
        type: 'server',
        file: f.path,
        details: `${f.exportedActions.length} Server Actions`,
      });
    });

    // 8. Modernization & Migration Recommendations
    const hasLegacyMiddleware = middlewareFiles.some(p => /(^|\/)middleware\.(?:js|ts)$/i.test(p));
    const deprecatedMiddlewareDetected = Boolean(isNext16OrHigher && hasLegacyMiddleware);

    const recommendations: NextJsSpecialization['modernization']['recommendations'] = [];

    if (deprecatedMiddlewareDetected) {
      recommendations.push({
        title: 'Deprecated Middleware File Name in Next.js 16',
        description: 'Next.js 16 replaces middleware.ts with proxy.ts for network-level request interception. Rename middleware.ts to proxy.ts before upgrading runtime dependencies.',
        severity: 'action-required',
      });
    }

    if (isNext15OrHigher) {
      recommendations.push({
        title: 'Async Request APIs in Next.js 15+',
        description: 'Next.js 15 makes cookies(), headers(), and params asynchronous. Verify that all server-side cookie accesses and route parameter lookups are explicitly awaited.',
        severity: 'info',
      });
    }

    if (appPagePaths.length > 0 && pagesRoutePaths.length > 0) {
      recommendations.push({
        title: 'Hybrid Architecture Migration in Progress',
        description: `${pagesRoutePaths.length} legacy Pages Router routes coexist with ${appPagePaths.length} App Router routes. Consolidating into the App Router will unlock nested layouts, React Server Components, and smaller client bundles.`,
        severity: 'warning',
      });
    }

    if (appPagePaths.length > 0 && loadingFiles.length === 0) {
      recommendations.push({
        title: 'Missing Suspense Loading Skeletons',
        description: 'No loading.tsx files detected in the App Router. Implementing loading.tsx boundaries provides instant visual feedback and smooth navigation during asynchronous server data fetches.',
        severity: 'warning',
      });
    }

    if (appPagePaths.length > 0 && errorFiles.length === 0) {
      recommendations.push({
        title: 'Missing App Router Error Boundaries',
        description: 'No error.tsx files found. Adding root and nested error.tsx boundaries prevents full-page crashes by gracefully isolating server render exceptions.',
        severity: 'action-required',
      });
    }

    // Assemble Specialization
    const specialization: NextJsSpecialization = {
      router,
      componentDistribution: {
        serverComponentsCount,
        clientComponentsCount,
        totalComponents,
        serverRatio,
        clientRatio,
        clientComponentFiles: clientComponentFiles.slice(0, 50),
      },
      serverActions: {
        totalActionsCount,
        actionFilesCount: actionFiles.length,
        actionFiles,
      },
      boundaryHealth: {
        hasRootLayout,
        hasRootLoading,
        hasRootError,
        hasRootNotFound,
        layoutCount: layoutFiles.length,
        loadingCount: loadingFiles.length,
        errorCount: errorFiles.length,
        notFoundCount: notFoundFiles.length,
        middlewareFiles,
        requestBoundaryNote: deprecatedMiddlewareDetected
          ? 'Next.js 16 deprecates the middleware filename in favor of proxy; migrate to proxy.ts.'
          : undefined,
      },
      modernization: {
        version: detectedVersion,
        majorVersion,
        isNext14OrHigher,
        isNext15OrHigher,
        isNext16OrHigher,
        deprecatedMiddlewareDetected,
        legacyPagesRouterCount: pagesRoutePaths.length,
        appRouterCount: appPagePaths.length,
        recommendations,
      },
      routeGroups: Array.from(routeGroupsSet),
      parallelRoutes: Array.from(parallelRoutesSet),
      interceptingRoutes: Array.from(interceptingRoutesSet),
      dynamicRoutesCount,
    };

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
        'API Endpoints': appApiPaths.length + pagesApiPaths.length,
        'Server Actions': totalActionsCount,
        'Server Component Ratio': `${serverRatio}%`,
      },
      specialization,
    };
  },
};
