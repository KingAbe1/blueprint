import React from 'react';
import {
  Layers,
  FileCode2,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Sparkles,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { sanitizeDatabaseName } from '../../services/architectureAnalysisService';

interface CodebaseHeroPulseProps {
  analysis: CodebaseAnalysis;
}

export const CodebaseHeroPulse: React.FC<CodebaseHeroPulseProps> = React.memo(({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark
    ? 'bg-[#141518] border-white/[0.08] hover:border-white/[0.14] transition-all duration-150'
    : 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all duration-150';
  const cardDivider = isDark ? 'border-white/[0.06]' : 'border-slate-200/70';

  // Smart deduplication for stack badges
  const frameworks = (analysis.frameworks || []).filter(f => {
    if (analysis.nextjs && f.toLowerCase().includes('next')) return false;
    return true;
  });

  const sanitizedDb = sanitizeDatabaseName(
    analysis.architecture?.database.name,
    analysis.architecture?.database.evidence
  );

  const primaryTech = [
    analysis.nextjs ? `Next.js ${analysis.nextjs.version || ''}`.trim() : null,
    frameworks[0] || null,
    analysis.languages[0]?.name || null,
    sanitizedDb && sanitizedDb !== 'Not assessed' && sanitizedDb !== 'No database signal detected'
      ? sanitizedDb
      : null,
  ].filter((item, index, self): item is string => Boolean(item) && self.indexOf(item) === index);

  const loc = analysis.quality?.linesOfCode;
  const healthScore = analysis.quality?.score;
  const totalLangFiles = analysis.languages.reduce((acc, curr) => acc + curr.files, 0) || 1;
  const topLanguages = analysis.languages.slice(0, 3);

  const scoreStatus =
    typeof healthScore !== 'number'
      ? { label: 'Unassessed', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400' }
      : healthScore >= 80
      ? { label: 'Optimal', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500' }
      : healthScore >= 60
      ? { label: 'Moderate', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' }
      : { label: 'Needs Remediation', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Primary Stack */}
      <div className={`rounded-xl border p-4 flex flex-col justify-between ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Primary Stack</span>
            </div>
          </div>

          <div className="mt-3">
            <h4 className={`text-base font-semibold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {analysis.nextjs ? `Next.js ${analysis.nextjs.version || ''}`.trim() : frameworks[0] || analysis.languages[0]?.name || 'TypeScript'}
            </h4>
            <p className={`mt-0.5 text-[11px] truncate ${muted}`}>
              {analysis.architecture?.topology || 'Full-stack application'}
            </p>
          </div>
        </div>

        <div className={`mt-3 pt-2.5 border-t ${cardDivider} flex flex-wrap gap-1.5`}>
          {primaryTech.slice(0, 3).map(tech => (
            <span
              key={tech}
              className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                isDark
                  ? 'border-white/[0.08] bg-white/[0.04] text-slate-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Codebase Scale */}
      <div className={`rounded-xl border p-4 flex flex-col justify-between ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20">
                <FileCode2 className="h-3.5 w-3.5" />
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Codebase Scale</span>
            </div>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}>
              {analysis.sourceFiles} source files
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <h4 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {loc ? (loc >= 1000 ? `${(loc / 1000).toFixed(1)}k` : loc) : analysis.sourceFiles}
              </h4>
              <span className={`text-xs font-semibold uppercase ${muted}`}>
                {loc ? 'LOC' : 'Files'}
              </span>
            </div>
            <p className={`mt-0.5 text-[11px] ${muted}`}>
              {analysis.filesScanned.toLocaleString()} total files scanned
            </p>
          </div>
        </div>

        {/* Mini Language Proportion Strip */}
        <div className={`mt-3 pt-2.5 border-t ${cardDivider}`}>
          <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-white/[0.06] gap-0.5">
            {topLanguages.map((lang, idx) => {
              const pct = (lang.files / totalLangFiles) * 100;
              const colors = ['bg-blue-500', 'bg-amber-500', 'bg-yellow-400', 'bg-purple-500'];
              return (
                <div
                  key={lang.name}
                  className={`h-full ${colors[idx % colors.length]}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                  title={`${lang.name}: ${pct.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px]">
            <span className={muted}>
              {topLanguages[0]?.name || 'TypeScript'} {((topLanguages[0]?.files || 0) / totalLangFiles * 100).toFixed(0)}%
            </span>
            <span className={muted}>
              {topLanguages[1]?.name ? `${topLanguages[1].name} ${((topLanguages[1].files / totalLangFiles) * 100).toFixed(0)}%` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Git Repository */}
      <div className={`rounded-xl border p-4 flex flex-col justify-between ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <GitBranch className="h-3.5 w-3.5" />
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Git Repository</span>
            </div>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${analysis.git?.tracked ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={`text-[9px] font-medium ${analysis.git?.tracked ? 'text-emerald-400' : muted}`}>
                {analysis.git?.tracked ? 'Tracked' : 'Local'}
              </span>
            </span>
          </div>

          <div className="mt-3">
            <h4 className={`text-base font-semibold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {analysis.git?.branch || 'main'}
            </h4>
            <p className={`mt-0.5 text-[11px] truncate ${muted}`}>
              {analysis.git?.changedFiles
                ? `${analysis.git.changedFiles} modified files`
                : analysis.git?.tracked
                ? 'Working tree clean'
                : 'Local unversioned folder'}
            </p>
          </div>
        </div>

        <div className={`mt-3 pt-2.5 border-t ${cardDivider} flex items-center justify-between text-[10px]`}>
          <span className={`flex items-center gap-1 truncate ${muted}`}>
            <GitCommit className="h-3 w-3 shrink-0" />
            <span className="truncate">{analysis.git?.latestCommit ? analysis.git.latestCommit.slice(0, 24) : 'Ready'}</span>
          </span>
          <span className={`font-mono text-[9px] px-1 rounded ${isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
            HEAD
          </span>
        </div>
      </div>

      {/* 4. Health Score */}
      <div className={`rounded-xl border p-4 flex flex-col justify-between ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg border ${
                typeof healthScore === 'number' && healthScore < 60
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
              }`}>
                {typeof healthScore === 'number' && healthScore < 60 ? (
                  <ShieldAlert className="h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Health Score</span>
            </div>
            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${scoreStatus.bg} ${scoreStatus.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${scoreStatus.dot}`} />
              {scoreStatus.label}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <h4 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {typeof healthScore === 'number' ? healthScore : '—'}
            </h4>
            <span className={`text-xs font-semibold ${muted}`}>/ 100</span>
          </div>
          <p className={`mt-0.5 text-[11px] ${muted}`}>
            {analysis.quality?.confidence || 'medium'} confidence assessment
          </p>
        </div>

        <div className={`mt-3 pt-2.5 border-t ${cardDivider} flex items-center justify-between text-[10px]`}>
          <span className={muted}>
            Findings: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{analysis.quality?.findings?.length || 0}</strong>
          </span>
          <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded ${
            typeof healthScore === 'number' && healthScore < 60
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-emerald-400 bg-emerald-500/10'
          }`}>
            {typeof healthScore === 'number' && healthScore >= 80 ? 'Grade A' : typeof healthScore === 'number' && healthScore >= 60 ? 'Grade B' : 'Grade C'}
          </span>
        </div>
      </div>
    </div>
  );
});
