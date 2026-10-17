/** Shared surface styles for Overview tab panels (matches summary stats strip). */

export function overviewPanelClass(isDark: boolean): string {
  return isDark
    ? 'border-white/[0.06] bg-[#131417]'
    : 'border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
}

export function overviewDivideClass(isDark: boolean): string {
  return isDark ? 'divide-white/[0.06]' : 'divide-slate-200/90';
}

export function overviewBorderClass(isDark: boolean): string {
  return isDark ? 'border-white/[0.06]' : 'border-slate-200/90';
}

export type OverviewEmphasis = 'critical' | 'warning' | 'info' | 'neutral';

/** Left rail + optional wash - use on one row/cell when something needs to stand out. */
export function overviewRowEmphasis(isDark: boolean, level: OverviewEmphasis): string {
  switch (level) {
    case 'critical':
      return isDark
        ? 'border-l-[3px] border-l-rose-500/90 bg-rose-500/[0.06] pl-[calc(1.25rem-3px)] sm:pl-[calc(1.5rem-3px)]'
        : 'border-l-[3px] border-l-rose-600 bg-rose-50/90 pl-[calc(1.25rem-3px)] sm:pl-[calc(1.5rem-3px)]';
    case 'warning':
      return isDark
        ? 'border-l-[3px] border-l-amber-500/85 bg-amber-500/[0.05] pl-[calc(1.25rem-3px)] sm:pl-[calc(1.5rem-3px)]'
        : 'border-l-[3px] border-l-amber-500 bg-amber-50/80 pl-[calc(1.25rem-3px)] sm:pl-[calc(1.5rem-3px)]';
    case 'info':
      return isDark
        ? 'border-l-[3px] border-l-blue-500/70 bg-blue-500/[0.04] pl-[calc(1.25rem-3px)] sm:pl-[calc(1.5rem-3px)]'
        : 'border-l-[3px] border-l-blue-500 bg-blue-50/70 pl-[calc(1.25rem-3px)] sm:pl-[calc(1.5rem-3px)]';
    default:
      return '';
  }
}

/** Top accent on a panel when the whole block deserves attention (e.g. critical review). */
export function overviewPanelTopAccent(isDark: boolean, level: 'critical' | 'warning'): string {
  if (level === 'critical') {
    return isDark ? 'border-t-2 border-t-rose-500/70' : 'border-t-2 border-t-rose-600';
  }
  return isDark ? 'border-t-2 border-t-amber-500/65' : 'border-t-2 border-t-amber-500';
}

export function overviewSeverityLabel(isDark: boolean, severity: string): string {
  switch (severity) {
    case 'critical':
      return isDark ? 'font-medium text-rose-400' : 'font-medium text-rose-700';
    case 'warning':
      return isDark ? 'font-medium text-amber-400/95' : 'font-medium text-amber-800';
    case 'optimization':
      return isDark ? 'text-blue-400/90' : 'text-blue-700';
    default:
      return isDark ? 'text-slate-500' : 'text-slate-500';
  }
}

export function overviewHealthScoreColor(score: number | undefined, isDark: boolean): string {
  if (typeof score !== 'number') {
    return isDark ? 'text-slate-100' : 'text-slate-900';
  }
  if (score >= 80) return isDark ? 'text-emerald-400' : 'text-emerald-700';
  if (score >= 60) return isDark ? 'text-slate-100' : 'text-slate-900';
  if (score >= 40) return isDark ? 'text-amber-400/90' : 'text-amber-800';
  return isDark ? 'text-rose-400/95' : 'text-rose-700';
}

export function overviewMetricValueAccent(isDark: boolean, level: OverviewEmphasis): string {
  switch (level) {
    case 'critical':
      return isDark ? 'text-rose-400' : 'text-rose-700';
    case 'warning':
      return isDark ? 'text-amber-400/95' : 'text-amber-800';
    case 'info':
      return isDark ? 'text-blue-400' : 'text-blue-700';
    default:
      return isDark ? 'text-slate-100' : 'text-slate-900';
  }
}
