import React from 'react';
import { Sun, Moon, Plus, PanelLeft, PanelLeftClose, Cpu } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab } from '../../types/project';

interface HeaderProps {
  activeTab?: PhaseTab;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const TAB_META: Record<PhaseTab, { step: string; title: string }> = {
  'domain-intent': { step: 'Step 1', title: 'Project Overview & Tech Stack' },
  'invariants': { step: 'Step 2', title: 'Data & Safety Rules' },
  'state-machine': { step: 'Step 3', title: 'Status & Steps Flow' },
  'tdd-spec': { step: 'Step 4', title: 'Quality Checks' },
  'in-flight': { step: 'Phase 2', title: 'Generate Code' },
  'post-flight': { step: 'Phase 3', title: 'Final Review Checklist' }
};

export const Header: React.FC<HeaderProps> = ({ 
  activeTab = 'domain-intent',
  isSidebarCollapsed = false, 
  onToggleSidebar,
}) => {
  const { projects, isCreatingNew, setIsCreatingNew, activeProject } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { activeConfig, isAiConfigured, setIsSettingsOpen } = useAI();

  const tabInfo = TAB_META[activeTab] || TAB_META['domain-intent'];

  return (
    <header className={`h-12 border-b px-5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl transition-colors duration-200 shrink-0 ${
      isDark 
        ? 'bg-[#121316]/95 border-[#23242A]' 
        : 'bg-white/95 border-slate-200/60 shadow-2xs'
    }`}>
      <div className="flex items-center space-x-3">
        {/* Sidebar Toggle Button directly next to the step */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              isDark 
                ? 'bg-[#18191E] border-[#27282F] text-[#8E8F99] hover:text-white hover:bg-white/[0.06]' 
                : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-2xs'
            }`}
            title={isSidebarCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Top-level Step and Title breadcrumb */}
        {activeProject && !isCreatingNew ? (
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-wider">
              {tabInfo.step}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#5E606B]' : 'text-slate-300'}`}>/</span>
            <h1 className={`text-xs sm:text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {tabInfo.title}
            </h1>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <h1 className={`text-xs sm:text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isCreatingNew ? 'Create New Project' : 'Workspace Setup'}
            </h1>
          </div>
        )}
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center space-x-2">
        {/* AI Key / Provider Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium flex items-center space-x-1.5 ${
            isAiConfigured
              ? isDark 
                ? 'border-[#2D303B] bg-[#161820] text-slate-200 hover:text-white hover:border-blue-500/50' 
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:border-blue-300'
              : isDark
                ? 'border-[#27282F] text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]'
                : 'border-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          title="Configure AI API Keys & Models"
        >
          <Cpu className={`w-3.5 h-3.5 ${isAiConfigured ? 'text-blue-500' : 'text-slate-400'}`} />
          {isAiConfigured ? (
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate max-w-[110px]">{activeConfig.name.split(' ')[0]}</span>
            </div>
          ) : (
            <span>Connect AI</span>
          )}
        </button>

        {projects.length > 0 && !isCreatingNew && (
          <button
            onClick={() => setIsCreatingNew(true)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium flex items-center space-x-1.5 ${
              isDark 
                ? 'border-[#27282F] text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]' 
                : 'border-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>New Project</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center ${
            isDark 
              ? 'bg-[#1B1C22] border-[#2E3038] text-slate-300 hover:text-white hover:bg-[#25262E]' 
              : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-2xs'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-blue-600" />
          )}
        </button>
      </div>
    </header>
  );
};
