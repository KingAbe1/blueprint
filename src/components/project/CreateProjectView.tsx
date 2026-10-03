import React, { useState } from 'react';
import { FolderCode, ArrowRight, CornerDownLeft, Sparkles, Layers } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const CreateProjectView: React.FC = () => {
  const { projects, activeProjectId, setActiveProjectId, setIsCreatingNew, createProject } = useProjects();
  const { isDark } = useTheme();
  const [inputName, setInputName] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    createProject(inputName);
    setInputName('');
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-6 select-none relative">
      {/* Subtle ambient background gradient */}
      <div className={`absolute inset-0 pointer-events-none ${
        isDark 
          ? 'bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(59,130,246,0.06),transparent)]' 
          : 'bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(59,130,246,0.04),transparent)]'
      }`} />
      
      <div className={`w-full max-w-md rounded-2xl border p-8 space-y-7 transition-all animate-scale-in relative ${
        isDark ? 'desktop-card-dark' : 'desktop-card-light'
      }`}>
        {/* Header with enhanced visual */}
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative group ${
            isDark 
              ? 'bg-gradient-to-br from-blue-500/15 to-indigo-500/10 border border-blue-500/20 text-blue-400' 
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-blue-600'
          }`}>
            <FolderCode className="w-5 h-5 transition-transform group-hover:scale-110" />
            {/* Subtle glow ring */}
            <div className={`absolute inset-0 rounded-2xl transition-opacity ${
              isDark ? 'shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'shadow-[0_0_20px_rgba(59,130,246,0.06)]'
            }`} />
          </div>
          <div>
            <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Create New Project
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Name your app or project to begin the architecture blueprint.
            </p>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
              isFocused 
                ? isDark 
                  ? 'ring-2 ring-blue-500/20 shadow-[0_0_24px_rgba(59,130,246,0.08)]' 
                  : 'ring-2 ring-blue-500/15 shadow-[0_0_24px_rgba(59,130,246,0.06)]'
                : ''
            }`}>
              <input
                type="text"
                className={`w-full text-sm font-medium p-3.5 rounded-xl outline-none transition-all ${
                  isDark ? 'studio-input-dark' : 'studio-input-light'
                }`}
                placeholder="e.g. online-store, workout-tracker, billing-system"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
              />
            </div>
            <div className={`text-[11px] font-mono flex items-center space-x-1.5 px-1 ${isDark ? 'text-[#5A5C66]' : 'text-slate-400'}`}>
              <Layers className="w-3 h-3" />
              <span>~/blueprint/{inputName.trim() ? inputName.trim().toLowerCase().replace(/\s+/g, '-') : 'project-name'}</span>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className={`flex items-center space-x-1.5 text-[11px] font-mono ${isDark ? 'text-[#5A5C66]' : 'text-slate-400'}`}>
              <CornerDownLeft className="w-3 h-3" />
              <span>Press Enter</span>
            </div>

            <div className="flex items-center space-x-2.5">
              {projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    if (!activeProjectId && projects.length > 0) {
                      setActiveProjectId(projects[0].id);
                    }
                  }}
                  className={`text-xs px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer font-medium ${
                    isDark ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!inputName.trim()}
                className="btn-primary-blue disabled:opacity-30 disabled:pointer-events-none px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center space-x-2 cursor-pointer group"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Recent Projects Quick Select if any exist */}
        {projects.length > 0 && (
          <div className={`pt-5 border-t space-y-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold flex items-center space-x-1.5 ${
              isDark ? 'text-[#5A5C66]' : 'text-slate-400'
            }`}>
              <Sparkles className="w-3 h-3" />
              <span>Or Open Existing Project</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
              {projects.map((proj, idx) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    setIsCreatingNew(false);
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium text-left transition-all duration-200 cursor-pointer group hover-lift ${
                    isDark 
                      ? 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:text-white hover:border-white/[0.12] hover:bg-white/[0.04]' 
                      : 'bg-slate-50/50 border-slate-200/80 text-slate-700 hover:text-slate-900 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <FolderCode className="w-3.5 h-3.5 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="truncate">{proj.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    Open →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
