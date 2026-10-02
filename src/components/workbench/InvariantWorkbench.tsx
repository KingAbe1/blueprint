import React from 'react';
import { Plus, Database } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const InvariantWorkbench: React.FC = () => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();

  if (!activeProject) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Pre-Flight Invariant Gates
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
            Define unbreachable contracts for <span className="font-semibold">{activeProject.name}</span> before prompting code generation.
          </p>
        </div>

        <button
          className="btn-primary-blue px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Invariant Contract</span>
        </button>
      </div>

      {/* Invariant Rule Empty State */}
      <div className={`p-10 rounded-2xl border text-center space-y-4 ${
        isDark ? 'bg-[#18191E]/60 border-[#27282F]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
          isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
        }`}>
          <Database className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No Invariant Gates Configured Yet
          </h3>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
            Add your first database constraint (e.g. non-nullable money cents, state enum) to generate failing test harnesses.
          </p>
        </div>
        <div>
          <button
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer ${
              isDark 
                ? 'border-[#383944] text-white hover:bg-white/[0.05]' 
                : 'border-slate-300 text-slate-800 hover:bg-slate-50 shadow-xs'
            }`}
          >
            Load Standard Invariants
          </button>
        </div>
      </div>
    </div>
  );
};
