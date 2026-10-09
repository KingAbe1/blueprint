import type { DependencyAdvisory, DependencyInventory, DependencyRiskAssessment, LockedDependency } from '../types/codebase';

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface OsvVulnerability {
  id: string;
  summary?: string;
  details?: string;
  modified?: string;
  severity?: Array<{ type?: string; score?: string }>;
  database_specific?: { severity?: string; cvss?: { score?: number } };
  ecosystem_specific?: { severity?: string };
  affected?: Array<{
    package?: { name?: string; ecosystem?: string };
    ranges?: Array<{ events?: Array<{ fixed?: string; introduced?: string; last_affected?: string }> }>;
  }>;
  references?: Array<{ url?: string }>;
}

interface OsvQueryResult {
  vulns?: Array<{ id: string }>;
  next_page_token?: string;
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const result = JSON.parse(text);
    return result && typeof result === 'object' ? result : null;
  } catch {
    return null;
  }
}

function manifestDependencies(manifests: Record<string, string>) {
  const declared = new Map<string, boolean>();
  let declaredCount = 0;
  for (const [path, text] of Object.entries(manifests)) {
    if (path.split('/').pop()?.toLowerCase() !== 'package.json') continue;
    const manifest = parseJson(text) as PackageManifest | null;
    if (!manifest) continue;
    for (const [section, development] of [['dependencies', false], ['devDependencies', true], ['optionalDependencies', false], ['peerDependencies', false]] as const) {
      const sectionDeps = manifest[section];
      if (!sectionDeps || typeof sectionDeps !== 'object') continue;
      for (const name of Object.keys(sectionDeps)) {
        declaredCount += 1;
        if (!declared.has(name) || !development) declared.set(name, development && (declared.get(name) ?? true));
      }
    }
  }
  return { declared, declaredCount };
}

function npmPackageName(lockPath: string) {
  const marker = lockPath.lastIndexOf('node_modules/');
  if (marker < 0) return null;
  const parts = lockPath.slice(marker + 'node_modules/'.length).split('/').filter(Boolean);
  if (!parts.length) return null;
  return parts[0].startsWith('@') ? (parts.length > 1 ? `${parts[0]}/${parts[1]}` : null) : parts[0];
}

export function extractNpmDependencyInventory(paths: string[], manifests: Record<string, string>, isNextProject: boolean): DependencyInventory | undefined {
  if (!isNextProject) return undefined;
  const lockfiles = paths.filter(path => ['package-lock.json', 'npm-shrinkwrap.json'].includes(path.split('/').pop()?.toLowerCase() || ''));
  const { declared, declaredCount } = manifestDependencies(manifests);
  const byKey = new Map<string, LockedDependency>();

  for (const lockPath of lockfiles) {
    const lock = parseJson(manifests[lockPath] || '');
    if (!lock) continue;
    const packages = lock.packages;
    if (packages && typeof packages === 'object') {
      for (const [path, raw] of Object.entries(packages)) {
        if (!path || !raw || typeof raw !== 'object') continue;
        const name = npmPackageName(path);
        const item = raw as { version?: unknown; dev?: unknown; devOptional?: unknown; link?: unknown };
        if (!name || typeof item.version !== 'string' || item.link === true) continue;
        const key = `${name}@${item.version}`;
        const direct = declared.has(name) && path.lastIndexOf('node_modules/') < 0;
        const packageInfo = { name, version: item.version, direct, development: item.dev === true || item.devOptional === true || (direct && declared.get(name) === true) };
        const existing = byKey.get(key);
        byKey.set(key, existing ? { ...existing, direct: existing.direct || direct, development: existing.development && packageInfo.development } : packageInfo);
      }
    } else if (lock.dependencies && typeof lock.dependencies === 'object') {
      const visit = (dependencies: Record<string, unknown>, parentDevelopment = false) => {
        for (const [name, raw] of Object.entries(dependencies)) {
          if (!raw || typeof raw !== 'object') continue;
          const item = raw as { version?: unknown; dev?: unknown; dependencies?: Record<string, unknown> };
          if (typeof item.version === 'string') {
            const direct = declared.has(name) && !parentDevelopment;
            const key = `${name}@${item.version}`;
            const development = item.dev === true || (direct && declared.get(name) === true);
            const existing = byKey.get(key);
            byKey.set(key, existing ? { ...existing, direct: existing.direct || direct, development: existing.development && development } : { name, version: item.version, direct, development });
          }
          if (item.dependencies) visit(item.dependencies, parentDevelopment || item.dev === true);
        }
      };
      visit(lock.dependencies as Record<string, unknown>);
    }
  }

  const packages = [...byKey.values()].sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version)).slice(0, 5000);
  const resolvedDirectNames = new Set(packages.filter(item => item.direct).map(item => item.name));
  const unresolvedDeclaredDependencies = [...declared.keys()].filter(name => !resolvedDirectNames.has(name)).length;
  return { ecosystem: 'npm', lockfiles, packages, declaredDependencies: declaredCount, unresolvedDeclaredDependencies };
}

