import React from 'react';
import {
  GitBranch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { sanitizeDatabaseName } from '../../services/architectureAnalysisService';

export type QualityOverviewFocus = 'score' | 'findings' | 'supply-chain';

interface CodebaseHeroPulseProps {
  analysis: CodebaseAnalysis;
  onOpenQuality?: (focus: QualityOverviewFocus) => void;
}

export const CodebaseHeroPulse: React.FC<CodebaseHeroPulseProps> = React.memo(({ analysis, onOpenQuality }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const card = isDark
    ? 'rounded-xl border border-white/[0.08] bg-[#141518] p-4'
    : 'rounded-xl border border-slate-200 bg-white p-4 shadow-2xs';

  const frameworks = (analysis.frameworks || []).filter(f => {
    if (analysis.nextjs && f.toLowerCase().includes('next')) return false;
    return true;
  });

  const sanitizedDb = sanitizeDatabaseName(
    analysis.architecture?.database.name,
    analysis.architecture?.database.evidence,
  );

  const stackLine = [
    analysis.nextjs ? `Next.js ${analysis.nextjs.version || ''}`.trim() : null,
    frameworks[0] || null,
    analysis.languages[0]?.name || null,
    sanitizedDb && sanitizedDb !== 'Not assessed' && sanitizedDb !== 'No database signal detected'
      ? sanitizedDb
      : null,
  ].filter((item, index, self): item is string => Boolean(item) && self.indexOf(item) === index);

  const loc = analysis.quality?.linesOfCode;
  const healthScore = analysis.quality?.score;
  const findingsCount = analysis.quality?.findings?.length ?? 0;
  const advisoryCount = analysis.dependencyRisk?.advisories?.length ?? 0;

  const openQuality = (focus: QualityOverviewFocus) => onOpenQuality?.(focus);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={card}>
        <p className={`text-xs font-medium ${muted}`}>Stack</p>
        <p className={`mt-1 text-base font-semibold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {stackLine[0] || 'Unknown stack'}
        </p>
        <p className={`mt-1 text-xs ${muted}`}>
          {analysis.architecture?.topology || 'Application'}
          {stackLine.length > 1 ? ` · ${stackLine.slice(1, 3).join(' · ')}` : ''}
        </p>
      </div>

      <div className={card}>
        <p className={`text-xs font-medium ${muted}`}>Size</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {loc ? (loc >= 1000 ? `${(loc / 1000).toFixed(1)}k lines` : `${loc} lines`) : `${analysis.sourceFiles} source files`}
        </p>
        <p className={`mt-1 text-xs ${muted}`}>
          {analysis.filesScanned.toLocaleString()} files in scan
        </p>
      </div>

      <div className={card}>
        <p className={`text-xs font-medium ${muted}`}>Git</p>
        <p className={`mt-1 flex items-center gap-1.5 text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <GitBranch className="h-4 w-4 shrink-0 opacity-70" />
          {analysis.git?.tracked ? analysis.git.branch || 'main' : 'Not tracked'}
        </p>
        <p className={`mt-1 text-xs ${muted}`}>
          {analysis.git?.tracked
            ? analysis.git.changedFiles
              ? `${analysis.git.changedFiles} changed files`
              : 'Clean working tree'
            : 'Local folder only'}
        </p>
      </div>

      <button
        type="button"
        disabled={!onOpenQuality}
        onClick={() => openQuality('score')}
        className={`${card} text-left transition-colors ${
          onOpenQuality
            ? isDark
              ? 'hover:border-white/[0.14] hover:bg-[#18191d]'
              : 'hover:border-slate-300 hover:bg-slate-50'
            : 'cursor-default'
        }`}
      >
        <p className={`flex items-center gap-1.5 text-xs font-medium ${muted}`}>
          {typeof healthScore === 'number' && healthScore < 60 ? (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          )}
          Health
        </p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {typeof healthScore === 'number' ? `${healthScore}/100` : '—'}
        </p>
        <p className={`mt-1 text-xs ${muted}`}>
          {findingsCount} findings
          {advisoryCount > 0 ? ` · ${advisoryCount} CVEs` : ''}
          {onOpenQuality ? (
            <>
              {' · '}
              <span className={isDark ? 'text-blue-400' : 'text-blue-700'}>View in Quality</span>
            </>
          ) : null}
        </p>
      </button>
    </div>
  );
});
