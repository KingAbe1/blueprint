import React from 'react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { sanitizeDatabaseName } from '../../services/architectureAnalysisService';

export type QualityOverviewFocus = 'score' | 'findings' | 'supply-chain';

function healthScoreColor(score: number | undefined, isDark: boolean): string {
  if (typeof score !== 'number') {
    return isDark ? 'text-slate-100' : 'text-slate-900';
  }
  if (score >= 80) return isDark ? 'text-emerald-400' : 'text-emerald-700';
  if (score >= 60) return isDark ? 'text-slate-100' : 'text-slate-900';
  if (score >= 40) return isDark ? 'text-amber-400/90' : 'text-amber-800';
  return isDark ? 'text-rose-400/95' : 'text-rose-700';
}

interface MetricCellProps {
  label: string;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  isDark: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

const MetricCell: React.FC<MetricCellProps> = ({
  label,
  primary,
  secondary,
  isDark,
  onClick,
  ariaLabel,
}) => {
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const hover = onClick
    ? isDark
      ? 'hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40'
      : 'hover:bg-slate-50/90 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/30'
    : '';

  const inner = (
    <>
      <dt className={`text-[13px] font-normal leading-none ${muted}`}>{label}</dt>
      <dd className={`mt-3 text-[1.35rem] font-medium leading-tight tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        {primary}
      </dd>
      <dd className={`mt-2 text-xs font-normal leading-relaxed ${muted}`}>{secondary}</dd>
    </>
  );

  const base = `flex flex-col p-5 text-left sm:px-6 sm:py-6 ${hover}`;

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
        className={`${base} cursor-pointer`}
        aria-label={ariaLabel}
      >
        {inner}
      </div>
    );
  }

  return <div className={base}>{inner}</div>;
};

interface CodebaseHeroPulseProps {
  analysis: CodebaseAnalysis;
  onOpenQuality?: (focus: QualityOverviewFocus) => void;
}

export const CodebaseHeroPulse: React.FC<CodebaseHeroPulseProps> = React.memo(({ analysis, onOpenQuality }) => {
  const { isDark } = useTheme();

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

  const sizePrimary = loc
    ? loc >= 1000
      ? `${(loc / 1000).toFixed(1)}k lines`
      : `${loc.toLocaleString()} lines`
    : `${analysis.sourceFiles.toLocaleString()} source files`;

  const stackSecondary = [
    analysis.architecture?.topology || 'Application',
    ...stackLine.slice(1, 3),
  ].filter(Boolean).join(' · ');

  const gitPrimary = analysis.git?.tracked ? analysis.git.branch || 'main' : 'Not tracked';
  const gitSecondary = analysis.git?.tracked
    ? analysis.git.changedFiles
      ? `${analysis.git.changedFiles} uncommitted change${analysis.git.changedFiles === 1 ? '' : 's'}`
      : 'Working tree clean'
    : 'Local folder';

  const healthSecondaryParts = [
    findingsCount > 0 ? `${findingsCount} finding${findingsCount === 1 ? '' : 's'}` : null,
    advisoryCount > 0 ? `${advisoryCount} CVE${advisoryCount === 1 ? '' : 's'}` : null,
    onOpenQuality ? 'Quality tab' : null,
  ].filter(Boolean);

  const panel = isDark
    ? 'border-white/[0.06] bg-[#131417]'
    : 'border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

  const divide = isDark ? 'divide-white/[0.06]' : 'divide-slate-200/90';

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${panel}`}
      aria-label="Project summary"
    >
      <dl
        className={`grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0 ${divide}`}
      >
        <MetricCell
          label="Stack"
          isDark={isDark}
          primary={stackLine[0] || 'Unknown stack'}
          secondary={stackSecondary || '-'}
        />

        <MetricCell
          label="Size"
          isDark={isDark}
          primary={<span className="tabular-nums">{sizePrimary}</span>}
          secondary={`${analysis.filesScanned.toLocaleString()} paths scanned`}
        />

        <MetricCell
          label="Git"
          isDark={isDark}
          primary={gitPrimary}
          secondary={gitSecondary}
        />

        <MetricCell
          label="Health"
          isDark={isDark}
          onClick={onOpenQuality ? () => onOpenQuality('score') : undefined}
          ariaLabel={
            typeof healthScore === 'number'
              ? `Health score ${healthScore} out of 100. Open quality.`
              : 'Open quality'
          }
          primary={
            typeof healthScore === 'number' ? (
              <span className={`tabular-nums ${healthScoreColor(healthScore, isDark)}`}>
                {healthScore}
                <span className={`ml-1 text-base font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  / 100
                </span>
              </span>
            ) : (
              '-'
            )
          }
          secondary={healthSecondaryParts.length > 0 ? healthSecondaryParts.join(' · ') : 'No quality scan'}
        />
      </dl>
    </section>
  );
});
