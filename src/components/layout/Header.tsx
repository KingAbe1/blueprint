import React, { useState } from 'react';
import { Code2, FileText, LayoutGrid, Moon, Network, Settings2, Sun } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab } from '../../types/project';
import { ProjectDropdown } from '../project/ProjectDropdown';
import { isDesktopApp } from '../../utils/platform';
import { DesktopTitlebarStrip } from './DesktopTitlebarStrip';
import { CodebaseSectionNav } from '../project/CodebaseSectionNav';
import { CodebaseHeaderToolbar } from '../project/CodebaseHeaderToolbar';

interface HeaderProps {
  activeTab?: PhaseTab;
  onSelectTab?: (tab: PhaseTab) => void;
}

const PHASE_NAV: Array<{
  id: PhaseTab;
  label: string;
  shortLabel: string;
  icon: typeof FileText;
}> = [
  { id: 'domain-intent', label: 'Product blueprint', shortLabel: 'Blueprint', icon: FileText },
  { id: 'architecture-map', label: 'Architecture map', shortLabel: 'Map', icon: Network },
  { id: 'in-flight', label: 'Build handoff', shortLabel: 'Handoff', icon: Code2 },
];

function PhaseNav({
  activeTab,
  onSelectTab,
  handoffReady,
  isDark,
}: {
  activeTab: PhaseTab;
  onSelectTab: (tab: PhaseTab) => void;
  handoffReady: boolean;
  isDark: boolean;
}) {
  const track = isDark
    ? 'border-white/[0.1] bg-white/[0.03]'
    : 'border-slate-200 bg-slate-100/90';

  return (
    <nav
      className={`inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border p-1 ${track}`}
      aria-label="Project phases"
    >
      {PHASE_NAV.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const isAvailable = item.id === 'in-flight' ? handoffReady : true;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!isAvailable}
            onClick={() => isAvailable && onSelectTab(item.id)}
            title={isAvailable ? item.label : `${item.label} · Complete architecture first`}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 ${
              isActive
                ? 'btn-secondary-accent shadow-sm'
                : isAvailable
                  ? isDark
                    ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  : isDark
                    ? 'cursor-not-allowed text-[#494B51]'
                    : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? '' : 'opacity-80'}`} />
            <span className="hidden whitespace-nowrap md:inline">{item.label}</span>
            <span className="whitespace-nowrap md:hidden">{item.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'domain-intent',
  onSelectTab,
}) => {
  const { isCreatingNew, setIsCreatingNew, activeProject } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { isAiConfigured, setIsSettingsOpen } = useAI();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const iconButton = isDark
    ? 'text-[#8E9098] hover:bg-white/[0.06] hover:text-white'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';

  const goToProjectHome = () => {
    setIsCreatingNew(true);
    setIsProjectMenuOpen(false);
  };

  const inGreenfieldProject = Boolean(activeProject && !activeProject.codebaseAnalysis && !isCreatingNew);
  const isHub = !activeProject || isCreatingNew;
  const showHeaderProjectMenu = Boolean(activeProject?.codebaseAnalysis && !isCreatingNew);
  const showCodebaseNav = showHeaderProjectMenu;
  const showPhaseNav = inGreenfieldProject && Boolean(onSelectTab);
  const showCenterNav = showPhaseNav || showCodebaseNav;

  const codebaseAnalysis = activeProject?.codebaseAnalysis;
  const qualityScore =
    typeof codebaseAnalysis?.quality?.score === 'number' ? codebaseAnalysis.quality.score : null;
  const openIssueCount =
    (codebaseAnalysis?.quality?.findings?.length ?? 0)
    + (codebaseAnalysis?.dependencyRisk?.advisories?.length ?? 0);

  const handoffReady = Boolean(
    activeProject?.spec.interview?.status === 'completed'
    && (activeProject.spec.frameworkRecommendation || activeProject.spec.frameworkRecommendations?.[0]),
  );

  const desktop = isDesktopApp();

  const utilityActions = (
    <>
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${iconButton}`}
        title={isAiConfigured ? 'AI provider connected — open settings' : 'No AI provider — connect in settings'}
        aria-label={isAiConfigured ? 'AI connected, open settings' : 'Connect AI in settings'}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isAiConfigured
              ? isDark
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]'
                : 'bg-emerald-500'
              : isDark
                ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.35)]'
                : 'bg-rose-500'
          }`}
          aria-hidden
        />
        <Settings2 className="h-4 w-4" />
        <span className="hidden lg:inline">{isAiConfigured ? 'AI connected' : 'Connect AI'}</span>
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        className={`rounded-md p-2 transition-colors ${iconButton}`}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </>
  );

  const leftSlot = inGreenfieldProject && activeProject ? (
    <div className="min-w-0 w-max max-w-[10rem] sm:max-w-xs">
      <ProjectDropdown
        compact
        isOpen={isProjectMenuOpen}
        onClose={() => setIsProjectMenuOpen(false)}
        onToggle={() => setIsProjectMenuOpen(open => !open)}
      />
    </div>
  ) : showHeaderProjectMenu && activeProject ? (
    <div className="min-w-0 w-max max-w-[14rem] sm:max-w-xs">
      <ProjectDropdown
        compact
        isOpen={isProjectMenuOpen}
        onClose={() => setIsProjectMenuOpen(false)}
        onToggle={() => setIsProjectMenuOpen(open => !open)}
      />
    </div>
  ) : isHub ? (
    <button
      type="button"
      onClick={() => setIsCreatingNew(true)}
      className={`text-sm font-semibold transition-colors ${isDark ? 'text-[#C4C6CC] hover:text-white' : 'text-slate-700 hover:text-slate-950'}`}
    >
      Blueprint Studio
    </button>
  ) : null;

  return (
    <header
      className={`flex shrink-0 flex-col ${isDark ? 'bg-[#0C0D0F]' : 'bg-white'}`}
    >
      <DesktopTitlebarStrip />
      <div
        className={`desktop-app-toolbar border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-200'} ${
          showCenterNav
            ? `grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 ${desktop ? 'h-12 px-3 sm:px-4' : 'h-14 px-3 sm:px-4'}`
            : `flex w-full items-center justify-between gap-3 ${desktop ? 'h-12 px-3 sm:px-4' : 'h-14 px-3 sm:px-4'}`
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
          {activeProject && !isCreatingNew && (
            <button
              type="button"
              onClick={goToProjectHome}
              className={`btn-secondary flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium ${isDark ? '' : ''}`}
              title="All projects and new workspace"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}
          {leftSlot}
        </div>

        {showPhaseNav && onSelectTab ? (
          <div className="justify-self-center px-1">
            <PhaseNav
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              handoffReady={handoffReady}
              isDark={isDark}
            />
          </div>
        ) : null}

        {showCodebaseNav ? (
          <div className="justify-self-center px-1">
            <CodebaseSectionNav qualityScore={qualityScore} openIssueCount={openIssueCount} />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center justify-end justify-self-end gap-0.5">
          {showCodebaseNav ? <CodebaseHeaderToolbar /> : null}
          {utilityActions}
        </div>
      </div>
    </header>
  );
};
