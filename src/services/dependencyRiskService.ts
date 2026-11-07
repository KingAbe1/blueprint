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

type AddPackage = (name: string, version: string, direct: boolean, development: boolean) => void;

const NPM_LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json']);
const SUPPORTED_LOCKFILES = new Set([...NPM_LOCKFILES, 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']);

function lockfileName(path: string) {
  return path.split('/').pop()?.toLowerCase() || '';
}

/** Only registry versions can be checked against OSV (skip workspace:, link:, file:, git URLs, etc.). */
function isRegistryVersion(version: string) {
  return /^\d+\.\d+/.test(version);
}

/** Split "name@version" where name may be scoped ("@scope/pkg@1.2.3"). */
function splitNameAtVersion(spec: string): { name: string; version: string } | null {
  const at = spec.lastIndexOf('@');
  if (at <= 0) return null;
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

function unquoteYaml(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNpmLock(text: string, declared: Map<string, boolean>, add: AddPackage) {
  const lock = parseJson(text);
  if (!lock) return;
  const packages = lock.packages;
  if (packages && typeof packages === 'object') {
    for (const [path, raw] of Object.entries(packages)) {
      if (!path || !raw || typeof raw !== 'object') continue;
      const name = npmPackageName(path);
      const item = raw as { version?: unknown; dev?: unknown; devOptional?: unknown; link?: unknown };
      if (!name || typeof item.version !== 'string' || item.link === true) continue;
      const isTopLevelInLock = !path.includes('node_modules/') || (path.startsWith('node_modules/') && !path.slice(13).includes('node_modules/'));
      const direct = declared.has(name) && isTopLevelInLock;
      const isDev = item.dev === true || item.devOptional === true || (direct && declared.get(name) === true);
      add(name, item.version, direct, isDev);
    }
  } else if (lock.dependencies && typeof lock.dependencies === 'object') {
    const visit = (dependencies: Record<string, unknown>, parentDevelopment = false) => {
      for (const [name, raw] of Object.entries(dependencies)) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as { version?: unknown; dev?: unknown; dependencies?: Record<string, unknown> };
        if (typeof item.version === 'string') {
          const direct = declared.has(name) && !parentDevelopment;
          add(name, item.version, direct, item.dev === true || (direct && declared.get(name) === true));
        }
        if (item.dependencies) visit(item.dependencies, parentDevelopment || item.dev === true);
      }
    };
    visit(lock.dependencies as Record<string, unknown>);
  }
}

/** Parse a pnpm package key: v9 "name@1.0.0(peer@2)", v6 "/name@1.0.0(peer@2)", v5 "/name/1.0.0_peer@2". */
export function parsePnpmPackageKey(rawKey: string): { name: string; version: string } | null {
  let key = unquoteYaml(rawKey).replace(/^\//, '');
  const parenIndex = key.indexOf('(');
  if (parenIndex > 0) key = key.slice(0, parenIndex);
  const v5 = key.match(/^((?:@[^/]+\/)?[^/@]+)\/([^/]+)$/);
  if (v5 && isRegistryVersion(v5[2])) {
    return { name: v5[1], version: v5[2].split('_')[0] };
  }
  const parsed = splitNameAtVersion(key);
  if (!parsed) return null;
  return { name: parsed.name, version: parsed.version.split('_')[0] };
}

/** Line-based pnpm-lock.yaml reader (lockfile v5, v6, and v9). */
function parsePnpmLock(text: string, declared: Map<string, boolean>, add: AddPackage) {
  const lines = text.split(/\r?\n/);
  // Direct dependencies from `importers:` (v6+/v9) or top-level dependency sections (v5/v6 single project).
  const directDev = new Map<string, boolean>();
  const entries: Array<{ name: string; version: string; dev: boolean }> = [];
  let section = '';
  let importerGroup = '';
  let current: { name: string; version: string; dev: boolean } | null = null;

  const recordDirect = (name: string, group: string) => {
    const isDev = group === 'devDependencies';
    directDev.set(name, directDev.has(name) ? directDev.get(name)! && isDev : isDev);
  };

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0) {
      const match = trimmed.match(/^([A-Za-z]+):/);
      section = match ? match[1] : '';
      current = null;
      continue;
    }

    if (section === 'packages') {
      if (indent === 2 && trimmed.endsWith(':')) {
        const parsed = parsePnpmPackageKey(trimmed.slice(0, -1));
        current = parsed && isRegistryVersion(parsed.version) ? { ...parsed, dev: false } : null;
        if (current) entries.push(current);
      } else if (current && indent === 4 && /^dev:\s*true\b/.test(trimmed)) {
        current.dev = true;
      }
      continue;
    }

    if (section === 'importers') {
      if (indent === 4 && trimmed.endsWith(':')) importerGroup = trimmed.slice(0, -1);
      else if (indent === 6 && trimmed.endsWith(':') && /ependencies$/.test(importerGroup)) {
        recordDirect(unquoteYaml(trimmed.slice(0, -1)), importerGroup);
      }
      continue;
    }

    if (/^(dependencies|devDependencies|optionalDependencies)$/.test(section) && indent === 2) {
      const name = unquoteYaml(trimmed.split(':')[0]);
      if (name) recordDirect(name, section);
    }
  }

  const directNames = directDev.size > 0 ? directDev : declared;
  for (const entry of entries) {
    const direct = directNames.has(entry.name);
    add(entry.name, entry.version, direct, entry.dev || (direct && directNames.get(entry.name) === true));
  }
}

/** Name from a yarn descriptor: "@scope/pkg@npm:^1.0.0" -> "@scope/pkg". */
function yarnDescriptorName(descriptor: string) {
  // Berry quotes the whole header once: "a@npm:^1, a@npm:^1.2", so strip quotes per side.
  const match = descriptor.trim().replace(/^"|"$/g, '').match(/^(@[^@/]+\/[^@]+|[^@]+)@/);
  return match ? match[1] : null;
}

/** yarn.lock reader for classic (v1) and Berry (v2+) formats. */
function parseYarnLock(text: string, declared: Map<string, boolean>, add: AddPackage) {
  const lines = text.split(/\r?\n/);
  let name: string | null = null;
  let version: string | null = null;
  let skip = false;

  const flush = () => {
    if (name && version && !skip && isRegistryVersion(version)) {
      const direct = declared.has(name);
      add(name, version, direct, direct && declared.get(name) === true);
    }
    name = null;
    version = null;
    skip = false;
  };

  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      flush();
      const header = line.replace(/:\s*$/, '');
      if (header === '__metadata') continue;
      name = yarnDescriptorName(header.split(/,\s*/)[0] || '');
      continue;
    }
    const trimmed = line.trim();
    const versionMatch = trimmed.match(/^version:?\s+"?([^"\s]+)"?/);
    if (versionMatch && line.startsWith('  ') && !line.startsWith('    ')) {
      version = versionMatch[1];
      continue;
    }
    const resolution = trimmed.match(/^resolution:\s+"?([^"]+)"?/);
    if (resolution && /@(workspace|link|portal|file|exec):/.test(resolution[1])) skip = true;
  }
  flush();
}

