import React from 'react';
import {
  Layers,
  FileCode2,
  GitBranch,
  ShieldCheck,
  Cpu,
  Database,
  Flame,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface CodebaseHeroPulseProps {
  analysis: CodebaseAnalysis;
}

export const CodebaseHeroPulse: React.FC<CodebaseHeroPulseProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark
    ? 'bg-[#141518] border-white/[0.08] hover:border-white/[0.12]'
    : 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300';

  // Smart deduplication for stack badges
  const frameworks = (analysis.frameworks || []).filter(f => {
    if (analysis.nextjs && f.toLowerCase().includes('next')) return false;
    return true;
  });

  const primaryTech = [
    analysis.nextjs ? `Next.js ${analysis.nextjs.version || ''}`.trim() : null,
    frameworks[0] || null,
    analysis.languages[0]?.name || null,
    analysis.architecture?.database.name && analysis.architecture.database.name !== 'Not assessed'
      ? analysis.architecture.database.name
      : null,
  ].filter((item, index, self): item is string => Boolean(item) && self.indexOf(item) === index);

  const loc = analysis.quality?.linesOfCode;
  const healthScore = analysis.quality?.score;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* 1. Primary Stack */}
      <div className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${cardBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 text-violet-500">
              <Layers className="h-3 w-3" />
            </div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Primary Stack</p>
          </div>
          <span className="flex h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {primaryTech.length > 0 ? (
            primaryTech.slice(0, 3).map(tech => (
              <span
                key={tech}
                className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {tech}
              </span>
            ))
          ) : (
            <span className={`text-[11px] ${muted}`}>General Project</span>
          )}
        </div>
      </div>

      {/* 2. Codebase Volume */}
      <div className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${cardBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
              <FileCode2 className="h-3 w-3" />
            </div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Codebase Scale</p>
          </div>
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
        </div>
        <div className="mt-2.5">
          <p className={`text-base font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {loc ? `${(loc / 1000).toFixed(1)}k LOC` : `${analysis.sourceFiles} files`}
          </p>
          <p className={`mt-0.5 text-[10px] ${muted}`}>
            {analysis.sourceFiles} source · {analysis.filesScanned} total files
          </p>
        </div>
      </div>

      {/* 3. Git State */}
      <div className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${cardBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <GitBranch className="h-3 w-3" />
            </div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Git Repository</p>
          </div>
          <span className={`flex h-1.5 w-1.5 rounded-full ${
            analysis.git?.tracked ? 'bg-emerald-500' : 'bg-slate-400'
          }`} />
        </div>
        <div className="mt-2.5 min-w-0">
          <p className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {analysis.git?.tracked ? analysis.git.branch || 'main' : 'Unversioned'}
          </p>
          <p className={`mt-0.5 truncate text-[10px] ${muted}`}>
            {analysis.git?.changedFiles
              ? `${analysis.git.changedFiles} uncommitted changes`
              : analysis.git?.tracked
              ? 'Working tree clean'
              : 'Local folder'}
          </p>
        </div>
      </div>

      {/* 4. Health Score */}
      <div className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${cardBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-3 w-3" />
            </div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Health Score</p>
          </div>
          <span className={`flex h-1.5 w-1.5 rounded-full ${
            typeof healthScore !== 'number'
              ? 'bg-slate-400'
              : healthScore >= 80
              ? 'bg-emerald-500'
              : healthScore >= 60
              ? 'bg-blue-500'
              : 'bg-amber-500'
          }`} />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <p className={`text-base font-semibold ${
            typeof healthScore !== 'number'
              ? (isDark ? 'text-slate-400' : 'text-slate-600')
              : healthScore >= 80
              ? 'text-emerald-500'
              : healthScore >= 60
              ? 'text-blue-500'
              : 'text-amber-500'
          }`}>
            {typeof healthScore === 'number' ? `${healthScore}/100` : '—'}
          </p>
          <span className={`text-[10px] font-medium ${muted}`}>
            {typeof healthScore === 'number'
              ? healthScore >= 80
                ? 'Healthy'
                : healthScore >= 60
                ? 'Moderate'
                : 'Needs attention'
              : 'Scan ready'}
          </span>
        </div>
      </div>
    </div>
  );
};
