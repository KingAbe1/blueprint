import React, { useState } from 'react';
import {
  Flame,
  FileText,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface CodebaseHotspotsPanelProps {
  analysis: CodebaseAnalysis;
}

export const CodebaseHotspotsPanel: React.FC<CodebaseHotspotsPanelProps> = React.memo(({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const quality = analysis.quality;
  const loc = quality?.linesOfCode || 0;
  const todoCount = quality?.todoMarkers || 0;

  // Derive estimated large/complex files from structure paths or analysis findings
  const highPriorityFindings = quality?.findings?.filter(f => f.location?.path) || [];
  const filesWithFindings = Array.from(
    new Set(highPriorityFindings.map(f => f.location!.path))
  ).slice(0, 8);

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/20">
            <Flame className="h-3.5 w-3.5" />
          </div>
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Codebase Complexity & Debt Hotspots
          </h2>
        </div>
        <span className={`text-[10px] font-mono ${muted}`}>
          Static maintainability signals
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Metric 1: Total Volume */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Estimated Volume</p>
          <div className="mt-2">
            <p className={`text-xl font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
              {loc > 0 ? `${loc.toLocaleString()} LOC` : `${analysis.sourceFiles} files`}
            </p>
            <p className={`text-[10px] mt-0.5 ${muted}`}>
              Across {quality?.analyzedSourceFiles || analysis.sourceFiles} analyzed source files
            </p>
          </div>
        </div>

        {/* Metric 2: Debt Markers */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Debt Markers</p>
          <div className="mt-2">
            <p className={`text-xl font-bold leading-tight ${
              todoCount > 20 ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-950')
            }`}>
              {todoCount.toLocaleString()} markers
            </p>
            <p className={`text-[10px] mt-0.5 ${muted}`}>
              TODO, FIXME, and HACK annotations
            </p>
          </div>
        </div>

        {/* Metric 3: Deep AST Coverage */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Deep AST Review</p>
          <div className="mt-2">
            <p className="text-xl font-bold leading-tight text-emerald-500">
              {quality?.deepAnalysis?.parsedJavaScriptFiles || quality?.analyzedSourceFiles || 0} parsed
            </p>
            <p className={`text-[10px] mt-0.5 ${muted}`}>
              Syntax, imports & complexity verified
            </p>
          </div>
        </div>
      </div>

      {/* Files with Attention Signals */}
      {filesWithFindings.length > 0 && (
        <div className="mt-4">
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2.5 ${muted}`}>
            Files With Flagged Quality Signals (Click to Inspect)
          </p>
          <div className="space-y-2">
            {filesWithFindings.map(path => {
              const fileFindings = highPriorityFindings.filter(f => f.location?.path === path);
              const isExpanded = expandedFile === path;
              const hasHigh = fileFindings.some(f => f.priority === 'high');

              return (
                <div
                  key={path}
                  className={`rounded-xl border transition-all ${
                    isExpanded
                      ? (isDark ? 'border-blue-500/40 bg-blue-500/5' : 'border-blue-300 bg-blue-50/50')
                      : (isDark ? 'border-white/[0.06] bg-black/20 hover:border-white/[0.12]' : 'border-slate-200 bg-white hover:border-slate-300')
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFile(isExpanded ? null : path)}
                    className="w-full flex items-center justify-between p-3 text-xs text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                      <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="font-mono text-[11px] font-semibold truncate" title={path}>
                        {path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        hasHigh
                          ? (isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-700')
                          : (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700')
                      }`}>
                        {fileFindings.length} {fileFindings.length === 1 ? 'signal' : 'signals'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={`px-3 pb-3 pt-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200/70'} space-y-2`}>
                      {fileFindings.map((f, i) => (
                        <div
                          key={i}
                          className={`p-2.5 rounded-lg border text-xs ${
                            isDark ? 'border-white/[0.05] bg-black/40' : 'border-slate-200/80 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs">{f.title}</span>
                            <span className={`text-[8px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                              f.priority === 'high' ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10'
                            }`}>
                              {f.priority}
                            </span>
                          </div>
                          <p className={`mt-1 text-[11px] leading-relaxed ${muted}`}>{f.detail}</p>
                          {f.location?.line && (
                            <span className="mt-1.5 inline-block font-mono text-[9px] text-blue-400">
                              Line {f.location.line}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
});
