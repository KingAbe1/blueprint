import React from 'react';
import { FileCode2, Gauge, LayoutDashboard } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

export type ProjectSection = 'overview' | 'quality' | 'analysis';

interface ProjectSectionNavigationProps {
  analysis: CodebaseAnalysis;
  activePage: ProjectSection;
  onSelect: (page: ProjectSection) => void;
}

const navigationItems = [
  { id: 'overview', label: 'Project overview', Icon: LayoutDashboard },
  { id: 'analysis', label: 'Code analysis', Icon: FileCode2 },
  { id: 'quality', label: 'Quality & risks', Icon: Gauge },
] as const;

export const ProjectSectionNavigation: React.FC<ProjectSectionNavigationProps> = ({ analysis, activePage, onSelect }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return <aside className="shrink-0 lg:sticky lg:top-0 lg:w-56 lg:self-start">
    <div className={`rounded-xl border p-2 lg:border-0 lg:bg-transparent lg:p-0 ${isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white/80'}`}>
      <p className={`mb-2 hidden px-3 text-[9px] font-semibold uppercase tracking-[0.14em] lg:block ${muted}`}>Project navigation</p>
      <nav aria-label="Project sections" className="flex gap-1 overflow-x-auto lg:flex-col">
        {navigationItems.map(({ id, label, Icon }) => {
          const selected = activePage === id;
          return <button key={id} type="button" onClick={() => onSelect(id)} aria-current={selected ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors lg:w-full ${selected ? (isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-700') : (isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}`}>
            <Icon className="h-4 w-4 shrink-0" />{label}
          </button>;
        })}
      </nav>
      <div className={`mt-5 hidden rounded-lg border p-3 lg:block ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200 bg-white/70'}`}>
        <p className={`text-[9px] font-semibold uppercase tracking-wide ${muted}`}>Local scan</p>
        <p className={`mt-1 text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{analysis.filesScanned.toLocaleString()} files reviewed</p>
        <p className={`mt-1 text-[9px] leading-4 ${muted}`}>Read-only · scanned {new Date(analysis.scannedAt).toLocaleDateString()}</p>
      </div>
    </div>
  </aside>;
};
