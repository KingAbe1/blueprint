import React, { useEffect } from 'react';
import { Check, Download, X } from 'lucide-react';
import { CodebaseAnalysis, QualityDimension } from '../../types/codebase';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewHealthScoreColor,
  overviewPanelClass,
  overviewSeverityLabel,
} from './overviewUi';

interface PillarSummary {
  earned: number;
  max: number;
  pct: number;
  dims: QualityDimension[];
}

interface QualityHealthSummaryProps {
  analysis: CodebaseAnalysis;
  isDark: boolean;
  score: number;
  gradeLabel: string;
  gradeStatus: string;
  executiveDiagnosis: string;
  codeRigorPillar: PillarSummary;
  securityVerificationPillar: PillarSummary;
  totalQualityFindings: number;
  cveCount: number;
  showScoreBreakdown: boolean;
  onToggleScoreBreakdown: () => void;
  onExportReport: () => void;
  copiedReport: boolean;
}

export const QualityHealthSummary: React.FC<QualityHealthSummaryProps> = ({
  analysis,
  isDark,
  score,
  gradeLabel,
  gradeStatus,
  executiveDiagnosis,
  codeRigorPillar,
  securityVerificationPillar,
  totalQualityFindings,
  cveCount,
  showScoreBreakdown,
  onToggleScoreBreakdown,
  onExportReport,
  copiedReport,
}) => {
  const quality = analysis.quality!;
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = overviewPanelClass(isDark);
  const divide = overviewDivideClass(isDark);
  const border = overviewBorderClass(isDark);
  const modalSurface = isDark ? 'border-white/[0.09] bg-[#141518]' : 'border-slate-200/80 bg-white';

  useEffect(() => {
    if (!showScoreBreakdown) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggleScoreBreakdown();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showScoreBreakdown, onToggleScoreBreakdown]);

  const renderDimensionList = (dims: QualityDimension[]) => (
    <ul className={`divide-y ${divide}`}>
      {dims.map(dim => (
        <li key={dim.name} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[13px] font-medium ${title}`}>{dim.name}</span>
            <span className={`shrink-0 text-xs tabular-nums ${muted}`}>
              {dim.score}/{dim.maxScore}
            </span>
          </div>
          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{dim.summary}</p>
        </li>
      ))}
    </ul>
  );

  return (
    <section id="quality-score-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 ${border}`}>
        <div>
          <h2 className={`text-[15px] font-medium ${title}`}>Health summary</h2>
          <p className={`mt-0.5 text-[13px] ${muted}`}>
            {gradeStatus} · {quality.confidence} confidence · grade {gradeLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportReport}
          className={
            isDark
              ? 'inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300'
              : 'inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800'
          }
        >
          {copiedReport ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          {copiedReport ? 'Exported' : 'Export report'}
        </button>
      </header>

      <dl className={`grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0 ${divide}`}>
        <div className="px-5 py-4 sm:px-6">
          <dt className={`text-[13px] ${muted}`}>Health score</dt>
          <dd className={`mt-2 text-xl font-medium tabular-nums tracking-tight ${overviewHealthScoreColor(score, isDark)}`}>
            {score}
            <span className={`ml-1 text-base font-normal ${muted}`}>/ 100</span>
          </dd>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <dt className={`text-[13px] ${muted}`}>Static findings</dt>
          <dd
            className={`mt-2 text-xl font-medium tabular-nums tracking-tight ${
              totalQualityFindings > 0 ? overviewSeverityLabel(isDark, 'warning') : title
            }`}
          >
            {totalQualityFindings}
          </dd>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <dt className={`text-[13px] ${muted}`}>Supply-chain CVEs</dt>
          <dd
            className={`mt-2 text-xl font-medium tabular-nums tracking-tight ${
              cveCount > 0 ? overviewSeverityLabel(isDark, 'critical') : title
            }`}
          >
            {cveCount}
          </dd>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <dt className={`text-[13px] ${muted}`}>Lines of code</dt>
          <dd className={`mt-2 text-xl font-medium tabular-nums tracking-tight ${title}`}>
            {quality.linesOfCode ? `${Math.round(quality.linesOfCode / 1000)}k` : '—'}
          </dd>
        </div>
      </dl>

      <div className={`border-t px-5 py-4 sm:px-6 ${border}`}>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{executiveDiagnosis}</p>
        <button
          type="button"
          onClick={onToggleScoreBreakdown}
          className={
            isDark
              ? 'mt-2 text-[13px] font-medium text-blue-400 hover:text-blue-300'
              : 'mt-2 text-[13px] font-medium text-blue-600 hover:text-blue-800'
          }
        >
          How is this score calculated?
        </button>
      </div>

      {showScoreBreakdown ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
            isDark ? 'bg-black/55' : 'bg-slate-950/40'
          }`}
          onMouseDown={event => {
            if (event.target === event.currentTarget) onToggleScoreBreakdown();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quality-score-breakdown-title"
            className={`max-h-[min(85vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalSurface} ${
              isDark ? 'shadow-black/50' : 'shadow-slate-900/15'
            }`}
            onMouseDown={event => event.stopPropagation()}
          >
            <header className={`flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 ${border}`}>
              <div>
                <h2 id="quality-score-breakdown-title" className={`text-[15px] font-medium ${title}`}>
                  How health score is calculated
                </h2>
                <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
                  The score sums dimension points from the local static scan (structure, maintainability, tests, tooling,
                  and related checks). Supply-chain CVEs are tracked separately in the supply chain section.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleScoreBreakdown}
                className={`shrink-0 rounded-md p-1 ${muted} ${isDark ? 'hover:text-slate-200' : 'hover:text-slate-900'}`}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[calc(min(85vh,640px)-8rem)] overflow-y-auto px-5 py-4 sm:px-6">
              <ul className={`divide-y ${divide}`}>
                {(quality.dimensions || []).map(dim => (
                  <li key={dim.name} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-[13px] font-medium ${title}`}>{dim.name}</span>
                      <span className={`shrink-0 text-xs tabular-nums ${muted}`}>
                        {dim.score}/{dim.maxScore} pts
                      </span>
                    </div>
                    <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{dim.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
            <footer className={`border-t px-5 py-3 sm:px-6 ${border}`}>
              <p className={`text-xs tabular-nums ${muted}`}>
                Total{' '}
                <span className={title}>
                  {(quality.dimensions || []).reduce((n, d) => n + d.score, 0)}/
                  {(quality.dimensions || []).reduce((n, d) => n + d.maxScore, 0)}
                </span>{' '}
                dimension points · displayed health index {score}/100
              </p>
            </footer>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-1 border-t md:grid-cols-2 md:divide-x ${divide} ${border}`}>
        <div className="px-5 py-4 sm:px-6">
          <h3 className={`text-[13px] font-medium ${title}`}>
            Code quality{' '}
            <span className={`font-normal tabular-nums ${muted}`}>
              ({codeRigorPillar.pct}% · {codeRigorPillar.earned}/{codeRigorPillar.max} pts)
            </span>
          </h3>
          <div className="mt-3">{renderDimensionList(codeRigorPillar.dims)}</div>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <h3 className={`text-[13px] font-medium ${title}`}>
            Security & tests{' '}
            <span className={`font-normal tabular-nums ${muted}`}>
              ({securityVerificationPillar.pct}% · {securityVerificationPillar.earned}/{securityVerificationPillar.max}{' '}
              pts)
            </span>
          </h3>
          <div className="mt-3">{renderDimensionList(securityVerificationPillar.dims)}</div>
        </div>
      </div>
    </section>
  );
};
