import React from 'react';
import { Flame, FileText, AlertTriangle, CheckCircle2, FileCode } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface CodebaseHotspotsPanelProps {
  analysis: CodebaseAnalysis;
}

export const CodebaseHotspotsPanel: React.FC<CodebaseHotspotsPanelProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';

  const quality = analysis.quality;
  const loc = quality?.linesOfCode || 0;
  const todoCount = quality?.todoMarkers || 0;

  // Derive estimated large/complex files from structure paths or analysis findings
  const highPriorityFindings = quality?.findings?.filter(f => f.location?.path) || [];
  const filesWithFindings = Array.from(
    new Set(highPriorityFindings.map(f => f.location!.path))
  ).slice(0, 5);

  return (
    <section className={`rounded-xl border p-4 ${panel}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-rose-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Codebase Complexity & Debt Hotspots
          </h2>
        </div>
        <span className={`text-[10px] font-medium ${muted}`}>
          Static maintainability signals
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Metric 1: Total Volume */}
        <div className={`p-3.5 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Estimated Volume</p>
          <p className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {loc > 0 ? `${loc.toLocaleString()} LOC` : `${analysis.sourceFiles} files`}
          </p>
          <p className={`text-[10px] mt-0.5 ${muted}`}>
            Across {quality?.analyzedSourceFiles || analysis.sourceFiles} analyzed source files
          </p>
        </div>

        {/* Metric 2: Debt Markers */}
        <div className={`p-3.5 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Debt Markers</p>
          <p className={`text-xl font-semibold mt-1 ${
            todoCount > 20 ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-950')
          }`}>
            {todoCount.toLocaleString()} markers
          </p>
          <p className={`text-[10px] mt-0.5 ${muted}`}>
            TODO, FIXME, and HACK annotations
          </p>
        </div>

        {/* Metric 3: Deep AST Coverage */}
        <div className={`p-3.5 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Deep AST Review</p>
          <p className={`text-xl font-semibold mt-1 text-emerald-500`}>
            {quality?.deepAnalysis?.parsedJavaScriptFiles || quality?.analyzedSourceFiles || 0} parsed
          </p>
          <p className={`text-[10px] mt-0.5 ${muted}`}>
            Syntax, imports & complexity verified
          </p>
        </div>
      </div>

      {/* Files with Attention Signals */}
      {filesWithFindings.length > 0 && (
        <div className="mt-3">
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${muted}`}>
            Files With Flagged Quality Signals
          </p>
          <div className="space-y-1.5">
            {filesWithFindings.map(path => {
              const fileFindings = highPriorityFindings.filter(f => f.location?.path === path);
              return (
                <div
                  key={path}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                    isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="font-mono text-[11px] truncate" title={path}>
                      {path}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                      fileFindings.some(f => f.priority === 'high')
                        ? (isDark ? 'bg-rose-400/10 text-rose-300' : 'bg-rose-50 text-rose-700')
                        : (isDark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-50 text-amber-700')
                    }`}>
                      {fileFindings.length} {fileFindings.length === 1 ? 'signal' : 'signals'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
