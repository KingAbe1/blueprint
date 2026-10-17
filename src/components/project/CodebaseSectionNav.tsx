import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  CodebaseProjectSection,
  useCodebaseWorkspace,
} from '../../context/CodebaseWorkspaceContext';

const SECTIONS: Array<{ id: CodebaseProjectSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'analysis', label: 'Code' },
  { id: 'quality', label: 'Quality' },
];

interface CodebaseSectionNavProps {
  qualityScore?: number | null;
  openIssueCount?: number;
}

export const CodebaseSectionNav: React.FC<CodebaseSectionNavProps> = ({
  qualityScore = null,
  openIssueCount = 0,
}) => {
  const { isDark } = useTheme();
  const { enabled, activeSection, selectSection } = useCodebaseWorkspace();
  if (!enabled) return null;

  const current = activeSection ?? 'overview';
  const track = isDark
    ? 'border-white/[0.1] bg-white/[0.03]'
    : 'border-slate-200 bg-slate-100/90';

  return (
    <nav
      aria-label="Codebase sections"
      className={`inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border p-1 ${track}`}
    >
      {SECTIONS.map(section => {
        const selected = current === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => selectSection(section.id)}
            aria-current={selected ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 ${
              selected
                ? 'btn-secondary-accent shadow-sm'
                : isDark
                  ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <span>{section.label}</span>
            {section.id === 'quality' && typeof qualityScore === 'number' ? (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  qualityScore < 60
                    ? isDark
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-amber-100 text-amber-900'
                    : qualityScore < 80
                      ? isDark
                        ? 'bg-blue-500/20 text-blue-200'
                        : 'bg-blue-100 text-blue-900'
                      : isDark
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {qualityScore}
              </span>
            ) : null}
            {section.id === 'quality' && openIssueCount > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  isDark ? 'bg-rose-500/15 text-rose-200' : 'bg-rose-100 text-rose-900'
                }`}
              >
                {openIssueCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
};
