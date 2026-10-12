import React, { useEffect, useState } from 'react';
import { FolderCode, SearchCode, Trash2, X } from 'lucide-react';
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

  const isCodebase = Boolean(projectToDelete.codebaseAnalysis);
  const isConfirmed = confirmation === projectToDelete.name;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const surface = isDark ? 'border-white/[0.09] bg-[#141518]' : 'border-slate-200/80 bg-white';

  const handleDelete = () => {
    if (!isConfirmed) return;
    deleteProject(projectToDelete.id);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150 ${isDark ? 'bg-black/55' : 'bg-slate-950/40'}`}
      onMouseDown={event => { if (event.target === event.currentTarget) setProjectToDelete(null); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-description"
        className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${surface} ${isDark ? 'shadow-black/50' : 'shadow-slate-900/15'}`}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <div className="flex gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="delete-project-title" className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
                Delete project?
              </h2>
              <p id="delete-project-description" className={`mt-1 text-sm leading-5 ${muted}`}>
                Removes this workspace from Blueprint on this device. Your repo folder on disk is not touched.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProjectToDelete(null)}
            aria-label="Close"
            className={`shrink-0 rounded-lg p-1.5 transition-colors ${isDark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${border} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/80'}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
              {isCodebase ? <SearchCode className="h-4 w-4" /> : <FolderCode className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{projectToDelete.name}</p>
              <p className={`text-[11px] ${muted}`}>{isCodebase ? 'Codebase scan' : 'Product blueprint'}</p>
            </div>
          </div>

          <form
            onSubmit={event => {
              event.preventDefault();
              handleDelete();
            }}
            className="space-y-2"
          >
            <label htmlFor="delete-project-confirmation" className={`block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Type <span className="font-mono">{projectToDelete.name}</span> to confirm
            </label>
            <input
              id="delete-project-confirmation"
              type="text"
              autoComplete="off"
              autoFocus
              spellCheck={false}
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              placeholder={projectToDelete.name}
              className={`w-full rounded-xl px-3.5 py-2.5 font-mono text-sm outline-none ${isDark ? 'studio-input-dark' : 'studio-input-light'}`}
            />
          </form>
        </div>

        <footer className={`flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end ${border} ${isDark ? 'bg-[#0F1012]/50' : 'bg-slate-50/50'}`}>
          <button
            type="button"
            onClick={() => setProjectToDelete(null)}
            className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isConfirmed
              ? isDark
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-red-600 text-white hover:bg-red-700'
              : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200 text-slate-400'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete project
          </button>
        </footer>
      </div>
    </div>
  );
};
