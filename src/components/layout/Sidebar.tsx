import React from 'react';
import { 
  FileText, 
  Database, 
  GitBranch, 
  CheckSquare, 
  Code2, 
  ShieldCheck, 
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { PhaseTab } from '../../types/project';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

interface SidebarProps {
  activeTab: PhaseTab;
  onSelectTab: (tab: PhaseTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();

  if (!activeProject) return null;

  return (
    <aside className={`border-r flex flex-col justify-between transition-all duration-200 shrink-0 select-none overflow-y-auto min-h-0 ${
      isCollapsed ? 'w-14' : 'w-60'
    } ${
      isDark ? 'bg-[#0E0F12] border-[#23252C]' : 'bg-white border-slate-200/60'
    }`}>
      <div className={`${isCollapsed ? 'p-2 space-y-4' : 'p-3.5 space-y-4'}`}>
        
        {/* Phase 1: Planning */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-1 ${
              isDark ? 'text-[#71727D]' : 'text-slate-400'
            }`}>
              Phase 1: Project Blueprint
            </div>
          )}

          <nav className="space-y-0.5">
            <button
              onClick={() => onSelectTab('domain-intent')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-2.5 py-1.5'} rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'domain-intent'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'bg-blue-50 text-blue-700 font-semibold'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="1. Project Overview"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>1. Project Overview</span>}
            </button>

            <button
              onClick={() => onSelectTab('invariants')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-2.5 py-1.5'} rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'invariants'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'bg-blue-50 text-blue-700 font-semibold'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="2. Data & Safety Rules"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>2. Data & Rules</span>}
            </button>

            <button
              onClick={() => onSelectTab('state-machine')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-2.5 py-1.5'} rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'state-machine'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'bg-blue-50 text-blue-700 font-semibold'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="3. Status & Steps Flow"
            >
              <GitBranch className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>3. Status & Steps Flow</span>}
            </button>

            <button
              onClick={() => onSelectTab('tdd-spec')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-2.5 py-1.5'} rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'tdd-spec'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'bg-blue-50 text-blue-700 font-semibold'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="4. Quality Checks"
            >
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>4. Quality Checks</span>}
            </button>
          </nav>
        </div>

        {/* Subsequent Phases */}
        <div className={`space-y-1 ${isCollapsed ? 'pt-1' : 'pt-2'} border-t border-slate-100 dark:border-[#1E2028]`}>
          {!isCollapsed && (
            <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-1 ${
              isDark ? 'text-[#71727D]' : 'text-slate-400'
            }`}>
              Building & Review
            </div>
          )}

          <nav className="space-y-0.5">
            <button
              onClick={() => onSelectTab('in-flight')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-2.5 py-1.5'} rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'in-flight'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'bg-blue-50 text-blue-700 font-semibold'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Phase 2: Generate Code"
            >
              <Code2 className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>Phase 2: Generate Code</span>}
            </button>

            <button
              onClick={() => onSelectTab('post-flight')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'space-x-2 px-2.5 py-1.5'} rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'post-flight'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'bg-blue-50 text-blue-700 font-semibold'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Phase 3: Final Review Checklist"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>Phase 3: Final Review</span>}
            </button>
          </nav>
        </div>

      </div>

      {/* Footer Toggle Bar */}
      <div className={`p-2.5 border-t flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} ${
        isDark ? 'border-[#23252C]' : 'border-slate-100'
      }`}>
        {!isCollapsed && (
          <div className={`text-[11px] font-medium ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>
            Blueprint Studio
          </div>
        )}
        
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`p-1 rounded-md text-xs transition-colors cursor-pointer ${
              isDark ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.06]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={isCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
          >
            {isCollapsed ? (
              <PanelLeft className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
};
