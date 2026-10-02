import React, { useState } from 'react';
import { FolderCode, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const CreateProjectView: React.FC = () => {
  const { projects, activeProjectId, setActiveProjectId, setIsCreatingNew, createProject } = useProjects();
  const { isDark } = useTheme();
  const [inputName, setInputName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    createProject(inputName);
    setInputName('');
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-6 select-none">
      <div className={`w-full max-w-md rounded-2xl border p-7 space-y-6 transition-all animate-in fade-in zoom-in-95 duration-200 ${
        isDark ? 'desktop-card-dark' : 'desktop-card-light'
      }`}>
        {/* Header */}
        <div className="flex items-center space-x-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-600'
          }`}>
            <FolderCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Create New Project
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              What would you like to name this app or project?
            </p>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <input
              type="text"
              className={`w-full text-sm font-medium p-3 rounded-lg outline-none ${
                isDark ? 'studio-input-dark' : 'studio-input-light'
              }`}
              placeholder="e.g. online-store, workout-tracker, billing-system"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              autoFocus
            />
            <div className={`text-[11px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>
              Project folder: ~/blueprint/{inputName.trim() ? inputName.trim().toLowerCase().replace(/\s+/g, '-') : 'project-name'}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className={`flex items-center space-x-1 text-[11px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>
              <CornerDownLeft className="w-3 h-3" />
              <span>Press Enter</span>
            </div>

            <div className="flex items-center space-x-2">
              {projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    if (!activeProjectId && projects.length > 0) {
                      setActiveProjectId(projects[0].id);
                    }
                  }}
                  className={`text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    isDark ? 'text-[#8E8F99] hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!inputName.trim()}
                className="btn-primary-blue disabled:opacity-30 disabled:pointer-events-none px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Recent Projects Quick Select if any exist */}
        {projects.length > 0 && (
          <div className={`pt-4 border-t space-y-2 ${isDark ? 'border-[#23252C]' : 'border-slate-100'}`}>
            <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
              isDark ? 'text-[#71727D]' : 'text-slate-400'
            }`}>
              Or Open Existing Project
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    setIsCreatingNew(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer ${
                    isDark 
                      ? 'bg-[#101114] border-[#23252C] text-slate-300 hover:text-white hover:border-[#32353E]' 
                      : 'bg-[#F8FAFC] border-slate-200/80 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FolderCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{proj.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-[#60616B]' : 'text-slate-400'}`}>Open</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