/** bun.lock is JSON with trailing commas; drop them outside of strings before parsing. */
function parseLooseJson(text: string): Record<string, unknown> | null {
  let output = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      output += char;
      if (char === '\\') {
        output += text[i + 1] ?? '';
        i += 1;
      } else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j += 1;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    output += char;
  }
  return parseJson(output);
}

function parseBunLock(text: string, declared: Map<string, boolean>, add: AddPackage) {
  const lock = parseLooseJson(text);
  const packages = lock?.packages;
  if (!packages || typeof packages !== 'object') return;
  for (const raw of Object.values(packages as Record<string, unknown>)) {
    if (!Array.isArray(raw) || typeof raw[0] !== 'string') continue;
    const parsed = splitNameAtVersion(raw[0]);
    if (!parsed || !isRegistryVersion(parsed.version)) continue;
    const direct = declared.has(parsed.name);
    add(parsed.name, parsed.version, direct, direct && declared.get(parsed.name) === true);
  }
}

/** Locked npm-registry packages from package-lock, pnpm-lock, yarn.lock, or bun.lock. */
export function extractNpmDependencyInventory(paths: string[], manifests: Record<string, string>, enabled: boolean): DependencyInventory | undefined {
  if (!enabled) return undefined;
  const lockfiles = paths.filter(path => SUPPORTED_LOCKFILES.has(lockfileName(path)));
  const { declared, declaredCount } = manifestDependencies(manifests);
  const byKey = new Map<string, LockedDependency>();

  const add: AddPackage = (name, version, direct, development) => {
    const key = `${name}@${version}`;
    const existing = byKey.get(key);
    byKey.set(key, existing
      ? { ...existing, direct: existing.direct || direct, development: existing.development && development }
      : { name, version, direct, development });
  };

  for (const lockPath of lockfiles) {
    const text = manifests[lockPath];
    if (!text) continue;
    const file = lockfileName(lockPath);
    try {
      if (NPM_LOCKFILES.has(file)) parseNpmLock(text, declared, add);
      else if (file === 'pnpm-lock.yaml') parsePnpmLock(text, declared, add);
      else if (file === 'yarn.lock') parseYarnLock(text, declared, add);
      else if (file === 'bun.lock') parseBunLock(text, declared, add);
    } catch {
      // A malformed lockfile should not fail the whole scan.
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
