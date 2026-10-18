import React, { useState } from 'react';
import { ArrowRight, Check, Code2, FileText, LayoutGrid, MonitorCog, Network, Settings2 } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab, Project } from '../../types/project';
import { ProjectDropdown } from '../project/ProjectDropdown';
import { isDesktopApp, isMacOS } from '../../utils/platform';
import { DesktopTitlebarStrip } from './DesktopTitlebarStrip';
import { CodebaseSectionNav } from '../project/CodebaseSectionNav';
import { CodebaseHeaderToolbar } from '../project/CodebaseHeaderToolbar';
import { getGreenfieldPhaseProgress } from '../../services/greenfieldProgress';
import { BRAND_NAME } from '../../constants/brand';
import { BrandMark } from '../common/BrandMark';

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
  { id: 'domain-intent', label: 'Product blueprint', shortLabel: 'brief', icon: FileText },
  { id: 'architecture-map', label: 'Architecture map', shortLabel: 'Map', icon: Network },
  { id: 'in-flight', label: 'Build handoff', shortLabel: 'Handoff', icon: Code2 },
];

function PhaseNav({
  activeTab,
  onSelectTab,
  handoffReady,
  isDark,
  activeProject,
}: {
  activeTab: PhaseTab;
  onSelectTab: (tab: PhaseTab) => void;
  handoffReady: boolean;
  isDark: boolean;
  activeProject: Project | undefined;
}) {
  const track = isDark ? 'border-white/[0.06] bg-[#131417]' : 'border-slate-200/90 bg-white';
  const phases = getGreenfieldPhaseProgress(activeProject, activeTab);

  return (
    <nav
      className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border p-1 ${track}`}
      aria-label="Project phases"
    >
      {PHASE_NAV.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const progress = phases.find(p => p.id === item.id);
        const isLocked = progress?.state === 'locked';
        const isComplete = progress?.state === 'complete';
        const isAvailable = item.id === 'in-flight' ? handoffReady : !isLocked;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!isAvailable}
            onClick={() => isAvailable && onSelectTab(item.id)}
            title={isAvailable ? item.label : `${item.label} · Finish earlier steps first`}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 ${
              isActive
                ? isDark
                  ? 'border-blue-500/30 bg-blue-500/[0.1] text-slate-100'
                  : 'border-blue-200/90 bg-blue-50/70 text-slate-900'
                : isAvailable
                  ? `border-transparent ${isDark ? 'text-slate-400 hover:bg-white/[0.04] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`
                  : `cursor-not-allowed border-transparent ${isDark ? 'text-slate-600' : 'text-slate-300'}`
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                isComplete
                  ? 'bg-blue-500 text-white'
                  : isActive
                    ? isDark
                      ? 'bg-blue-400/90 text-[#0C0D0F]'
                      : 'bg-blue-600 text-white'
                    : isDark
                      ? 'bg-white/[0.08] text-slate-500'
                      : 'bg-slate-200 text-slate-600'
              }`}
              aria-hidden
            >
              {isComplete ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : PHASE_NAV.findIndex(p => p.id === item.id) + 1}
            </span>
            <Icon className={`h-3.5 w-3.5 shrink-0 opacity-80`} />
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
  const { isDark, followsSystem, setIsSystemSettingsOpen } = useTheme();
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

  const architectureReady = Boolean(
    activeProject?.spec.interview?.status === 'completed'
    && (activeProject?.spec.frameworkRecommendation || activeProject?.spec.frameworkRecommendations?.[0]),
  );
  const handoffReady = architectureReady;
  const showArchitectureReadyCta =
    inGreenfieldProject && architectureReady && activeTab === 'domain-intent' && Boolean(onSelectTab);

  const desktop = isDesktopApp();
  const interactiveChrome = desktop ? 'no-drag' : '';
  const aiStatusLabelClass = isHub ? 'inline' : 'hidden lg:inline';
  const hubUtilityRail = isDark
    ? 'border-white/[0.08] bg-white/[0.03]'
    : 'border-slate-200/90 bg-slate-50/90';

  const utilityActions = (
    <div
      className={`flex shrink-0 items-center gap-0.5 ${isHub ? `rounded-lg border px-0.5 py-0.5 ${hubUtilityRail}` : ''}`}
    >
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${interactiveChrome} ${iconButton}`}
        title={isAiConfigured ? 'AI provider connected - open settings' : 'No AI provider - connect in settings'}
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
        <Settings2 className="h-4 w-4 shrink-0" />
        <span className={aiStatusLabelClass}>{isAiConfigured ? 'AI connected' : 'Connect AI'}</span>
      </button>

      <button
        type="button"
        onClick={() => setIsSystemSettingsOpen(true)}
        className={`rounded-md p-2 transition-colors ${interactiveChrome} ${iconButton}`}
        title={
          followsSystem
            ? `System settings — appearance follows system (${isDark ? 'dark' : 'light'})`
            : `System settings — ${isDark ? 'dark' : 'light'} appearance`
        }
        aria-label="Open system settings"
      >
        <MonitorCog className="h-4 w-4" />
      </button>
    </div>
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
      className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${isDark ? 'text-[#C4C6CC] hover:text-white' : 'text-slate-700 hover:text-slate-950'}`}
    >
      <BrandMark className="h-5 w-5" />
      <span>{BRAND_NAME}</span>
    </button>
  ) : null;

  const toolbarHeight = desktop ? 'h-12 px-3 sm:px-4' : 'h-14 px-3 sm:px-4';
  const toolbarLayout = showCenterNav
    ? `grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 ${toolbarHeight}`
    : isHub
      ? `grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 ${toolbarHeight}`
      : `flex w-full items-center justify-between gap-3 ${toolbarHeight}`;

  return (
    <header
      className={`relative z-20 flex shrink-0 flex-col ${isDark ? 'bg-[#0C0D0F]' : 'bg-white'}`}
    >
      <DesktopTitlebarStrip />
      <div
        className={`desktop-app-toolbar border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-200'} ${toolbarLayout} ${
          desktop && isMacOS() ? 'desktop-app-toolbar--macos' : ''
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
              activeProject={activeProject}
            />
          </div>
        ) : null}

        {showCodebaseNav ? (
          <div className="justify-self-center px-1">
            <CodebaseSectionNav qualityScore={qualityScore} openIssueCount={openIssueCount} />
          </div>
        ) : null}

        <div className="flex min-w-0 shrink-0 items-center justify-end justify-self-end gap-1.5">
          {showArchitectureReadyCta ? (
            <button
              type="button"
              onClick={() => onSelectTab?.('architecture-map')}
              className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:inline-flex ${
                isDark
                  ? 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.12]'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Architecture ready
              <ArrowRight className="h-3.5 w-3.5 opacity-80" />
            </button>
          ) : null}
          {showCodebaseNav ? <CodebaseHeaderToolbar /> : null}
          {utilityActions}
        </div>
      </div>
    </header>
  );
};
