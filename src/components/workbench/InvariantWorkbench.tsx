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
      {/* Content Canvas */}
      <div className="p-8 w-full max-w-7xl mx-auto space-y-6">
        <div className={`p-10 rounded-xl border text-center space-y-4 transition-colors ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto ${
            isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Data Safety Rules & Required Fields
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Ensure important values like prices, email formats, and account balances are always valid and protected from accidental errors.
            </p>
          </div>
          <div>
            <button
              className="btn-primary-blue px-4 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Data Rule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
