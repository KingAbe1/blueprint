import React, { useEffect, useState } from 'react';
import { AlertTriangle, FolderCode, SearchCode, Trash2, X } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';

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
  const touchedAt = projectToDelete.updatedAt ?? projectToDelete.createdAt;

  const border = overviewBorderClass(isDark);
  const panel = overviewPanelClass(isDark);
  const innerPanel = isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200/90 bg-slate-50/80';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputClass = isDark
    ? 'border-white/[0.08] bg-black/25 text-slate-100 placeholder:text-slate-500 focus:border-rose-500/40'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-400/80';
  const ghostButton = isDark
    ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50';
  const deleteEnabled = isDark
    ? 'border border-rose-500/35 bg-rose-500/[0.14] text-rose-100 hover:border-rose-500/50 hover:bg-rose-500/22'
    : 'border border-rose-600/15 bg-rose-600 text-white hover:bg-rose-700 shadow-[0_1px_2px_rgba(225,29,72,0.18)]';
  const deleteDisabled = isDark
    ? 'border border-white/[0.06] bg-white/[0.02] text-slate-500'
    : 'border border-slate-200/90 bg-slate-100 text-slate-400';

  const handleDelete = () => {
    if (!isConfirmed) return;
    deleteProject(projectToDelete.id);
  };

  const KindIcon = isCodebase ? SearchCode : FolderCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-150 sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setProjectToDelete(null);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-description"
        className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${panel}`}
      >
        <header className={`border-b px-5 py-4 sm:px-6 ${border}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="delete-project-title" className={`text-[15px] font-medium ${titleText}`}>
                  Remove project
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Cannot undo
                </span>
              </div>
              <p id="delete-project-description" className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
                Blueprint data for this workspace is removed from this device. Folders on disk are not deleted.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProjectToDelete(null)}
              aria-label="Close"
              title="Close (Esc)"
              className={`shrink-0 rounded-lg p-2 transition-colors ${isDark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <form
          onSubmit={event => {
            event.preventDefault();
            handleDelete();
          }}
          className="px-5 py-5 sm:px-6"
        >
          <div className={`overflow-hidden rounded-xl border ${innerPanel}`}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${
                  isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-500'
                }`}
              >
                <KindIcon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] ${titleText}`}>{projectToDelete.name}</p>
                <p className={`mt-0.5 text-[11px] ${muted}`}>
                  {isCodebase ? 'Codebase' : 'Blueprint'}
                  {' · '}
                  {formatRelativeTime(touchedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <label htmlFor="delete-project-confirmation" className={`block text-xs ${muted}`}>
              Type{' '}
              <span className={`font-mono text-[11px] ${titleText}`}>{projectToDelete.name}</span>{' '}
              to confirm
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
              className={`w-full rounded-lg border px-3 py-2.5 font-mono text-sm outline-none transition-colors ${inputClass}`}
            />
          </div>

          <footer className={`mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end ${border}`}>
            <button
              type="button"
              onClick={() => setProjectToDelete(null)}
              className={`inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-[13px] font-medium transition-colors ${ghostButton}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmed}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                isConfirmed ? deleteEnabled : deleteDisabled
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Remove project
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
