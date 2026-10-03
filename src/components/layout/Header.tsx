import React from 'react';
import { Sun, Moon, Plus, PanelLeft, PanelLeftClose, Cpu, Sparkles, HardDrive } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { PhaseTab } from '../../types/project';

interface HeaderProps {
  activeTab?: PhaseTab;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const TAB_META: Record<PhaseTab, { step: string; title: string; accent: string }> = {
  'domain-intent': { step: 'Step 1', title: 'Project Overview & Tech Stack', accent: 'text-blue-400' },
  'invariants': { step: 'Step 2', title: 'Data & Safety Rules', accent: 'text-[#00E5FF]' },
  'state-machine': { step: 'Step 3', title: 'Status & Steps Flow', accent: 'text-violet-400' },
  'tdd-spec': { step: 'Step 4', title: 'Quality Checks', accent: 'text-amber-400' },
  'in-flight': { step: 'Phase 2', title: 'Generate Code', accent: 'text-cyan-400' },
  'post-flight': { step: 'Phase 3', title: 'Final Review Checklist', accent: 'text-rose-400' }
};

export const Header: React.FC<HeaderProps> = ({ 
  activeTab = 'domain-intent',
  isSidebarCollapsed = false, 
  onToggleSidebar,
}) => {
  const { projects, isCreatingNew, setIsCreatingNew, activeProject, storageSource } = useProjects();
  const { isDark, toggleTheme } = useTheme();
  const { activeConfig, isAiConfigured, setIsSettingsOpen } = useAI();

  const tabInfo = TAB_META[activeTab] || TAB_META['domain-intent'];

  return (
    <header className={`h-12 border-b px-5 flex items-center justify-between sticky top-0 z-30 transition-all duration-300 shrink-0 ${
      isDark 
        ? 'bg-[#0A0B0E]/80 backdrop-blur-xl border-white/[0.06]' 
        : 'bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
    }`}>
      <div className="flex items-center space-x-3">
        {/* Sidebar Toggle Button directly next to the step */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center justify-center group ${
              isDark 
                ? 'bg-white/[0.03] border-white/[0.06] text-[#8E8F99] hover:text-white hover:bg-white/[0.06] hover:border-white/[0.1]' 
                : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 shadow-xs'
            }`}
            title={isSidebarCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            )}
          </button>
        )}

        {/* Top-level Step and Title breadcrumb */}
        {activeProject && !isCreatingNew ? (
          <div className="flex items-center space-x-2.5">
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${tabInfo.accent}`}>
              {tabInfo.step}
            </span>
            <span className={`text-xs ${isDark ? 'text-white/10' : 'text-slate-200'}`}>/</span>
            <h1 className={`text-xs sm:text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {tabInfo.title}
            </h1>
          </div>
        ) : (
          <div className="flex items-center space-x-2.5">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
            <h1 className={`text-xs sm:text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isCreatingNew ? 'Create New Project' : 'Workspace Setup'}
            </h1>
          </div>
        )}
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center space-x-2">
        {/* Storage Persistence Indicator */}
        <div
          className={`text-[11px] px-2 py-1 rounded-lg border font-mono transition-all flex items-center space-x-1.5 ${
            storageSource === 'disk'
              ? isDark 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' 
                : 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : isDark
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-amber-300 bg-amber-50 text-amber-700'
          }`}
          title={storageSource === 'disk' ? "Projects automatically saved to disk (.blueprint_store.json) across browser & incognito windows" : "Local Storage fallback"}
        >
          <HardDrive className="w-3 h-3" />
          <span className="font-semibold">{storageSource === 'disk' ? 'Disk Sync' : 'Local'}</span>
        </div>

        {/* AI Key / Provider Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer font-medium flex items-center space-x-1.5 group ${
            isAiConfigured
              ? isDark 
                ? 'border-white/[0.06] bg-white/[0.03] text-slate-200 hover:text-white hover:border-blue-500/40 hover:bg-blue-500/[0.06]' 
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:border-blue-300 hover:bg-blue-50/50'
              : isDark
                ? 'border-white/[0.06] text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] hover:border-white/[0.1]'
                : 'border-slate-200/60 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Configure AI API Keys & Models"
        >
          {isAiConfigured ? (
            <Sparkles className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 transition-colors" />
          ) : (
            <Cpu className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
          )}
          {isAiConfigured ? (
            <div className="flex items-center space-x-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="truncate max-w-[110px]">{activeConfig.name.split(' ')[0]}</span>
            </div>
          ) : (
            <span>Connect AI</span>
          )}
        </button>

        {projects.length > 0 && !isCreatingNew && (
          <button
            onClick={() => setIsCreatingNew(true)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer font-medium flex items-center space-x-1.5 group ${
              isDark 
                ? 'border-white/[0.06] text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] hover:border-white/[0.1]' 
                : 'border-slate-200/60 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 shadow-xs'
            }`}
          >
            <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Project</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center group ${
            isDark 
              ? 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:text-amber-300 hover:bg-amber-500/[0.06] hover:border-amber-500/20' 
              : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 hover:border-blue-200 shadow-xs'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-45" />
          ) : (
            <Moon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-rotate-12" />
          )}
        </button>
      </div>
    </header>
  );
};
