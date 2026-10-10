import React from 'react';
import { CheckCircle2, FileCode2 } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface StartupAndTestsPanelProps { analysis: CodebaseAnalysis; }

export const StartupAndTestsPanel: React.FC<StartupAndTestsPanelProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return <section className={`rounded-xl border p-4 ${isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <div>
          <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Startup and tests</h2>
          <p className={`mt-0.5 text-[10px] ${muted}`}>Where the app starts and what test coverage the scan found.</p>
        </div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
        {analysis.entryPoints.length} entry {analysis.entryPoints.length === 1 ? 'point' : 'points'} · {analysis.testFilesCount || 0} test files
      </span>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className={`min-w-0 rounded-xl border p-4 ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200 bg-slate-50/70'}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5 text-blue-500" /><h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Likely entry points</h3></div>
          {analysis.entryPoints.length > 0 && <span className={`text-[10px] ${muted}`}>{analysis.entryPoints.length} found</span>}
        </div>
        {analysis.entryPoints.length > 0 ? <ul className="space-y-1.5">
          {analysis.entryPoints.slice(0, 5).map(path => <li key={path} className={`truncate rounded-lg px-2.5 py-2 font-mono text-[10px] ${isDark ? 'bg-black/20 text-slate-200' : 'bg-white text-slate-700'}`} title={path}>{path}</li>)}
          {analysis.entryPoints.length > 5 && <li className={`px-2 text-[10px] ${muted}`}>+{analysis.entryPoints.length - 5} more entry points</li>}
        </ul> : <p className={`rounded-lg px-3 py-3 text-[11px] ${isDark ? 'bg-black/20 text-slate-400' : 'bg-white text-slate-500'}`}>No common application entry files were identified in this scan.</p>}
      </div>
      <div className={`min-w-0 rounded-xl border p-4 ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200 bg-slate-50/70'}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><CheckCircle2 className={`h-3.5 w-3.5 ${analysis.testFilesCount ? 'text-emerald-500' : 'text-slate-400'}`} /><h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Test coverage signals</h3></div>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${analysis.testFilesCount ? (isDark ? 'bg-emerald-400/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
            {analysis.testFilesCount ? `${analysis.testFilesCount} files` : analysis.testSignals.length ? 'Config found' : 'None found'}
          </span>
        </div>
        {analysis.testSignals.length > 0 ? <ul className="space-y-1.5">
          {analysis.testSignals.slice(0, 4).map(signal => <li key={signal} className={`truncate rounded-lg px-2.5 py-2 font-mono text-[10px] ${isDark ? 'bg-black/20 text-slate-200' : 'bg-white text-slate-700'}`} title={signal}>{signal}</li>)}
          {analysis.testSignals.length > 4 && <li className={`px-2 text-[10px] ${muted}`}>+{analysis.testSignals.length - 4} more signals</li>}
        </ul> : <p className={`rounded-lg px-3 py-3 text-[11px] ${isDark ? 'bg-black/20 text-slate-400' : 'bg-white text-slate-500'}`}>No common test files or test configuration were found in the scanned paths.</p>}
      </div>
    </div>
  </section>;
};
