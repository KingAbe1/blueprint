import React, { useState, useMemo } from 'react';
import {
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { DependencyInventory, DependencyRiskAssessment, DependencySeverity, LockedDependency } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewMetricValueAccent,
  overviewPanelClass,
  overviewRowEmphasis,
  overviewSeverityLabel,
} from './overviewUi';
import { handleExternalLinkClick } from '../../utils/openExternalUrl';

interface DependencyInventoryPanelProps {
  inventory?: DependencyInventory;
  dependencyRisk?: DependencyRiskAssessment;
  onViewSecurityDetails?: () => void;
  embedded?: boolean;
}

const SEVERITY_RANK: Record<DependencySeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

function highestSeverity(current: DependencySeverity | undefined, next: DependencySeverity): DependencySeverity {
  if (!current) return next;
  return SEVERITY_RANK[next] < SEVERITY_RANK[current] ? next : current;
}

const PAGE_SIZE = 50;

const NOTABLE_PACKAGES = new Set([
  'next',
  'react',
  'react-dom',
  '@prisma/client',
  'prisma',
  'tailwindcss',
  'typescript',
  'lucide-react',
  'zod',
  'axios',
  '@tanstack/react-query',
]);

function packageRowEmphasis(severity: DependencySeverity | undefined, isDark: boolean): string {
  if (!severity) return '';
  if (severity === 'critical') return overviewRowEmphasis(isDark, 'critical');
  if (severity === 'high') return overviewRowEmphasis(isDark, 'warning');
  return overviewRowEmphasis(isDark, 'info');
}

function classificationLabel(pkg: LockedDependency, hasExplicitDirect: boolean): string {
  const isProd = hasExplicitDirect ? pkg.direct && !pkg.development : !pkg.development;
  if (isProd) return 'Prod';
  if (pkg.development) return 'Dev';
  return 'Transitive';
}

