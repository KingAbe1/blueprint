import React, { useState } from 'react';
import { Code2, FileText, Moon, Network, Plus, Settings2, Sun } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab } from '../../types/project';
import { UserProfileDropdown } from '../auth/UserProfileDropdown';
import { ProjectDropdown } from '../project/ProjectDropdown';
import { isDesktopApp } from '../../utils/platform';

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

const LOCAL_STORAGE_TOOLTIP =
  'Stored on this device only. Blueprint does not upload your projects or code to our cloud.';

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
  const { projects, isCreatingNew, setIsCreatingNew, activeProject, storageSource } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { isAiConfigured, setIsSettingsOpen } = useAI();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const iconButton = isDark
    ? 'text-[#8E9098] hover:bg-white/[0.06] hover:text-white'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';

  const inGreenfieldProject = Boolean(activeProject && !activeProject.codebaseAnalysis && !isCreatingNew);
  const isHub = !activeProject || isCreatingNew;
  const showHeaderProjectMenu = Boolean(activeProject?.codebaseAnalysis && !isCreatingNew);
  const showPhaseNav = inGreenfieldProject && Boolean(onSelectTab);

  const handoffReady = Boolean(
    activeProject?.spec.interview?.status === 'completed'
    && (activeProject.spec.frameworkRecommendation || activeProject.spec.frameworkRecommendations?.[0]),
  );

  const storageTooltip = storageSource === 'disk'
    ? `${LOCAL_STORAGE_TOOLTIP} (saved to .blueprint_store.json on this machine.)`
    : LOCAL_STORAGE_TOOLTIP;

  const desktop = isDesktopApp();

  const utilityActions = (
    <>
      <div
        className="flex items-center p-2"
        title={storageTooltip}
        aria-label={storageTooltip}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${storageSource === 'disk' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </div>

      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${iconButton}`}
        title="AI settings"
      >
        <Settings2 className="h-4 w-4" />
        <span className="hidden lg:inline">{isAiConfigured ? 'AI connected' : 'Connect AI'}</span>
      </button>

      {projects.length > 0 && !isCreatingNew && (
        <button
          type="button"
          onClick={() => setIsCreatingNew(true)}
          className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${iconButton}`}
          title="Create a new project"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">New</span>
        </button>
      )}

      <button
        type="button"
        onClick={toggleTheme}
        className={`rounded-md p-2 transition-colors ${iconButton}`}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className={`mx-0.5 h-4 w-px ${isDark ? 'bg-white/[0.1]' : 'bg-slate-200'}`} />

      <UserProfileDropdown />
    </>
  );

  const titlebarSpacer = desktop ? (
    <div className="drag-window h-12 w-[3.25rem] shrink-0 sm:w-[3.5rem]" aria-hidden="true" />
  ) : null;

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
    <div className="flex min-w-0 w-max max-w-md items-center gap-2 text-sm">
      <div className="min-w-0 max-w-[14rem] sm:max-w-xs">
        <ProjectDropdown
          compact
          isOpen={isProjectMenuOpen}
          onClose={() => setIsProjectMenuOpen(false)}
          onToggle={() => setIsProjectMenuOpen(open => !open)}
        />
      </div>
      <span className={`hidden shrink-0 sm:inline ${isDark ? 'text-[#4F5157]' : 'text-slate-300'}`}>/</span>
      <span className={`hidden truncate sm:inline ${isDark ? 'text-[#8E9098]' : 'text-slate-500'}`}>
        Codebase overview
      </span>
    </div>
  ) : isHub ? (
    <span className={`text-sm font-medium ${isDark ? 'text-[#C4C6CC]' : 'text-slate-700'}`}>
      Blueprint Studio
    </span>
  ) : null;

  return (
    <header
      {...(desktop ? { 'data-tauri-drag-region': true } : {})}
      className={`flex shrink-0 flex-col border-b ${isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-white'}`}
    >
      <div
        className={
          showPhaseNav
            ? `drag-window grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 ${desktop ? 'h-12 pl-0 pr-3 sm:pr-4' : 'h-14 px-3 sm:px-4'}`
            : `drag-window flex w-full items-center justify-between gap-3 ${desktop ? 'h-12 pl-0 pr-3 sm:pr-4' : 'h-14 px-3 sm:px-4'}`
        }
      >
        <div className={`flex min-w-0 items-center justify-self-start ${desktop ? 'no-drag' : ''}`}>
          {titlebarSpacer}
          {leftSlot}
        </div>

        {showPhaseNav && onSelectTab ? (
          <div className={`justify-self-center px-1 ${desktop ? 'no-drag' : ''}`}>
            <PhaseNav
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              handoffReady={handoffReady}
              isDark={isDark}
            />
          </div>
        ) : null}

        <div className={`flex shrink-0 items-center justify-end justify-self-end gap-0.5 ${desktop ? 'no-drag' : ''}`}>
          {utilityActions}
        </div>
      </div>
    </header>
  );
};
