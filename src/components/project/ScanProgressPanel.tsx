import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, History, Minus } from 'lucide-react';
import type { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { diffForScan, useScanHistory, type ScanSnapshot } from '../../services/scanHistoryService';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { overviewBorderClass, overviewPanelClass, overviewSeverityLabel } from './overviewUi';

interface ScanProgressPanelProps {
  analysis: CodebaseAnalysis;
  projectId?: string;
}

function severityFor(priority: ScanSnapshot['findings'][number]['priority']) {
  if (priority === 'high') return 'critical';
  if (priority === 'medium') return 'warning';
  return 'optimization';
}

/** Small inline score trend. Uses currentColor so it follows the text color in both themes. */
const ScoreSparkline: React.FC<{ scores: number[]; className?: string }> = ({ scores, className }) => {
  if (scores.length < 2) return null;
  const width = 120;
  const height = 32;
  const pad = 3;
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const x = (i: number) => pad + (i * (width - pad * 2)) / (scores.length - 1);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const points = scores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = scores.length - 1;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Health score over the last ${scores.length} scans: ${scores.join(', ')}`}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(scores[last])} r={2.75} fill="currentColor" />
    </svg>
  );
};

const FindingList: React.FC<{
  items: ScanSnapshot['findings'];
  isDark: boolean;
  struck?: boolean;
}> = ({ items, isDark, struck }) => {
  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map(item => (
        <li key={item.key} className={`flex min-w-0 items-baseline gap-2 text-xs ${muted}`}>
          <span className={`shrink-0 ${overviewSeverityLabel(isDark, severityFor(item.priority))}`}>{item.priority}</span>
          <span className={`min-w-0 truncate ${struck ? 'line-through decoration-1 opacity-80' : ''}`}>{item.title}</span>
          {item.file ? <span className="hidden shrink-0 truncate font-mono text-[10.5px] opacity-70 sm:inline">{item.file}</span> : null}
        </li>
      ))}
    </ul>
  );
};

/** "Since last scan" summary: score change, new and fixed findings, and a score trend. */
export const ScanProgressPanel: React.FC<ScanProgressPanelProps> = ({ analysis, projectId }) => {
  const { isDark } = useTheme();
  const history = useScanHistory(projectId);
  const diff = useMemo(() => diffForScan(history, analysis.scannedAt), [history, analysis.scannedAt]);
  const [open, setOpen] = useState<'resolved' | 'added' | null>(null);

  const scores = useMemo(
    () =>
      history
        .filter(s => s.scannedAt <= analysis.scannedAt)
        .map(s => s.score)
        .filter((s): s is number => typeof s === 'number'),
    [history, analysis.scannedAt],
  );

  if (!projectId) return null;

  const panel = overviewPanelClass(isDark);
  const border = overviewBorderClass(isDark);
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-white' : 'text-slate-900';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const good = isDark ? 'text-emerald-400' : 'text-emerald-700';
  const bad = isDark ? 'text-rose-400' : 'text-rose-700';

  if (!diff) {
    return (
      <section className={`flex items-start gap-3 rounded-2xl border px-5 py-4 sm:px-6 ${panel}`}>
        <History className={`mt-0.5 h-4 w-4 shrink-0 ${muted}`} aria-hidden />
        <div>
          <h2 className={`text-[13px] font-medium ${title}`}>Scan history started</h2>
          <p className={`mt-0.5 text-xs leading-relaxed ${muted}`}>
            Rescan after you or your agent make changes to see what got fixed, what is new, and how the score moves.
          </p>
        </div>
      </section>
    );
  }

  const { scoreDelta, added, resolved, previous, current } = diff;
  const cveDelta = current.counts.cves - previous.counts.cves;
  const DeltaIcon = scoreDelta === null || scoreDelta === 0 ? Minus : scoreDelta > 0 ? ArrowUpRight : ArrowDownRight;
  const deltaColor = scoreDelta === null || scoreDelta === 0 ? muted : scoreDelta > 0 ? good : bad;

  const toggleButton = (key: 'resolved' | 'added', label: string, count: number, color: string) => (
    <button
      type="button"
      onClick={() => setOpen(current => (current === key ? null : key))}
      disabled={count === 0}
      aria-expanded={open === key}
      className={`inline-flex items-center gap-1 text-[13px] disabled:cursor-default ${count === 0 ? muted : color}`}
    >
      {count > 0 ? (
        open === key ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      ) : null}
      <span className="font-medium tabular-nums">{count}</span> {label}
    </button>
  );

  return (
    <section id="quality-scan-progress-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className={`text-[15px] font-medium ${title}`}>Since last scan</h2>
          <p className={`mt-0.5 text-[13px] ${muted}`}>
            Previous scan: {formatRelativeTime(previous.scannedAt)} · {history.length} scans saved
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] tabular-nums ${muted}`}>{previous.score ?? '–'}</span>
            <span className={muted} aria-hidden>→</span>
            <span className={`text-[15px] font-medium tabular-nums ${strong}`}>{current.score ?? '–'}</span>
            <span className={`inline-flex items-center text-[13px] font-medium tabular-nums ${deltaColor}`}>
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
              {scoreDelta === null ? '' : `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`}
            </span>
          </div>
          {toggleButton('resolved', 'fixed', resolved.length, good)}
          {toggleButton('added', 'new', added.length, bad)}
          {cveDelta !== 0 ? (
            <span className={`text-[13px] tabular-nums ${cveDelta < 0 ? good : bad}`}>
              {cveDelta > 0 ? '+' : ''}
              {cveDelta} CVE{Math.abs(cveDelta) === 1 ? '' : 's'}
            </span>
          ) : null}
          <ScoreSparkline scores={scores} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
        </div>
      </div>

      {open ? (
        <div className={`border-t px-5 py-3 sm:px-6 ${border}`}>
          <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
            {open === 'resolved' ? 'No longer reported' : 'New in this scan'}
          </p>
          <FindingList items={open === 'resolved' ? resolved : added} isDark={isDark} struck={open === 'resolved'} />
        </div>
      ) : null}
    </section>
  );
};