function normalizeSeverity(vulnerability: OsvVulnerability): DependencyAdvisory['severity'] {
  const raw = vulnerability.database_specific?.severity || vulnerability.ecosystem_specific?.severity;
  const text = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (text.includes('critical')) return 'critical';
  if (text.includes('high')) return 'high';
  if (text.includes('moderate') || text.includes('medium')) return 'medium';
  if (text.includes('low')) return 'low';
  return 'unknown';
}

function fixedVersionsFor(vulnerability: OsvVulnerability, packageName: string) {
  const versions = new Set<string>();
  for (const affected of vulnerability.affected || []) {
    if (affected.package?.name && affected.package.name !== packageName) continue;
    for (const range of affected.ranges || []) {
      for (const event of range.events || []) if (event.fixed) versions.add(event.fixed);
    }
  }
  return [...versions].slice(0, 4);
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`OSV.dev returned ${response.status}.`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function scanNpmDependencyRisks(inventory: DependencyInventory): Promise<DependencyRiskAssessment> {
  const packages = inventory.packages.slice(0, 2000);
  const advisoryPackages = new Map<string, Set<string>>();
  const advisoryPackageData = new Map<string, LockedDependency>();
  let incomplete = inventory.packages.length > packages.length;

  for (let offset = 0; offset < packages.length; offset += 100) {
    let queries = packages.slice(offset, offset + 100).map(dependency => ({ package: { ecosystem: 'npm', name: dependency.name }, version: dependency.version }));
    for (let page = 0; queries.length && page < 5; page += 1) {
      const body = await fetchJson('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries }),
      }) as { results?: OsvQueryResult[] };
      const results = body.results || [];
      const nextQueries: typeof queries = [];
      results.forEach((result, resultIndex) => {
        const dependency = queries[resultIndex];
        if (!dependency) return;
        for (const vulnerability of result.vulns || []) {
          const dependencyKey = `${dependency.package.name}@${dependency.version}`;
          const packageKeys = advisoryPackages.get(vulnerability.id) || new Set<string>();
          packageKeys.add(dependencyKey);
          advisoryPackages.set(vulnerability.id, packageKeys);
          advisoryPackageData.set(dependencyKey, packages.find(item => item.name === dependency.package.name && item.version === dependency.version)!);
        }
        if (result.next_page_token) nextQueries.push({ ...dependency, page_token: result.next_page_token } as typeof queries[number]);
      });
      if (results.length !== queries.length) incomplete = true;
      queries = nextQueries;
      if (queries.length && page === 4) incomplete = true;
    }
  }

  const advisoryIds = [...advisoryPackages.keys()];
  const advisoryDetails = new Map<string, OsvVulnerability>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(8, advisoryIds.length) }, async () => {
    while (cursor < advisoryIds.length) {
      const id = advisoryIds[cursor++];
      try {
        const vulnerability = await fetchJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`) as OsvVulnerability;
        advisoryDetails.set(id, vulnerability);
      } catch {
        incomplete = true;
      }
    }
  });
  await Promise.all(workers);

  const advisories: DependencyAdvisory[] = [];
  for (const [id, packageKeys] of advisoryPackages) {
    const vulnerability = advisoryDetails.get(id);
    if (!vulnerability) continue;
    for (const packageKey of packageKeys) {
      const dependency = advisoryPackageData.get(packageKey);
      if (!dependency) continue;
      advisories.push({
        id,
        packageName: dependency.name,
        version: dependency.version,
        severity: normalizeSeverity(vulnerability),
        summary: vulnerability.summary || vulnerability.details?.split('\n')[0] || 'Known vulnerability advisory for this package version.',
        fixedVersions: fixedVersionsFor(vulnerability, dependency.name),
        references: (vulnerability.references || []).map(reference => reference.url).filter((url): url is string => Boolean(url)).slice(0, 3),
      });
    }
  }

  const severityRank: Record<DependencyAdvisory['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
  advisories.sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || left.packageName.localeCompare(right.packageName));
  return { provider: 'OSV.dev', scannedAt: Date.now(), packagesChecked: packages.length, advisories, incomplete };
}
