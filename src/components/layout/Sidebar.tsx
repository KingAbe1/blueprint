import React from 'react';
import { Layers, Code2, ShieldCheck, Edit3 } from 'lucide-react';
import { PhaseTab } from '../../types/project';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

interface SidebarProps {
  activeTab: PhaseTab;
  onSelectTab: (tab: PhaseTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { activeProject, setEditingProjectId } = useProjects();
  const { isDark } = useTheme();

  if (!activeProject) return null;

  return (
    <aside className={`w-64 border-r flex flex-col justify-between transition-colors ${
      isDark ? 'bg-[#141519]/70 border-[#23242A]' : 'bg-slate-50/60 border-slate-200'
    }`}>
      <div className="p-4 space-y-6">
        <div className="space-y-1">
          <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
            isDark ? 'text-[#71727D]' : 'text-slate-400'
          }`}>
            Engineering Phases
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('pre-flight')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                activeTab === 'pre-flight'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>1. Pre-Flight Gate</span>
            </button>

            <button
              onClick={() => onSelectTab('in-flight')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                activeTab === 'in-flight'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-4 h-4 shrink-0" />
              <span>2. In-Flight Execution</span>
            </button>

            <button
              onClick={() => onSelectTab('post-flight')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                activeTab === 'post-flight'
                  ? isDark
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : isDark
                    ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>3. Post-Flight Audit</span>
            </button>
          </nav>
        </div>

        <div className="space-y-2">
          <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
            isDark ? 'text-[#71727D]' : 'text-slate-400'
          }`}>
            Active Project
          </div>
          <div className={`p-3 rounded-xl border text-xs space-y-2 ${
            isDark ? 'bg-[#18191E] border-[#27282F]' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeProject.name}
              </span>
              <button
                onClick={() => setEditingProjectId(activeProject.id)}
                className={`p-1 rounded cursor-pointer ${
                  isDark ? 'text-[#8E8F99] hover:text-white' : 'text-slate-400 hover:text-slate-800'
                }`}
                title="Rename"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
            <div className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>
              ~/blueprint/{activeProject.name.toLowerCase().replace(/\s+/g, '-')}
            </div>
          </div>
        </div>
      </div>

      <div className={`p-4 border-t flex items-center justify-between ${isDark ? 'border-[#23242A]' : 'border-slate-200'}`}>
        <div className={`text-[11px] ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>
          Blueprint Studio
        </div>
        <div className={`text-[10px] font-mono ${isDark ? 'text-[#60616B]' : 'text-slate-400'}`}>
          v1.0
        </div>
      </div>
    </aside>
  );
};
