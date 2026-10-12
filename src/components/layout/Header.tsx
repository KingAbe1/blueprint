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

  const handoffReady = Boolean(
    activeProject?.spec.interview?.status === 'completed'
    && (activeProject.spec.frameworkRecommendation || activeProject.spec.frameworkRecommendations?.[0]),
  );

  const storageTooltip = storageSource === 'disk'
    ? `${LOCAL_STORAGE_TOOLTIP} (saved to .blueprint_store.json on this machine.)`
    : LOCAL_STORAGE_TOOLTIP;

  const desktop = isDesktopApp();

  return (
    <header
      {...(desktop ? { 'data-tauri-drag-region': true } : {})}
      className={`flex shrink-0 flex-col border-b ${isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-white'}`}
    >
      <div
        className={`flex items-center justify-between ${desktop ? 'drag-window h-12 desktop-titlebar-inset pl-4 pr-4 sm:pr-5' : 'h-14 px-4 sm:px-5'}`}
      >
        <div className={`flex min-w-0 flex-1 items-center gap-3 ${desktop ? 'no-drag' : ''}`}>
          {inGreenfieldProject && activeProject ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 max-w-[11rem] sm:max-w-xs">
                <ProjectDropdown
                  compact
                  isOpen={isProjectMenuOpen}
                  onClose={() => setIsProjectMenuOpen(false)}
                  onToggle={() => setIsProjectMenuOpen(open => !open)}
                />
              </div>
              {onSelectTab && (
                <nav
                  className={`hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg border p-0.5 md:flex ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/80'}`}
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
                        className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                          isActive
                            ? isDark ? 'bg-white/[0.08] text-white' : 'bg-white text-slate-900 shadow-xs'
                            : isAvailable
                              ? isDark
                                ? 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                                : 'text-slate-600 hover:bg-white hover:text-slate-900'
                              : isDark ? 'cursor-not-allowed text-[#494B51]' : 'cursor-not-allowed text-slate-300'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-500' : ''}`} />
                        <span className="hidden lg:inline">{item.label}</span>
                        <span className="lg:hidden">{item.shortLabel}</span>
                      </button>
                    );
                  })}
                </nav>
              )}
            </div>
          ) : showHeaderProjectMenu && activeProject ? (
            <div className="flex min-w-0 max-w-md flex-1 items-center gap-2 text-sm">
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
          ) : null}
        </div>

        <div className={`flex shrink-0 items-center gap-1 ${desktop ? 'no-drag' : ''}`}>
          <div
            className="mr-1 flex items-center p-2"
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
            <span className="hidden md:inline">{isAiConfigured ? 'AI connected' : 'Connect AI'}</span>
          </button>

          {projects.length > 0 && !isCreatingNew && (
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${iconButton}`}
              title="Create a new project"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">New</span>
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

          <div className={`mx-1 h-4 w-px ${isDark ? 'bg-white/[0.1]' : 'bg-slate-200'}`} />

          <UserProfileDropdown />
        </div>
      </div>

      {inGreenfieldProject && onSelectTab && (
        <nav
          className={`flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden ${isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-slate-50/50'}`}
          aria-label="Project phases"
        >
          {PHASE_NAV.map(item => {
            const isActive = activeTab === item.id;
            const isAvailable = item.id === 'in-flight' ? handoffReady : true;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!isAvailable}
                onClick={() => isAvailable && onSelectTab(item.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                  isActive
                    ? isDark ? 'bg-white/[0.08] text-white' : 'bg-white text-slate-900 shadow-xs'
                    : isAvailable
                      ? isDark ? 'text-[#92949C]' : 'text-slate-500'
                      : isDark ? 'text-[#494B51]' : 'text-slate-300'
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
