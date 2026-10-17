import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { QualityOverviewFocus } from './CodebaseHeroPulse';

interface OverviewOpenIssuesStripProps {
  openItems: number;
  onOpenQuality: (focus: QualityOverviewFocus) => void;
}

export const OverviewOpenIssuesStrip: React.FC<OverviewOpenIssuesStripProps> = ({
  openItems,
  onOpenQuality,
}) => {
  const { isDark } = useTheme();

  if (openItems <= 0) return null;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        isDark ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-rose-200 bg-rose-50'
      }`}
    >
      <p className={`text-sm ${isDark ? 'text-rose-100' : 'text-rose-950'}`}>
        <span className="font-semibold">{openItems} issue{openItems === 1 ? '' : 's'}</span>
        {' '}to review in Quality — findings and dependency advisories from the last scan.
      </p>
      <button
        type="button"
        onClick={() => onOpenQuality('findings')}
        className="btn-secondary-accent shrink-0 px-3 py-1.5 text-xs font-semibold"
      >
        Open Quality
      </button>
    </div>
  );
};
