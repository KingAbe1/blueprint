import React, { useState } from 'react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { overviewBorderClass, overviewPanelClass } from './overviewUi';

interface LanguageDistributionBarProps {
  languages: CodebaseAnalysis['languages'];
  /** When set, render inside a parent panel (no outer border / height stretch). */
  variant?: 'standalone' | 'embedded';
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  CSS: '#563D7C',
  SCSS: '#C6538C',
  HTML: '#E34C26',
  Python: '#3572A5',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Java: '#B07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  PHP: '#4F5D95',
  Ruby: '#701516',
  'C#': '#178600',
  'C++': '#F34B7D',
  C: '#555555',
  SQL: '#E38C00',
  Shell: '#89E051',
  YAML: '#CB171E',
  Vue: '#41B883',
  Svelte: '#FF3E00',
};

export const LanguageDistributionBar: React.FC<LanguageDistributionBarProps> = React.memo(({
  languages,
  variant = 'standalone',
}) => {
  const { isDark } = useTheme();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = overviewPanelClass(isDark);
  const border = overviewBorderClass(isDark);

  const totalFiles = languages.reduce((acc, curr) => acc + curr.files, 0);
  if (totalFiles === 0) return null;

  const distributions = languages.map(lang => {
    const percentage = Number(((lang.files / totalFiles) * 100).toFixed(1));
    const color = LANGUAGE_COLORS[lang.name] || '#8b949e';
    return { name: lang.name, files: lang.files, percentage, color };
  });

  const embedded = variant === 'embedded';
  const Shell = embedded ? 'div' : 'section';

  return (
    <Shell
      className={
        embedded ? undefined : `overflow-hidden rounded-2xl border ${panel}`
      }
    >
      <header className={`px-5 py-4 sm:px-6 ${embedded ? '' : `border-b ${border}`}`}>
        <h2 className={`text-[15px] font-medium ${title}`}>Languages</h2>
        <p className={`mt-0.5 text-[13px] ${muted}`}>
          {totalFiles.toLocaleString()} source files · click a segment to highlight
        </p>
      </header>

      <div className="px-5 pb-4 sm:px-6 sm:pb-5">
        <div
          className={`flex h-2 w-full overflow-hidden rounded-full ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200/80'}`}
          role="img"
          aria-label="Language mix by file count"
        >
          {distributions.map(lang => (
            <button
              key={lang.name}
              type="button"
              title={`${lang.name}: ${lang.percentage}% (${lang.files} files)`}
              className="h-full min-w-[2px] transition-opacity hover:opacity-90"
              style={{
                width: `${Math.max(lang.percentage, 0.5)}%`,
                backgroundColor: lang.color,
                opacity: activeFilter && activeFilter !== lang.name ? 0.25 : 1,
              }}
              onClick={() => setActiveFilter(curr => (curr === lang.name ? null : lang.name))}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {distributions.map(lang => {
            const selected = activeFilter === lang.name;
            return (
              <button
                key={lang.name}
                type="button"
                onClick={() => setActiveFilter(curr => (curr === lang.name ? null : lang.name))}
                className={`inline-flex items-center gap-1.5 text-[13px] transition-opacity ${
                  selected ? `font-medium ${title}` : muted
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: lang.color }} />
                <span>{lang.name}</span>
                <span className="tabular-nums opacity-80">{lang.percentage}%</span>
              </button>
            );
          })}
        </div>
      </div>
    </Shell>
  );
});
