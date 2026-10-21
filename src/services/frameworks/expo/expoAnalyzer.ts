import {
  FrameworkAnalyzer,
  FrameworkProfile,
  ExpoArchitecturalImprovement,
  ExpoSpecialization,
  UniversalBoundary,
  UniversalRoute,
} from '../../../types/framework';
import {
  auditExpoConfig,
  auditExpoNavigation,
  auditExpoPerformance,
  auditExpoSecurity,
  collectExpoEntryFiles,
  detectExpoSdkVersion,
} from './expoDeepAudits';

const EXPO_OR_RN_DEP = /["'](?:expo|expo-router|react-native)["']\s*:/;

function hasNextOrRemix(paths: string[], manifests: Record<string, string>): boolean {
  const normalized = paths.map(p => p.replace(/\\/g, '/'));
  const hasNext =
    normalized.some(path => /(^|\/)next\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path)) ||
    Object.entries(manifests).some(
      ([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && /["']next["']\s*:/.test(content),
    );
  if (hasNext) return true;
  return (
    normalized.some(path => /(^|\/)remix\.config\.(?:[cm]?js|[cm]?ts)$/i.test(path)) ||
    Object.entries(manifests).some(
      ([path, content]) =>
        /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) &&
        /["']@remix-run\/(?:react|node|dev|cloudflare|deno|express|serve)["']\s*:|["']remix["']\s*:/.test(content),
    )
  );
}

export const expoAnalyzer: FrameworkAnalyzer<ExpoSpecialization> = {
  id: 'expo',
  name: 'Expo',

  detect({ paths, manifests }): boolean {
    if (hasNextOrRemix(paths, manifests)) return false;
    const hasDep = Object.entries(manifests).some(
      ([path, content]) => /(^|\/)package\.json$/i.test(path.replace(/\\/g, '/')) && EXPO_OR_RN_DEP.test(content),
    );
    if (hasDep) return true;
    const normalized = paths.map(p => p.replace(/\\/g, '/'));
    return (
      normalized.some(p => /(^|\/)app\.(?:json|config\.(?:js|ts))$/i.test(p)) &&
      normalized.some(p => /(^|\/)app\/_layout\.(?:jsx?|tsx?)$/i.test(p))
    );
  },

  analyze({ paths, manifests, sourceContents = {} }): FrameworkProfile<ExpoSpecialization> {
    const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));
    const improvements: ExpoArchitecturalImprovement[] = [];
    const detectedVersion = detectExpoSdkVersion(manifests);
    const sdkMajor = detectedVersion ? Number(detectedVersion.match(/^\d+/)?.[0]) : undefined;
    const entryFiles = collectExpoEntryFiles(normalizedPaths);

    const navigationAudit = auditExpoNavigation(normalizedPaths, sourceContents, manifests, improvements);
    const securityAudit = auditExpoSecurity(normalizedPaths, sourceContents, improvements);
    const configAudit = auditExpoConfig(
      normalizedPaths,
      sourceContents,
      manifests,
      sdkMajor,
      improvements,
    );
    const performanceAudit = auditExpoPerformance(normalizedPaths, sourceContents, improvements);

    const routes: UniversalRoute[] = normalizedPaths
      .filter(path => /(^|\/)app\/.+\.(?:jsx?|tsx?)$/i.test(path) && !/\/_layout\./i.test(path))
      .slice(0, 60)
      .map(path => {
        const base = path.split('/app/')[1] || path;
        const pattern =
          '/' +
          base
            .replace(/\.(?:jsx?|tsx?)$/i, '')
            .replace(/\/index$/i, '')
            .replace(/\[([^\]]+)\]/g, ':$1')
            .replace(/\+/g, '');
        return {
          path: pattern || '/',
          pattern: pattern || '/',
          type: 'page' as const,
          file: path,
        };
      });

    const boundaries: UniversalBoundary[] = entryFiles.map(file => ({
      type: 'client' as const,
      file,
      details: 'Expo / React Native entry',
    }));

    const specialization: ExpoSpecialization = {
      version: detectedVersion,
      sdkMajor,
      navigationAudit,
      securityAudit,
      configAudit,
      performanceAudit,
      improvements,
      entryFiles,
    };

    return {
      id: 'expo',
      name: 'Expo',
      version: detectedVersion,
      ecosystem: 'node',
      routingModel: navigationAudit.style === 'expo-router' ? 'file-system' : 'code-based',
      routes,
      boundaries,
      stats: {
        SDK: sdkMajor ?? detectedVersion ?? 'detected',
        Navigation: navigationAudit.style,
        Routes: navigationAudit.routeFileCount,
        'Security Signals': securityAudit.issueCount,
        'Config Issues': configAudit.issueCount,
        'Perf Signals': performanceAudit.issueCount,
      },
      specialization,
    };
  },
};
