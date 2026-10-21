import {
  FrameworkAnalyzer,
  FrameworkProfile,
  NodeJsArchitecturalImprovement,
  NodeJsSpecialization,
  UniversalBoundary,
  UniversalRoute,
} from '../../../types/framework';
import {
  auditNodeConfig,
  auditNodeMiddleware,
  auditNodeResilience,
  auditNodeRoutes,
  auditNodeSecurity,
  collectNodeEntryFiles,
  detectNodeRuntimeStyle,
} from './nodeJsDeepAudits';

const NODE_SERVER_DEPS =
  /["'](?:express|fastify|koa|hono|@nestjs\/core|restify|polka|@hapi\/hapi|micro)["']\s*:/;

function hasNextOrRemix(paths: string[], manifests: Record<string, string>): boolean {
  const normalized = paths.map(p => p.replace(/\\/g, '/'));
  const hasNext =
    normalized.some(path => /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path)) ||
    Object.entries(manifests).some(
      ([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && /["']next["']\s*:/.test(content),
    );
  if (hasNext) return true;
  const hasRemix =
    normalized.some(path => /(^|\/)remix\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path)) ||
    Object.entries(manifests).some(
      ([path, content]) =>
        /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) &&
        /["']@remix-run\/(?:react|node|dev|cloudflare|deno|express|serve)["']\s*:|["']remix["']\s*:/.test(content),
    );
  return hasRemix;
}

function detectNodeVersion(manifests: Record<string, string>): string | undefined {
  for (const [path, content] of Object.entries(manifests)) {
    if (!/(^|\/)package\.json$/i.test(path.replace(/\\/g, '/'))) continue;
    try {
      const parsed = JSON.parse(content) as {
        engines?: { node?: string };
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const engine = parsed.engines?.node;
      if (typeof engine === 'string' && engine.trim()) return engine.replace(/^[^0-9]*/, '').split(/[^\d.]/)[0] || engine;
      const runtimeDep =
        parsed.dependencies?.express ||
        parsed.dependencies?.fastify ||
        parsed.dependencies?.koa ||
        parsed.dependencies?.hono ||
        parsed.dependencies?.['@nestjs/core'];
      if (typeof runtimeDep === 'string') return runtimeDep.replace(/^[^0-9]*/, '');
    } catch {
      // ignore
    }
  }
  return undefined;
}

function extractRoutesFromContent(path: string, content: string): UniversalRoute[] {
  const routes: UniversalRoute[] = [];
  const patterns = [
    /\.(?:get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    /@(?:Get|Post|Put|Patch|Delete|All)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const pattern = match[1] || '/';
      if (!pattern.startsWith('/') && !pattern.includes(':') && pattern.length > 64) continue;
      const methodMatch = match[0].match(/\.(get|post|put|patch|delete|all)\b|@(Get|Post|Put|Patch|Delete|All)/i);
      const method = (methodMatch?.[1] || methodMatch?.[2] || 'GET').toUpperCase();
      routes.push({
        path: pattern.startsWith('/') ? pattern : `/${pattern}`,
        pattern: pattern.startsWith('/') ? pattern : `/${pattern}`,
        type: 'api',
        method,
        file: path,
      });
      if (routes.length >= 40) return routes;
    }
  }
  return routes;
}

export const nodeJsAnalyzer: FrameworkAnalyzer<NodeJsSpecialization> = {
  id: 'nodejs',
  name: 'Node.js',

  detect({ paths, manifests, sourceContents = {} }): boolean {
    if (hasNextOrRemix(paths, manifests)) return false;

    const hasServerDep = Object.entries(manifests).some(
      ([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && NODE_SERVER_DEPS.test(content),
    );
    if (hasServerDep) return true;

    // Plain Node HTTP service without a framework package
    const listenHits = Object.entries(sourceContents).filter(([path, content]) => {
      if (typeof content !== 'string') return false;
      if (!/\.(?:js|ts|mjs|cjs)$/i.test(path)) return false;
      if (/(^|\/)(?:node_modules|dist|build)\//i.test(path.replace(/\\/g, '/'))) return false;
      return (
        /\b(?:createServer\s*\(|\.listen\s*\()/.test(content) &&
        /\b(?:http|https|node:http|node:https)\b/.test(content)
      );
    });
    return listenHits.length >= 1;
  },

  analyze({ paths, manifests, sourceContents = {} }): FrameworkProfile<NodeJsSpecialization> {
    const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));
    const improvements: NodeJsArchitecturalImprovement[] = [];
    const detectedVersion = detectNodeVersion(manifests);
    const majorVersion = detectedVersion ? Number(detectedVersion.match(/^\d+/)?.[0]) : undefined;
    const runtimeStyle = detectNodeRuntimeStyle(manifests, sourceContents);
    const entryFiles = collectNodeEntryFiles(normalizedPaths, sourceContents);

    const routeAudit = auditNodeRoutes(normalizedPaths, sourceContents, improvements);
    const middlewareAudit = auditNodeMiddleware(normalizedPaths, sourceContents, entryFiles, improvements);
    const resilienceAudit = auditNodeResilience(normalizedPaths, sourceContents, entryFiles, improvements);
    const configAudit = auditNodeConfig(manifests, normalizedPaths, improvements);
    const securityAudit = auditNodeSecurity(
      normalizedPaths,
      sourceContents,
      manifests,
      middlewareAudit,
      improvements,
    );

    const universalRoutes: UniversalRoute[] = [];
    for (const file of routeAudit.files.slice(0, 30)) {
      const content = sourceContents[file.path] || '';
      universalRoutes.push(...extractRoutesFromContent(file.path, content));
      if (universalRoutes.length >= 80) break;
    }

    const boundaries: UniversalBoundary[] = entryFiles.map(file => ({
      type: 'server' as const,
      file,
      details: 'Node.js server entry',
    }));

    const specialization: NodeJsSpecialization = {
      version: detectedVersion,
      majorVersion,
      runtimeStyle,
      routeAudit,
      middlewareAudit,
      resilienceAudit,
      configAudit,
      securityAudit,
      improvements,
      entryFiles,
    };

    return {
      id: 'nodejs',
      name: 'Node.js',
      version: detectedVersion,
      ecosystem: 'node',
      routingModel: 'code-based',
      routes: universalRoutes,
      boundaries,
      stats: {
        Runtime: runtimeStyle,
        Handlers: routeAudit.totalHandlers,
        'Route Files': routeAudit.filesCount,
        'Route Risks': routeAudit.unvalidatedFilesCount + routeAudit.unprotectedFilesCount,
        'Security Signals': securityAudit.issueCount,
        Entrypoints: entryFiles.length,
      },
      specialization,
    };
  },
};
