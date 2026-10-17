import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { DependencyInventory, DependencyRiskAssessment, DependencySeverity, LockedDependency } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface DependencyInventoryPanelProps {
  inventory?: DependencyInventory;
  dependencyRisk?: DependencyRiskAssessment;
  onViewSecurityDetails?: () => void;
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

// Highlight recognizable ecosystem packages
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

export const DependencyInventoryPanel: React.FC<DependencyInventoryPanelProps> = React.memo(({
  inventory,
  dependencyRisk,
  onViewSecurityDetails,
}) => {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'dev' | 'transitive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

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
      scannedAt: dependencyRisk?.scannedAt,
      packagesChecked: dependencyRisk?.packagesChecked,
      incomplete: dependencyRisk?.incomplete,
    };
  }, [dependencyRisk, advisoryByPackage.size]);

  // Determine prod count: if explicit direct exists, use pkg.direct && !pkg.development, else fallback to !pkg.development
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
      const isProd = hasExplicitDirect ? (pkg.direct && !pkg.development) : !pkg.development;
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const paginatedPackages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPackages.slice(start, start + PAGE_SIZE);
  }, [filteredPackages, currentPage]);

  const handleFilterChange = (filter: typeof typeFilter) => {
    setTypeFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

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

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20">
            <Package className="h-3.5 w-3.5" />
          </div>
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Dependency & Package Inventory
          </h2>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono border ${
            isDark ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-violet-200 bg-violet-50 text-violet-700'
          }`}>
            {inventory.ecosystem} ({inventory.lockfiles[0] ? inventory.lockfiles[0].split('/').pop() : 'locked'})
          </span>
        </div>
        <span className={`text-[11px] font-mono ${muted}`}>
          {packages.length.toLocaleString()} locked · {inventory.declaredDependencies} declared
        </span>
      </div>

      {dependencyRisk ? (
        advisorySummary.total > 0 ? (
          <div
            className={`mb-3.5 flex flex-col gap-2.5 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between ${
              isDark ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-rose-200 bg-rose-50/80'
            }`}
          >
            <div className="flex gap-2.5 min-w-0">
              <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${isDark ? 'text-rose-300' : 'text-rose-600'}`} />
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${isDark ? 'text-rose-100' : 'text-rose-900'}`}>
                  {advisorySummary.total} CVE advisories across {advisorySummary.affectedPackages} locked packages
                </p>
                <p className={`mt-0.5 text-[11px] leading-relaxed ${isDark ? 'text-rose-200/80' : 'text-rose-800/90'}`}>
                  {[
                    advisorySummary.counts.critical ? `${advisorySummary.counts.critical} critical` : null,
                    advisorySummary.counts.high ? `${advisorySummary.counts.high} high` : null,
                    advisorySummary.counts.medium ? `${advisorySummary.counts.medium} medium` : null,
                  ].filter(Boolean).join(' · ') || 'Review OSV matches below'}
                  {advisorySummary.packagesChecked
                    ? ` · Checked ${advisorySummary.packagesChecked} packages (OSV.dev)`
                    : ''}
                </p>
              </div>
            </div>
            {onViewSecurityDetails ? (
              <button
                type="button"
                onClick={onViewSecurityDetails}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  isDark
                    ? 'border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
                    : 'border-rose-300 bg-white text-rose-800 hover:bg-rose-100'
                }`}
              >
                Full report in Quality & Risks
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : (
          <div
            className={`mb-3.5 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] ${
              isDark ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            No known CVE advisories from OSV for locked packages in this scan.
          </div>
        )
      ) : (
        <div
          className={`mb-3.5 flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
            isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          <p className={`text-[11px] leading-relaxed ${muted}`}>
            Supply-chain CVE scan has not run yet for this project. Rescan or open Quality & Risks to fetch OSV advisories.
          </p>
          {onViewSecurityDetails ? (
            <button
              type="button"
              onClick={onViewSecurityDetails}
              className="btn-secondary-accent inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
            >
              Open Quality & Risks
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between mb-3.5">
        {/* Segmented Filter Buttons */}
        <div className={`flex flex-wrap gap-1 p-0.5 rounded-lg border ${
          isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-100/80'
        }`}>
          {[
            { id: 'all', label: `All (${packages.length})` },
            { id: 'direct', label: `Prod (${directCount})` },
            { id: 'dev', label: `Dev (${devCount})` },
            { id: 'transitive', label: `Transitive (${transitiveCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFilterChange(tab.id as typeof typeFilter)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                typeFilter === tab.id
                  ? (isDark ? 'bg-[#1E2024] text-white shadow-xs border border-white/[0.08]' : 'bg-white text-slate-900 shadow-xs border border-slate-200/80')
                  : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px] sm:w-64">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${muted}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search package or version…"
            className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none transition-colors ${
              isDark
                ? 'border-white/[0.08] bg-black/20 text-white placeholder:text-slate-600 focus:border-blue-500'
                : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
            }`}
          />
        </div>
      </div>

      {/* Desktop Package Table with Sticky Column Header */}
      <div className={`rounded-lg border overflow-hidden ${
        isDark ? 'border-white/[0.07] bg-black/20' : 'border-slate-200 bg-white'
      }`}>
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider border-b select-none ${
          isDark ? 'border-white/[0.06] bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}>
          <div className="col-span-6">Package Name</div>
          <div className="col-span-3">Resolved Version</div>
          <div className="col-span-2">Classification</div>
          <div className="col-span-1 text-right">Links</div>
        </div>

        {/* Table Body */}
        <div className={`max-h-[440px] overflow-y-auto divide-y ${
          isDark ? 'divide-white/[0.04]' : 'divide-slate-100'
        }`}>
          {paginatedPackages.length > 0 ? (
            paginatedPackages.map(pkg => {
              const isNotable = NOTABLE_PACKAGES.has(pkg.name);
              const isProd = hasExplicitDirect ? (pkg.direct && !pkg.development) : !pkg.development;
              const isDev = pkg.development;
              const pkgAdvisory = advisoryByPackage.get(pkg.name);

              return (
                <div
                  key={`${pkg.name}@${pkg.version}`}
                  className={`group grid grid-cols-12 gap-3 items-center px-3.5 py-2 text-xs transition-colors ${
                    pkgAdvisory
                      ? isDark ? 'bg-rose-500/[0.04] hover:bg-rose-500/[0.07]' : 'bg-rose-50/50 hover:bg-rose-50'
                      : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Col 1: Package Name */}
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <span
                      className={`font-mono text-[11px] font-semibold truncate ${
                        isNotable
                          ? 'text-blue-400'
                          : isDark
                          ? 'text-slate-200'
                          : 'text-slate-800'
                      }`}
                      title={pkg.name}
                    >
                      {pkg.name}
                    </span>
                    {pkgAdvisory ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[8px] font-semibold px-1 py-0.5 rounded border ${
                          pkgAdvisory.severity === 'critical' || pkgAdvisory.severity === 'high'
                            ? isDark ? 'border-rose-500/40 bg-rose-500/15 text-rose-200' : 'border-rose-300 bg-rose-100 text-rose-800'
                            : isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                        title={`${pkgAdvisory.count} OSV advisories`}
                      >
                        <ShieldAlert className="h-2.5 w-2.5" />
                        CVE
                      </span>
                    ) : null}
                    {isNotable && (
                      <span className={`text-[8px] font-semibold px-1 py-0.2 rounded ${
                        isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                      }`}>
                        Core
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => copySpecifier(pkg.name, pkg.version)}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ${muted} hover:text-blue-500`}
                      title={`Copy ${pkg.name}@${pkg.version}`}
                    >
                      {copiedPkg === pkg.name ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  {/* Col 2: Version */}
                  <div className="col-span-3">
                    <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-white/[0.04] text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      v{pkg.version}
                    </span>
                  </div>

                  {/* Col 3: Classification */}
                  <div className="col-span-2">
                    {isProd ? (
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                        isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        Prod
                      </span>
                    ) : isDev ? (
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                        isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        Dev
                      </span>
                    ) : (
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-medium uppercase ${
                        isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        Transitive
                      </span>
                    )}
                  </div>

                  {/* Col 4: Links */}
                  <div className="col-span-1 text-right">
                    <a
                      href={`https://www.npmjs.com/package/${pkg.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-block p-1 rounded transition-colors ${muted} hover:text-blue-500`}
                      title={`View ${pkg.name} on npm`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <p className={`text-xs ${muted}`}>No packages match your search or filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className={`text-[11px] ${muted}`}>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredPackages.length)} of {filteredPackages.length.toLocaleString()} packages
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1 rounded-md border disabled:opacity-40 transition-colors ${
                isDark ? 'border-white/[0.08] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className={`px-2 font-mono text-[11px] ${muted}`}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-1 rounded-md border disabled:opacity-40 transition-colors ${
                isDark ? 'border-white/[0.08] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
