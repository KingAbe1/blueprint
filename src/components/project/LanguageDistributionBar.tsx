import React, { useState } from 'react';
import { Code2, Filter } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface LanguageDistributionBarProps {
  languages: CodebaseAnalysis['languages'];
}

// Well-known language color mappings
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

export const LanguageDistributionBar: React.FC<LanguageDistributionBarProps> = ({ languages }) => {
  const { isDark } = useTheme();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';

  const totalFiles = languages.reduce((acc, curr) => acc + curr.files, 0);
  if (totalFiles === 0) return null;

  const distributions = languages.map(lang => {
    const percentage = Number(((lang.files / totalFiles) * 100).toFixed(1));
    const color = LANGUAGE_COLORS[lang.name] || '#8b949e';
    return {
      name: lang.name,
      files: lang.files,
      percentage,
      color,
    };
  });

  return (
    <section className={`rounded-xl border p-4 ${panel}`}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-blue-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Language Distribution
          </h2>
        </div>
        <span className={`text-[10px] font-medium ${muted}`}>
          {totalFiles.toLocaleString()} source files categorized
        </span>
      </div>

      {/* Proportional Stacked Segment Bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-200/50 dark:bg-white/[0.05] p-0.5 gap-0.5">
        {distributions.map(lang => (
          <div
            key={lang.name}
            title={`${lang.name}: ${lang.percentage}% (${lang.files} files)`}
            className="h-full rounded-xs transition-transform hover:scale-y-110 cursor-pointer first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${Math.max(lang.percentage, 1)}%`,
              backgroundColor: lang.color,
              opacity: activeFilter && activeFilter !== lang.name ? 0.3 : 1,
            }}
            onClick={() => setActiveFilter(curr => curr === lang.name ? null : lang.name)}
          />
        ))}
      </div>

      {/* Legend Grid */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {distributions.map(lang => {
          const isSelected = activeFilter === lang.name;
          return (
            <button
              key={lang.name}
              type="button"
              onClick={() => setActiveFilter(curr => curr === lang.name ? null : lang.name)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                isSelected
                  ? (isDark ? 'bg-white/[0.08] ring-1 ring-white/20' : 'bg-slate-100 ring-1 ring-slate-300')
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: lang.color }}
              />
              <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {lang.name}
              </span>
              <span className={`text-[11px] font-mono tabular-nums ${muted}`}>
                {lang.percentage}%
              </span>
              <span className={`text-[10px] ${muted}`}>
                ({lang.files})
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
