import React, { useState, useMemo } from 'react';
import { Package, Search, ExternalLink, Copy, Check } from 'lucide-react';
import { DependencyInventory } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface DependencyInventoryPanelProps {
  inventory?: DependencyInventory;
}

export const DependencyInventoryPanel: React.FC<DependencyInventoryPanelProps> = ({ inventory }) => {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'dev' | 'transitive'>('all');
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const packages = inventory?.packages || [];

  const directCount = useMemo(() => packages.filter(p => p.direct && !p.development).length, [packages]);
  const devCount = useMemo(() => packages.filter(p => p.development).length, [packages]);
  const transitiveCount = useMemo(() => packages.filter(p => !p.direct && !p.development).length, [packages]);

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      if (typeFilter === 'direct' && (!pkg.direct || pkg.development)) return false;
      if (typeFilter === 'dev' && !pkg.development) return false;
      if (typeFilter === 'transitive' && (pkg.direct || pkg.development)) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return pkg.name.toLowerCase().includes(query) || pkg.version.toLowerCase().includes(query);
      }

      return true;
    });
  }, [packages, typeFilter, searchQuery]);

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
    <section className={`rounded-xl border p-4 ${panel}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-500" />
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
            Dependency & Package Inventory
          </h2>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono ${
            isDark ? 'bg-violet-400/10 text-violet-300' : 'bg-violet-50 text-violet-700'
          }`}>
            {inventory.ecosystem} ({inventory.lockfiles[0] ? inventory.lockfiles[0].split('/').pop() : 'locked'})
          </span>
        </div>
        <span className={`text-[11px] ${muted}`}>
          {packages.length.toLocaleString()} locked · {inventory.declaredDependencies} declared
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between mb-3">
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
              onClick={() => setTypeFilter(tab.id as typeof typeFilter)}
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
        <div className="relative min-w-[200px] sm:w-60">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${muted}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search package name or version…"
            className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none transition-colors ${
              isDark
                ? 'border-white/[0.08] bg-black/20 text-white placeholder:text-slate-600 focus:border-blue-500'
                : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
            }`}
          />
        </div>
      </div>

      {/* Desktop Package Table List */}
      <div className={`max-h-[460px] overflow-y-auto rounded-lg border ${
        isDark ? 'border-white/[0.06] bg-black/20 divide-y divide-white/[0.04]' : 'border-slate-200 bg-slate-50/50 divide-y divide-slate-200/60'
      }`}>
        {filteredPackages.length > 0 ? (
          filteredPackages.slice(0, 150).map(pkg => {
            const isProd = pkg.direct && !pkg.development;
            const isDev = pkg.development;

            return (
              <div
                key={`${pkg.name}@${pkg.version}`}
                className={`group flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors ${
                  isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-white'
                }`}
              >
                {/* Package Name & Copy Specifier */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`font-mono text-[11px] font-semibold truncate ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                    title={pkg.name}
                  >
                    {pkg.name}
                  </span>
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

                {/* Version and Tag Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-mono text-[11px] ${muted}`}>
                    v{pkg.version}
                  </span>

                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                      isProd
                        ? isDark
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-blue-50 text-blue-700'
                        : isDev
                        ? isDark
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-amber-50 text-amber-700'
                        : isDark
                        ? 'bg-white/[0.04] text-slate-400'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {isProd ? 'prod' : isDev ? 'dev' : 'transitive'}
                  </span>

                  <a
                    href={`https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}/v/${pkg.version}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ${muted} hover:text-blue-500`}
                    title="View on npm"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">
            No packages matching "{searchQuery}"
          </div>
        )}
      </div>

      {filteredPackages.length > 150 && (
        <p className={`mt-2 text-right text-[10px] ${muted}`}>
          Showing 150 of {filteredPackages.length} filtered packages
        </p>
      )}
    </section>
  );
};
