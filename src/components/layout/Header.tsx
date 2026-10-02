import React, { useState } from 'react';
import { Sun, Moon, Plus, PanelLeftClose, PanelLeft, Cpu } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { ProjectDropdown } from '../project/ProjectDropdown';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  isSidebarCollapsed = false, 
  onToggleSidebar,
  showSidebarToggle = true
}) => {
  const { projects, isCreatingNew, setIsCreatingNew, activeProject } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { activeConfig, isAiConfigured, setIsSettingsOpen } = useAI();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className={`h-12 border-b px-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl transition-colors duration-200 shrink-0 ${
      isDark 
        ? 'bg-[#121316]/95 border-[#23242A]' 
        : 'bg-white/95 border-slate-200/60 shadow-2xs'
    }`}>
      <div className="flex items-center space-x-2.5">
        {/* Sidebar Collapse/Expand Toggle */}
        {showSidebarToggle && activeProject && !isCreatingNew && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center ${
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

        {/* Logo Mark */}
        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center shadow-sm">
          <div className="w-2 h-2 border-[1.5px] border-white rounded-[1px] rotate-45" />
        </div>

        {/* Project Dropdown / Switcher */}
        <ProjectDropdown
          isOpen={isDropdownOpen}
          onClose={() => setIsDropdownOpen(false)}
          onToggle={() => setIsDropdownOpen(prev => !prev)}
        />
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
