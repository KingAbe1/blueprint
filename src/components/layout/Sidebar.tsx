import React, { useState } from 'react';
import { 
  FileText, 
  Database, 
  GitBranch, 
  CheckSquare, 
  Code2, 
  ShieldCheck, 
  PanelLeftClose,
  PanelLeft,
  Sparkles
} from 'lucide-react';
import { PhaseTab } from '../../types/project';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { ProjectDropdown } from '../project/ProjectDropdown';

interface SidebarProps {
  activeTab: PhaseTab;
  onSelectTab: (tab: PhaseTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PHASE_1_TABS: { id: PhaseTab; icon: typeof FileText; label: string; shortLabel: string; accent: string }[] = [
  { id: 'domain-intent', icon: FileText, label: '1. Project Overview', shortLabel: '1', accent: 'blue' },
  { id: 'invariants', icon: Database, label: '2. Data & Rules', shortLabel: '2', accent: 'emerald' },
  { id: 'state-machine', icon: GitBranch, label: '3. Status & Steps Flow', shortLabel: '3', accent: 'violet' },
  { id: 'tdd-spec', icon: CheckSquare, label: '4. Quality Checks', shortLabel: '4', accent: 'amber' },
];

const PHASE_2_TABS: { id: PhaseTab; icon: typeof Code2; label: string; shortLabel: string; accent: string }[] = [
  { id: 'in-flight', icon: Code2, label: 'Phase 2: Generate Code', shortLabel: '⚡', accent: 'cyan' },
  { id: 'post-flight', icon: ShieldCheck, label: 'Phase 3: Final Review', shortLabel: '✓', accent: 'rose' },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!activeProject) return null;

  const renderNavButton = (tab: typeof PHASE_1_TABS[0]) => {
    const isActive = activeTab === tab.id;
    const Icon = tab.icon;

    return (
      <button
        key={tab.id}
        onClick={() => onSelectTab(tab.id)}
        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'space-x-2.5 px-3 py-2'} rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer text-left group relative ${
          isActive
            ? isDark
              ? 'bg-gradient-to-r from-blue-600/15 to-blue-600/5 text-blue-400 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]'
              : 'bg-gradient-to-r from-blue-50 to-blue-50/30 text-blue-700 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]'
            : isDark
              ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
        title={tab.label}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div className={`absolute ${isCollapsed ? 'left-0 top-1/2 -translate-y-1/2 w-[2px] h-4' : 'left-0 top-1/2 -translate-y-1/2 w-[2px] h-5'} rounded-r-full bg-blue-500 transition-all`} />
        )}

        <div className={`relative ${isActive ? '' : 'group-hover:scale-110'} transition-transform duration-200`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
        </div>
        {!isCollapsed && <span className="truncate">{tab.label}</span>}
      </button>
    );
  };

  return (
    <aside className={`border-r flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0 select-none min-h-0 ${
      isCollapsed ? 'w-14' : 'w-64'
    } ${
      isDark 
        ? 'bg-[#0A0B0E] border-white/[0.06]' 
        : 'bg-white border-slate-200/60'
    }`}>
      {/* Top Header of Sidebar: Logo & Project Switcher */}
      <div className={`h-12 border-b flex items-center shrink-0 px-3 transition-all duration-300 ${
        isDark ? 'border-white/[0.06]' : 'border-slate-200/60'
      } ${isCollapsed ? 'justify-center' : ''}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Logo Mark with gradient */}
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0 group cursor-default">
              <div className="w-2.5 h-2.5 border-[1.5px] border-white rounded-[2px] rotate-45 transition-transform group-hover:scale-110" />
            </div>

            {/* Brand + Project Dropdown / Switcher */}
            <ProjectDropdown
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              onToggle={() => setIsDropdownOpen(prev => !prev)}
            />
          </div>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0 cursor-pointer hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200"
            title="Expand Sidebar (⌘B)"
          >
            <div className="w-2.5 h-2.5 border-[1.5px] border-white rounded-[1px] rotate-45" />
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'p-2 space-y-5' : 'p-3 space-y-5'}`}>
        
        {/* Phase 1: Planning */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-3 py-1.5 flex items-center space-x-1.5 ${
              isDark ? 'text-[#5A5C66]' : 'text-slate-400'
            }`}>
              <Sparkles className="w-3 h-3" />
              <span>Phase 1 · Blueprint</span>
            </div>
          )}

          <nav className="space-y-0.5">
            {PHASE_1_TABS.map(renderNavButton)}
          </nav>
        </div>

        {/* Divider */}
        <div className={`mx-2 ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-100'}`} />

        {/* Subsequent Phases */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-3 py-1.5 flex items-center space-x-1.5 ${
              isDark ? 'text-[#5A5C66]' : 'text-slate-400'
            }`}>
              <Code2 className="w-3 h-3" />
              <span>Building & Review</span>
            </div>
          )}

          <nav className="space-y-0.5">
            {PHASE_2_TABS.map(renderNavButton)}
          </nav>
        </div>

      </div>

      {/* Footer Toggle Bar */}
      <div className={`p-2.5 border-t flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} ${
        isDark ? 'border-white/[0.04]' : 'border-slate-100'
      }`}>
        {!isCollapsed && (
          <div className={`text-[11px] font-medium flex items-center space-x-1.5 ${isDark ? 'text-[#5A5C66]' : 'text-slate-400'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Blueprint Studio</span>
          </div>
        )}
        
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer group ${
              isDark ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.06]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={isCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
          >
            {isCollapsed ? (
              <PanelLeft className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
};
