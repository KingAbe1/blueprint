import React, { useState } from 'react';
import {
  Layers,
  Server,
  Smartphone,
  Sparkles,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  FileCode,
  FolderTree,
  Code2,
  Boxes,
  Zap,
  Activity,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { NextJsSpecialization } from '../../types/framework';

interface NextJsSpecializationPanelProps {
  specialization: NextJsSpecialization;
  rootName: string;
}

export const NextJsSpecializationPanel: React.FC<NextJsSpecializationPanelProps> = ({
  specialization,
  rootName,
}) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  const [expandedActionIndex, setExpandedActionIndex] = useState<number | null>(null);
  const [showClientFiles, setShowClientFiles] = useState(false);

  const {
    router,
    componentDistribution,
    serverActions,
    boundaryHealth,
    modernization,
    routeGroups,
    parallelRoutes,
    dynamicRoutesCount,
  } = specialization;

  const versionLabel = modernization.version ? `Next.js ${modernization.version}` : 'Next.js App Router';

  return (
    <section className={`rounded-2xl border transition-all overflow-hidden ${
      isDark
        ? 'border-white/[0.08] bg-gradient-to-b from-[#141619] to-[#0F1013] shadow-xl'
        : 'border-slate-200/90 bg-white shadow-xs'
    }`}>
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER: Specialized Framework Identity           */}
      {/* ---------------------------------------------------- */}
      <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        isDark ? 'border-white/[0.06] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/60'
      }`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white border border-white/20 shadow-md">
            {/* Next.js N Logo mark */}
            <svg className="h-5 w-5" viewBox="0 0 180 180" fill="none">
              <mask id="mask0_next" maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180" style={{ maskType: 'alpha' }}>
                <circle cx="90" cy="90" r="90" fill="black" />
              </mask>
              <g mask="url(#mask0_next)">
                <circle cx="90" cy="90" r="90" fill="black" />
                <path
                  d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z"
                  fill="url(#paint0_linear_next)"
                />
                <rect x="115" y="54" width="12" height="72" fill="url(#paint1_linear_next)" />
              </g>
              <defs>
                <linearGradient id="paint0_linear_next" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white" />
                  <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="paint1_linear_next" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white" />
                  <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Next.js Architecture & Boundary Console
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${
                isDark ? 'border-white/[0.08] bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}>
                {versionLabel}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                router === 'App Router'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : router === 'Both routers'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
              }`}>
                {router}
              </span>
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>
              Deep component isolation, server mutations, and resilience boundaries for {rootName}.
            </p>
          </div>
        </div>

        {/* Quick Route Topology Badges */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className={`px-2 py-1 rounded-lg border ${
            isDark ? 'border-white/[0.06] bg-black/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}>
            {routeGroups.length} Route Groups
          </span>
          <span className={`px-2 py-1 rounded-lg border ${
            isDark ? 'border-white/[0.06] bg-black/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}>
            {dynamicRoutesCount} Dynamic Segments
          </span>
          {parallelRoutes.length > 0 && (
            <span className={`px-2 py-1 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300`}>
              {parallelRoutes.length} Parallel Slots
            </span>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4 CORE SPECIALIZATION TILES GRID                     */}
      {/* ---------------------------------------------------- */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Server vs. Client Component Distribution */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <Server className="h-3.5 w-3.5 text-emerald-400" />
                <span>Component Boundary</span>
              </span>
              <span className="font-mono text-[10px] text-emerald-400 font-bold">
                {componentDistribution.serverRatio}% Server
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${componentDistribution.serverRatio}%` }}
                title={`Server Components: ${componentDistribution.serverComponentsCount}`}
              />
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${componentDistribution.clientRatio}%` }}
                title={`Client Components: ${componentDistribution.clientComponentsCount}`}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {componentDistribution.serverComponentsCount} Server
              </span>
              <span className="text-cyan-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                {componentDistribution.clientComponentsCount} Client ('use client')
              </span>
            </div>

            <p className={`mt-2.5 text-[11px] leading-relaxed ${muted}`}>
              {componentDistribution.serverRatio >= 70
                ? 'Server-first architecture minimizes client bundle footprint and execution overhead.'
                : 'Elevated client component proportion. Consider moving non-interactive UI into Server Components.'}
            </p>
          </div>

          {componentDistribution.clientComponentsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowClientFiles(!showClientFiles)}
              className={`mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono transition-colors ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{showClientFiles ? 'Hide client components' : `View ${componentDistribution.clientComponentsCount} client files`}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showClientFiles ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* 2. Server Actions & Mutation Engine */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Server Actions ('use server')</span>
              </span>
              <span className="font-mono text-[10px] text-amber-400 font-bold">
                {serverActions.totalActionsCount} Mutations
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-white">
                {serverActions.actionFilesCount}
              </span>
              <span className={`text-xs ${muted}`}>action modules detected</span>
            </div>

            <p className={`mt-2 text-[11px] leading-relaxed ${muted}`}>
              {serverActions.totalActionsCount > 0
                ? `${serverActions.totalActionsCount} server actions handle state mutations, form submissions, and database operations.`
                : 'No dedicated action handlers detected. Mutations may be handled via Route Handlers (app/api/**).'}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>app/actions/**</span>
            <span className="text-amber-400">{serverActions.totalActionsCount} exported routines</span>
          </div>
        </div>

        {/* 3. App Router Resilience & Error Boundaries */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <Boxes className="h-3.5 w-3.5 text-blue-400" />
                <span>Boundary Resilience</span>
              </span>
              <span className={`font-mono text-[10px] font-bold ${
                boundaryHealth.hasRootLayout && boundaryHealth.loadingCount > 0
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}>
                {boundaryHealth.layoutCount + boundaryHealth.loadingCount + boundaryHealth.errorCount} Boundaries
              </span>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300">Root Layout</span>
                <span className={`font-mono text-[10px] flex items-center gap-1 ${
                  boundaryHealth.hasRootLayout ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {boundaryHealth.hasRootLayout ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {boundaryHealth.hasRootLayout ? 'Present' : 'Missing'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300">Loading Skeletons</span>
                <span className={`font-mono text-[10px] flex items-center gap-1 ${
                  boundaryHealth.loadingCount > 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {boundaryHealth.loadingCount > 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {boundaryHealth.loadingCount} files
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300">Error Boundaries</span>
                <span className={`font-mono text-[10px] flex items-center gap-1 ${
                  boundaryHealth.errorCount > 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {boundaryHealth.errorCount > 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {boundaryHealth.errorCount} files
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Not-Found Handlers</span>
            <span className={boundaryHealth.notFoundCount > 0 ? 'text-emerald-400' : 'text-slate-400'}>
              {boundaryHealth.notFoundCount} detected
            </span>
          </div>
        </div>

        {/* 4. Modernization & Migration Posture */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span>Next Modernization</span>
              </span>
              <span className="font-mono text-[10px] text-violet-400 font-bold">
                {modernization.majorVersion ? `v${modernization.majorVersion}` : 'Release'}
              </span>
            </div>

            <div className="space-y-1.5 mt-2">
              {modernization.recommendations.slice(0, 2).map((rec, rIdx) => (
                <div key={rIdx} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <p className={`text-[10px] font-semibold truncate ${
                    rec.severity === 'action-required' ? 'text-rose-400' : rec.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                  }`}>
                    {rec.title}
                  </p>
                  <p className="text-[9px] text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                    {rec.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Migration Health</span>
            <span className={modernization.recommendations.some(r => r.severity === 'action-required') ? 'text-rose-400' : 'text-emerald-400'}>
              {modernization.recommendations.length} items flagged
            </span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* EXPANDABLE CLIENT COMPONENT FILES LIST               */}
      {/* ---------------------------------------------------- */}
      {showClientFiles && componentDistribution.clientComponentFiles.length > 0 && (
        <div className={`mx-5 mb-5 p-4 rounded-xl border ${
          isDark ? 'border-cyan-500/20 bg-cyan-500/[0.03]' : 'border-cyan-200 bg-cyan-50/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Client Component Manifest ('use client')</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {componentDistribution.clientComponentFiles.length} files evaluated
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
            {componentDistribution.clientComponentFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-black/20 border border-white/[0.04] text-slate-300">
                <span className="text-cyan-400">•</span>
                <span className="truncate">{file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SERVER ACTIONS INVENTORY EXPANSION                   */}
      {/* ---------------------------------------------------- */}
      {serverActions.actionFiles.length > 0 && (
        <div className={`px-5 pb-5`}>
          <div className={`p-4 rounded-xl border ${
            isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200 bg-white'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-semibold tracking-wide text-white">
                  Server Actions & Mutation Handlers ({serverActions.actionFiles.length} Modules)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                app/actions/** · Type-safe server execution
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {serverActions.actionFiles.map((file, idx) => {
                const isExpanded = expandedActionIndex === idx;
                const fileName = file.path.split('/').pop() || file.path;

                return (
                  <div
                    key={file.path}
                    className={`p-3 rounded-lg border transition-all ${
                      isDark ? 'border-white/[0.05] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-white block truncate">
                          {fileName}
                        </span>
                        <span className={`text-[10px] font-mono block truncate ${muted}`}>
                          {file.path}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold shrink-0">
                        {file.exportedActions.length} actions
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {file.exportedActions.slice(0, 3).map(action => (
                        <span
                          key={action}
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/30 border border-white/[0.06] text-slate-300"
                        >
                          {action}()
                        </span>
                      ))}
                      {file.exportedActions.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setExpandedActionIndex(isExpanded ? null : idx)}
                          className="text-[9px] font-mono text-amber-400 hover:underline"
                        >
                          +{file.exportedActions.length - 3} more
                        </button>
                      )}
                    </div>

                    {isExpanded && file.exportedActions.length > 3 && (
                      <div className="mt-2 pt-2 border-t border-white/[0.06] flex flex-wrap gap-1">
                        {file.exportedActions.slice(3).map(action => (
                          <span
                            key={action}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-white/[0.06] text-slate-400"
                          >
                            {action}()
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
