import React, { useState } from 'react';
import { Moon, PanelLeft, Plus, Settings2, Sun } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab } from '../../types/project';
import { UserProfileDropdown } from '../auth/UserProfileDropdown';
import { ProjectDropdown } from '../project/ProjectDropdown';

interface HeaderProps {
  activeTab?: PhaseTab;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const TAB_TITLES: Record<PhaseTab, string> = {
  'domain-intent': 'Product blueprint',
  'architecture-map': 'Architecture map',
  'in-flight': 'Build handoff',
};

const LOCAL_STORAGE_TOOLTIP =
  'Stored on this device only. Blueprint does not upload your projects or code to our cloud.';

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'domain-intent',
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const { projects, isCreatingNew, setIsCreatingNew, activeProject, storageSource } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { isAiConfigured, setIsSettingsOpen } = useAI();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const iconButton = isDark
    ? 'text-[#8E9098] hover:bg-white/[0.06] hover:text-white'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';

  const sidebarVisible = Boolean(activeProject && !activeProject.codebaseAnalysis && !isCreatingNew);
  const isHub = !activeProject || isCreatingNew;
  const showHeaderProjectMenu = Boolean(activeProject?.codebaseAnalysis && !isCreatingNew);

  const storageTooltip = storageSource === 'disk'
    ? `${LOCAL_STORAGE_TOOLTIP} (saved to .blueprint_store.json on this machine.)`
    : LOCAL_STORAGE_TOOLTIP;

  return (
    <header className={`flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-5 ${isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-white'
      }`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onToggleSidebar && isSidebarCollapsed && sidebarVisible && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`rounded-md p-2 transition-colors ${iconButton}`}
            title="Expand sidebar (⌘B)"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {sidebarVisible && activeProject ? (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className={`max-w-[10rem] truncate font-medium sm:max-w-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {activeProject.name}
            </span>
            <span className={isDark ? 'text-[#4F5157]' : 'text-slate-300'}>/</span>
            <span className={`truncate ${isDark ? 'text-[#8E9098]' : 'text-slate-500'}`}>
              {TAB_TITLES[activeTab]}
            </span>
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
          <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-[#62646B]' : 'text-slate-400'}`}>
            Blueprint
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
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
    </header>
  );
};