export const DependencyInventoryPanel: React.FC<DependencyInventoryPanelProps> = React.memo(({
  inventory,
  dependencyRisk,
  onViewSecurityDetails,
  embedded = false,
}) => {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'dev' | 'transitive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);

  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = overviewPanelClass(isDark);
  const divide = overviewDivideClass(isDark);
  const border = overviewBorderClass(isDark);

  const packages = inventory?.packages || [];

  const advisoryByPackage = useMemo(() => {
    const map = new Map<string, { severity: DependencySeverity; count: number }>();
    for (const advisory of dependencyRisk?.advisories || []) {
      const prev = map.get(advisory.packageName);
      map.set(advisory.packageName, {
        severity: highestSeverity(prev?.severity, advisory.severity),
        count: (prev?.count ?? 0) + 1,
      });
    }
    return map;
  }, [dependencyRisk?.advisories]);

  const advisorySummary = useMemo(() => {
    const advisories = dependencyRisk?.advisories || [];
    const counts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
    for (const a of advisories) {
      counts[a.severity] += 1;
    }
    return {
      total: advisories.length,
      affectedPackages: advisoryByPackage.size,
      counts,
    };
  }, [dependencyRisk?.advisories, advisoryByPackage.size]);

  const hasExplicitDirect = useMemo(() => packages.some(p => p.direct), [packages]);

  const directCount = useMemo(() => {
    if (hasExplicitDirect) {
      return packages.filter(p => p.direct && !p.development).length;
    }
    return packages.filter(p => !p.development).length;
  }, [packages, hasExplicitDirect]);

  const devCount = useMemo(() => packages.filter(p => p.development).length, [packages]);
  const transitiveCount = useMemo(() => {
    if (hasExplicitDirect) {
      return packages.filter(p => !p.direct && !p.development).length;
    }
    return packages.filter(p => p.development && !p.direct).length;
  }, [packages, hasExplicitDirect]);

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const isProd = hasExplicitDirect ? pkg.direct && !pkg.development : !pkg.development;
      if (typeFilter === 'direct' && !isProd) return false;
      if (typeFilter === 'dev' && !pkg.development) return false;
      if (typeFilter === 'transitive' && (pkg.direct || isProd)) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return pkg.name.toLowerCase().includes(query) || pkg.version.toLowerCase().includes(query);
      }

      return true;
    });
  }, [packages, typeFilter, searchQuery, hasExplicitDirect]);

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const paginatedPackages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPackages.slice(start, start + PAGE_SIZE);
  }, [filteredPackages, currentPage]);

  const copySpecifier = async (name: string, version: string) => {
    try {
      await navigator.clipboard.writeText(`${name}@${version}`);
      setCopiedPkg(name);
      setTimeout(() => setCopiedPkg(null), 1500);
    } catch {
      // Ignore
    }
  };

  if (!inventory || packages.length === 0) {
    return null;
  }

  const lockfileLabel = inventory.lockfiles[0]?.split('/').pop() || 'lockfile';
  const cveMetricLevel =
    advisorySummary.counts.critical > 0 ? 'critical' : advisorySummary.total > 0 ? 'warning' : 'neutral';

  const metricsStrip = (
    <div className={`m-0 grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0 ${divide} ${border}`}>
      <div className="px-5 py-3.5 sm:px-6">
        <p className={`text-[13px] ${muted}`}>Locked</p>
        <p className={`mt-1.5 text-xl font-medium tabular-nums tracking-tight ${title}`}>
          {packages.length.toLocaleString()}
        </p>
      </div>
      <div className="px-5 py-3.5 sm:px-6">
        <p className={`text-[13px] ${muted}`}>Production</p>
        <p className={`mt-1.5 text-xl font-medium tabular-nums tracking-tight ${title}`}>{directCount}</p>
      </div>
      <div className="px-5 py-3.5 sm:px-6">
        <p className={`text-[13px] ${muted}`}>Development</p>
        <p className={`mt-1.5 text-xl font-medium tabular-nums tracking-tight ${title}`}>{devCount}</p>
      </div>
      <div className="px-5 py-3.5 sm:px-6">
        <p className={`text-[13px] ${muted}`}>CVE advisories</p>
        <p className={`mt-1.5 text-xl font-medium tabular-nums tracking-tight ${overviewMetricValueAccent(isDark, cveMetricLevel)}`}>
          {advisorySummary.total}
        </p>
        {advisorySummary.total > 0 ? (
          <p className={`mt-0.5 text-xs ${muted}`}>{advisorySummary.affectedPackages} packages</p>
        ) : dependencyRisk ? (
          <p className={`mt-0.5 text-xs ${muted}`}>None in scan</p>
        ) : (
          <p className={`mt-0.5 text-xs ${muted}`}>Not scanned</p>
        )}
      </div>
    </div>
  );

  const filterBar = (
    <div className={`border-b px-5 py-3 sm:px-6 ${border}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search name or version…"
            className={`w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none ${
              isDark
                ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
                : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400'
            }`}
          />
        </div>
        <div className={`flex flex-wrap items-center gap-1 border-t pt-3 lg:border-t-0 lg:pt-0 lg:pl-3 ${border}`}>
          {(
            [
              { id: 'all' as const, label: 'All', count: packages.length },
              { id: 'direct' as const, label: 'Prod', count: directCount },
              { id: 'dev' as const, label: 'Dev', count: devCount },
              { id: 'transitive' as const, label: 'Transitive', count: transitiveCount },
            ] as const
          ).map(tab => {
            const selected = typeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setTypeFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  selected
                    ? isDark
                      ? 'bg-white/[0.08] font-medium text-slate-100'
                      : 'bg-slate-100 font-medium text-slate-900'
                    : isDark
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label} <span className="tabular-nums opacity-70">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={`tabular-nums ${muted}`}>
          Showing {paginatedPackages.length} of {filteredPackages.length.toLocaleString()} · {inventory.ecosystem} ·{' '}
          {lockfileLabel}
        </span>
        {advisorySummary.total > 0 && onViewSecurityDetails ? (
          <button
            type="button"
            onClick={onViewSecurityDetails}
            className={
              isDark ? 'font-medium text-blue-400 hover:text-blue-300' : 'font-medium text-blue-600 hover:text-blue-800'
            }
          >
            Open supply chain in Quality
          </button>
        ) : !dependencyRisk && onViewSecurityDetails ? (
          <button
            type="button"
            onClick={onViewSecurityDetails}
            className={muted + ' hover:underline'}
          >
            Run CVE audit in Quality
          </button>
        ) : null}
      </div>
    </div>
  );

  const packageList = (
    <>
      <ul className={`max-h-[420px] overflow-y-auto divide-y ${divide}`}>
        {paginatedPackages.length > 0 ? (
          paginatedPackages.map(pkg => {
            const pkgAdvisory = advisoryByPackage.get(pkg.name);
            const rowClass = packageRowEmphasis(pkgAdvisory?.severity, isDark);
            const isNotable = NOTABLE_PACKAGES.has(pkg.name);

            const isCopied = copiedPkg === pkg.name;
            const showActions = isCopied ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible';

            return (
              <li
                key={`${pkg.name}@${pkg.version}`}
                className={`group relative py-2.5 pr-5 sm:pr-6 ${rowClass || 'pl-5 sm:pl-6'}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`truncate font-mono text-[13px] ${isNotable ? (isDark ? 'text-blue-400' : 'text-blue-700') : title}`}
                      title={pkg.name}
                    >
                      {pkg.name}
                    </span>
                    <span className={`shrink-0 font-mono text-xs tabular-nums ${muted}`}>v{pkg.version}</span>
                    {pkgAdvisory ? (
                      <span className={overviewSeverityLabel(isDark, pkgAdvisory.severity === 'critical' ? 'critical' : pkgAdvisory.severity === 'high' ? 'warning' : 'optimization')}>
                        {pkgAdvisory.count} CVE{pkgAdvisory.count === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-0.5 text-[11px] ${muted}`}>{classificationLabel(pkg, hasExplicitDirect)}</p>
                </div>
                <div
                  className={`absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5 transition-opacity sm:right-5 ${showActions} ${
                    isCopied ? 'pointer-events-auto' : 'pointer-events-none group-hover:pointer-events-auto'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => copySpecifier(pkg.name, pkg.version)}
                    className={
                      isDark
                        ? 'rounded p-0.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                        : 'rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }
                    title={`Copy ${pkg.name}@${pkg.version}`}
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={`https://www.npmjs.com/package/${pkg.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleExternalLinkClick}
                    className={`rounded p-0.5 ${isDark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-blue-400' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
                    title="View on npm"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            );
          })
        ) : (
          <li className={`px-5 py-12 text-center text-sm sm:px-6 ${muted}`}>No packages match your filters.</li>
        )}
      </ul>
      {totalPages > 1 ? (
        <div className={`flex items-center justify-between border-t px-5 py-2.5 text-xs sm:px-6 ${border}`}>
          <span className={muted}>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`rounded-md p-1 disabled:opacity-40 ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-100'}`}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`rounded-md p-1 disabled:opacity-40 ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-100'}`}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div>
        {metricsStrip}
        {filterBar}
        <div className="pt-1">{packageList}</div>
      </div>
    );
  }

  return (
    <section className={`overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`border-b px-5 py-4 sm:px-6 ${border}`}>
        <h2 className={`text-[15px] font-medium ${title}`}>Package inventory</h2>
        <p className={`mt-0.5 text-[13px] ${muted}`}>
          {inventory.ecosystem} · {inventory.declaredDependencies} declared in manifest
        </p>
      </header>
      {metricsStrip}
      {filterBar}
      <div className="pt-1">{packageList}</div>
    </section>
  );
});
