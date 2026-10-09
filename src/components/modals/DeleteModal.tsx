import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const DeleteModal: React.FC = () => {
  const { projectToDelete, setProjectToDelete, deleteProject } = useProjects();
  const { isDark } = useTheme();
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    setConfirmation('');
  }, [projectToDelete?.id]);

  useEffect(() => {
    if (!projectToDelete) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectToDelete(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectToDelete, setProjectToDelete]);

  if (!projectToDelete) return null;

  const isConfirmed = confirmation === projectToDelete.name;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 ${isDark ? 'bg-black/40' : 'bg-slate-950/35'}`}
      onMouseDown={event => { if (event.target === event.currentTarget) setProjectToDelete(null); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        className={`w-full max-w-md overflow-hidden rounded-xl border shadow-2xl ${isDark ? 'border-[#30363D] bg-[#161B22] text-[#E6EDF3] shadow-black/50' : 'border-red-200 bg-white text-slate-900'}`}
      >
        <header className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-[#30363D] bg-[#20191B]' : 'border-red-100 bg-red-50/70'}`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 id="delete-project-title" className="text-sm font-semibold">Delete project</h2>
          </div>
          <button type="button" onClick={() => setProjectToDelete(null)} aria-label="Close" className={`rounded-md p-1 ${isDark ? 'text-slate-400 hover:bg-white/[0.08] hover:text-white' : 'text-slate-500 hover:bg-red-100 hover:text-slate-900'}`}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <p className={`text-xs leading-5 ${isDark ? 'text-[#C9D1D9]' : 'text-slate-700'}`}>
            This permanently removes <strong className={isDark ? 'text-white' : 'text-slate-900'}>{projectToDelete.name}</strong> and its saved analysis from Blueprint. Files in the original codebase folder will not be deleted.
          </p>

          <div className={`rounded-lg border p-3 text-[11px] leading-5 ${isDark ? 'border-[#6E363A] bg-[#2A1D20] text-[#FFB4B4]' : 'border-red-200 bg-red-50 text-red-800'}`}>
            This action cannot be undone. Type <strong className="select-all">{projectToDelete.name}</strong> below to confirm.
          </div>

          <div className="space-y-1.5">
            <label htmlFor="delete-project-confirmation" className={`block text-[11px] font-medium ${isDark ? 'text-[#C9D1D9]' : 'text-slate-700'}`}>
              Confirm project name
            </label>
            <input
              id="delete-project-confirmation"
              type="text"
              autoComplete="off"
              autoFocus
              spellCheck={false}
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              placeholder="Type the project name here"
              className={`w-full rounded-md border px-3 py-2 font-mono text-xs outline-none transition-colors ${isDark ? 'border-[#484F58] bg-[#0D1117] text-[#E6EDF3] placeholder:text-[#8B949E] focus:border-blue-500' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'}`}
            />
          </div>
        </div>

        <footer className={`flex justify-end gap-2 border-t px-5 py-4 ${isDark ? 'border-[#30363D] bg-[#1C2128]' : 'border-slate-200 bg-slate-50/70'}`}>
          <button
            type="button"
            onClick={() => setProjectToDelete(null)}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${isDark ? 'border-[#484F58] bg-[#21262D] text-[#C9D1D9] hover:bg-[#30363D]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => isConfirmed && deleteProject(projectToDelete.id)}
            disabled={!isConfirmed}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${isConfirmed
              ? 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700'
              : isDark
                ? 'border-[#484F58] bg-[#30363D] text-[#C9D1D9]'
                : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />Delete project
          </button>
        </footer>
      </div>
    </div>
  );
};
