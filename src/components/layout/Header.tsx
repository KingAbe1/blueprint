import React from 'react';
import { Moon, PanelLeft, Plus, Settings2, Sun } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab } from '../../types/project';
import { UserProfileDropdown } from '../auth/UserProfileDropdown';

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

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'domain-intent',
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const { projects, isCreatingNew, setIsCreatingNew, activeProject, storageSource } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { isAiConfigured, setIsSettingsOpen } = useAI();

  const iconButton = isDark
    ? 'text-[#8E9098] hover:bg-white/[0.06] hover:text-white'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';

  return (
    <header className={`flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-5 ${
      isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex min-w-0 items-center gap-3">
        {onToggleSidebar && isSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`rounded-md p-2 transition-colors ${iconButton}`}
            title="Expand sidebar (⌘B)"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {activeProject && !isCreatingNew ? (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className={`max-w-48 truncate font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {activeProject.name}
            </span>
            <span className={isDark ? 'text-[#4F5157]' : 'text-slate-300'}>/</span>
            <span className={`truncate ${isDark ? 'text-[#8E9098]' : 'text-slate-500'}`}>
              {activeProject.codebaseAnalysis ? 'Codebase overview' : TAB_TITLES[activeTab]}
            </span>
          </div>
        ) : (
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isCreatingNew ? 'New project' : 'Blueprint Studio'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div
          className={`mr-2 flex items-center gap-1.5 text-[11px] ${isDark ? 'text-[#72747C]' : 'text-slate-400'}`}
          title={storageSource === 'disk' ? 'Saved to disk' : 'Saved in this browser'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${storageSource === 'disk' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="hidden sm:inline">Saved</span>
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

        <div className={`h-4 w-[1px] mx-1 ${isDark ? 'bg-white/[0.1]' : 'bg-slate-200'}`} />

        <UserProfileDropdown />
      </div>
    </header>
  );
};
