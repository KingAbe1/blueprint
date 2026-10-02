import React from 'react';
import { Plus, Database, ArrowRight } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const InvariantWorkbench: React.FC = () => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();

  if (!activeProject) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto w-full">
      {/* Top Bar */}
      <div className={`px-8 py-5 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#0E0F12]/90 border-[#23252C]' : 'bg-white/90 border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-wider">
            Step 2
          </span>
          <span className={`text-xs ${isDark ? 'text-[#5E606B]' : 'text-slate-300'}`}>/</span>
          <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Database & Schema Invariant Contracts
          </h1>
        </div>

        <button
          className="btn-primary-blue px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Invariant Gate</span>
        </button>
      </div>

      {/* Content Canvas */}
      <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
        <div className={`p-10 rounded-xl border text-center space-y-4 transition-colors ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto ${
            isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Schema Invariants Derived from Domain Spec
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Define SQL CHECK constraints, non-nullable integer cents, and unique composite indexes to lock down data integrity before code synthesis.
            </p>
          </div>
          <div>
            <button
              className="btn-primary-blue px-4 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Define First Table Constraint</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
