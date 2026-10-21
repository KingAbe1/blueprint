import {
  FrameworkAnalyzer,
  FrameworkProfile,
  RemixSpecialization,
  RemixArchitecturalImprovement,
  UniversalRoute,
  UniversalBoundary,
} from '../../../types/framework';
import {
  auditRemixBundle,
  auditRemixConfig,
  auditRemixResilience,
  auditRemixRouteHandlers,
  auditRemixSecurity,
  auditRemixSeo,
  isRemixRouteModule,
} from './remixDeepAudits';

function detectRemixVersion(manifests: Record<string, string>): string | undefined {
  for (const [path, content] of Object.entries(manifests)) {
    if (!/(^|\/)package\.json$/i.test(path.replace(/\\/g, '/'))) continue;
    try {
      const parsed = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const raw =
        parsed.dependencies?.['@remix-run/react'] ||
        parsed.dependencies?.['@remix-run/node'] ||
        parsed.dependencies?.remix ||
        parsed.devDependencies?.['@remix-run/dev'] ||
        parsed.devDependencies?.['@remix-run/react'];
      if (typeof raw === 'string') return raw.replace(/^[^0-9]*/, '');
    } catch {
      // ignore
    }
  }
  return undefined;
}

export const remixAnalyzer: FrameworkAnalyzer<RemixSpecialization> = {
  id: 'remix',
  name: 'Remix',

  detect({ paths, manifests }): boolean {
    const normalized = paths.map(p => p.replace(/\\/g, '/'));
    // Prefer Next.js when both signals exist — registry order also puts Next first.
    const hasNext =
      normalized.some(path => /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path)) ||
      Object.entries(manifests).some(
        ([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && /["']next["']\s*:/.test(content),
      );
    if (hasNext) return false;

    const hasRemixConfig = normalized.some(path => /(^|\/)remix\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path));
    const hasRemixDep = Object.entries(manifests).some(
      ([path, content]) =>
        /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) &&
        /["']@remix-run\/(?:react|node|dev|cloudflare|deno|express|serve)["']\s*:|["']remix["']\s*:/.test(content),
    );
    const hasRoutesTree =
      normalized.some(path => /(^|\/)app\/root\.(?:jsx?|tsx?)$/i.test(path)) &&
      normalized.some(path => /(^|\/)app\/routes\//i.test(path));
    const viteConfigMentionsRemix = Object.entries(manifests).some(
      ([path, content]) => /(^|\/)vite\.config\./i.test(path.replace(/\\/g, '/')) && /@remix-run\/dev|remix\s*\(/i.test(content),
    );

    return hasRemixConfig || hasRemixDep || (hasRoutesTree && viteConfigMentionsRemix);
  },

  analyze({ paths, manifests, sourceContents = {} }): FrameworkProfile<RemixSpecialization> {
    const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));
    const improvements: RemixArchitecturalImprovement[] = [];
    const detectedVersion = detectRemixVersion(manifests);
    const majorVersion = detectedVersion ? Number(detectedVersion.match(/^\d+/)?.[0]) : undefined;

    const routePaths = normalizedPaths.filter(isRemixRouteModule);
    const flatRouteFiles = routePaths.filter(path => /\/routes\/[^/]+\.(?:jsx?|tsx?)$/i.test(path));
    const nestedRouteFiles = routePaths.filter(path => /\/routes\/[^/]+\//i.test(path));
    const routingStyle: RemixSpecialization['routingStyle'] =
      flatRouteFiles.length > 0 && nestedRouteFiles.length > 0
        ? 'mixed'
        : nestedRouteFiles.length > 0
          ? 'nested-folders'
          : flatRouteFiles.length > 0
            ? 'flat-routes'
            : 'not-identified';

    const { loaderAudit, actionAudit, resourceRouteCount } = auditRemixRouteHandlers(
      routePaths,
      sourceContents,
      improvements,
    );
    const resilienceAudit = auditRemixResilience(normalizedPaths, sourceContents, routePaths, improvements);
    const bundleAudit = auditRemixBundle(routePaths, sourceContents, improvements);
    const configAudit = auditRemixConfig(
      normalizedPaths,
      sourceContents,
      manifests,
      routePaths,
      improvements,
    );
    const securityAudit = auditRemixSecurity(
      normalizedPaths,
      sourceContents,
      routePaths,
      improvements,
    );
    const seoAudit = auditRemixSeo(normalizedPaths, sourceContents, routePaths, improvements);

    let dynamicRoutesCount = 0;
    const universalRoutes: UniversalRoute[] = [];
    for (const path of routePaths) {
      const base = path.split('/routes/')[1] || path;
      const pattern = '/' + base.replace(/\.(?:jsx?|tsx?)$/i, '').replace(/\$/g, ':').replace(/\./g, '/');
      if (/\$|\[/.test(base)) dynamicRoutesCount += 1;
      const content = sourceContents[path] || '';
      const isResource = (/\bloader\b|\baction\b/.test(content)) && !/\bexport\s+default\b/.test(content);
      universalRoutes.push({
        path: pattern,
        pattern,
        type: isResource ? 'api' : 'page',
        file: path,
        dynamicParams: (pattern.match(/:([A-Za-z0-9_]+)/g) || []).map(p => p.slice(1)),
      });
    }

    const boundaries: UniversalBoundary[] = [];
    const rootPath = normalizedPaths.find(path => /(^|\/)app\/root\.(?:jsx?|tsx?)$/i.test(path));
    if (rootPath) {
      boundaries.push({ type: 'server', file: rootPath, details: 'Remix root route' });
    }
    const entryServer = normalizedPaths.find(path => /(^|\/)app\/entry\.server\.(?:jsx?|tsx?)$/i.test(path));
    if (entryServer) {
      boundaries.push({ type: 'server', file: entryServer, details: 'Remix server entry' });
    }

    const specialization: RemixSpecialization = {
      version: detectedVersion,
      majorVersion,
      routingStyle,
      loaderAudit,
      actionAudit,
      resilienceAudit,
      bundleAudit,
      configAudit,
      securityAudit,
      seoAudit,
      improvements,
      resourceRouteCount,
      dynamicRoutesCount,
    };

    return {
      id: 'remix',
      name: 'Remix',
      version: detectedVersion,
      ecosystem: 'node',
      routingModel: 'file-system',
      routes: universalRoutes,
      boundaries,
      stats: {
        'Route Modules': routePaths.length,
        'Loaders': loaderAudit.totalHandlers,
        'Actions': actionAudit.totalHandlers,
        'Resource Routes': resourceRouteCount,
        'Action Risks': actionAudit.unvalidatedFilesCount + actionAudit.unprotectedFilesCount,
        'Loader Mutations': loaderAudit.mutatingFilesCount ?? 0,
        'Security Signals': securityAudit.issueCount,
      },
      specialization,
    };
  },
};
