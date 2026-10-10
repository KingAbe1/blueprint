import React from 'react';
import { CheckCircle2, FileCode2, TestTube2, AlertTriangle, ArrowRight, Terminal } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface StartupAndTestsPanelProps {
  analysis: CodebaseAnalysis;
}

export const StartupAndTestsPanel: React.FC<StartupAndTestsPanelProps> = React.memo(({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const hasTests = Boolean(analysis.testFilesCount && analysis.testFilesCount > 0);

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <TestTube2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Runtime Entry Points & Automated Tests
            </h2>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-mono border ${
          isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          {analysis.entryPoints.length} entry {analysis.entryPoints.length === 1 ? 'point' : 'points'} · {analysis.testFilesCount || 0} test files
        </span>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* Likely Entry Points */}
        <div className={`min-w-0 rounded-xl border p-4 flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <FileCode2 className="h-3.5 w-3.5 text-blue-500" />
                <h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  Application Entry Points
                </h3>
              </div>
              {analysis.entryPoints.length > 0 && (
                <span className={`text-[10px] font-mono ${muted}`}>
                  {analysis.entryPoints.length} found
                </span>
              )}
            </div>

            {analysis.entryPoints.length > 0 ? (
              <ul className="space-y-1.5">
                {analysis.entryPoints.slice(0, 5).map(path => (
                  <li
                    key={path}
                    className={`truncate rounded-lg px-3 py-2 font-mono text-[11px] border ${
                      isDark ? 'border-white/[0.05] bg-black/25 text-blue-300' : 'border-slate-200/60 bg-white text-blue-700'
                    }`}
                    title={path}
                  >
                    {path}
                  </li>
                ))}
                {analysis.entryPoints.length > 5 && (
                  <li className={`px-2 text-[10px] ${muted}`}>
                    +{analysis.entryPoints.length - 5} more entry points
                  </li>
                )}
              </ul>
            ) : (
              <p className={`rounded-lg p-3 text-[11px] border ${isDark ? 'border-white/[0.04] bg-black/20 text-slate-400' : 'border-slate-200/60 bg-white text-slate-500'}`}>
                No common application entry files were identified in this scan.
              </p>
            )}
          </div>
        </div>

        {/* Test Coverage Signals */}
        <div className={`min-w-0 rounded-xl border p-4 flex flex-col justify-between ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className={`h-3.5 w-3.5 ${hasTests ? 'text-emerald-500' : 'text-amber-500'}`} />
                <h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  Test Coverage Signals
                </h3>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold border ${
                hasTests
                  ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                  : (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700')
              }`}>
                {hasTests ? `${analysis.testFilesCount} files` : 'None detected'}
              </span>
            </div>

            {analysis.testSignals.length > 0 ? (
              <ul className="space-y-1.5">
                {analysis.testSignals.slice(0, 4).map(signal => (
                  <li
                    key={signal}
                    className={`truncate rounded-lg px-3 py-2 font-mono text-[11px] border ${
                      isDark ? 'border-white/[0.05] bg-black/25 text-slate-200' : 'border-slate-200/60 bg-white text-slate-700'
                    }`}
                    title={signal}
                  >
                    {signal}
                  </li>
                ))}
                {analysis.testSignals.length > 4 && (
                  <li className={`px-2 text-[10px] ${muted}`}>
                    +{analysis.testSignals.length - 4} more signals
                  </li>
                )}
              </ul>
            ) : (
              <div className={`rounded-lg p-3 text-[11px] border space-y-1.5 ${
                isDark ? 'border-white/[0.04] bg-black/20 text-slate-400' : 'border-slate-200/60 bg-white text-slate-600'
              }`}>
                <p>No automated test suites or test runner configuration files were detected.</p>
                <div className={`mt-2 p-2 rounded border font-mono text-[10px] flex items-center justify-between ${
                  isDark ? 'border-white/[0.06] bg-black/30 text-amber-300' : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}>
                  <span className="flex items-center gap-1.5 truncate">
                    <Terminal className="h-3 w-3 shrink-0 text-amber-500" />
                    npm i -D vitest @testing-library/react
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
