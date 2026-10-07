import React, { useState } from 'react';
import { FolderCode, ArrowRight, CornerDownLeft, Layers } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const CreateProjectView: React.FC = () => {
  const { projects, activeProjectId, setActiveProjectId, setIsCreatingNew, createProject } = useProjects();
  const { isDark } = useTheme();
  const [inputName, setInputName] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputName.trim()) return;
    createProject(inputName);
    setInputName('');
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const blueprintSteps = [
    ['01', 'Product brief', 'Capture the goal, users, and core capabilities.'],
    ['02', 'Architecture map', 'Turn decisions into an understandable system view.'],
    ['03', 'IDE handoff', 'Package the plan into files your coding agent can use.'],
  ];

  return (
    <div className={`relative flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 py-8 sm:px-8 min-[500px]:items-center min-[500px]:px-10 ${isDark ? 'bg-[#101113]' : 'bg-[radial-gradient(ellipse_at_40%_38%,#ffffff_0%,#f7f9fd_48%,#eef3fa_100%)]'}`}>
      <div
        className="grid w-full max-w-6xl items-center gap-6 lg:gap-16"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 480px)' }}
      >
        <section className="min-w-0">
          <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
            <FolderCode className="h-5 w-5" />
          </div>
          <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Project setup</p>
          <h1 className={`mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-[2.65rem] sm:leading-[1.1] ${isDark ? 'text-white' : 'text-slate-950'}`}>
            Give your project a name.
          </h1>
          <p className={`mt-4 max-w-lg text-sm leading-6 sm:text-base sm:leading-7 ${muted}`}>
            Create a workspace for your product brief, architecture map, and coding-agent handoff.
          </p>

          <div className="mt-8 max-w-lg">
            <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>What you’ll create</p>
            <div className={`mt-3 divide-y rounded-xl border ${isDark ? 'divide-white/[0.06] border-white/[0.08] bg-white/[0.02]' : 'divide-slate-200 border-slate-200 bg-white/60'}`}>
              {blueprintSteps.map(([number, title, description]) => (
                <div key={number} className="flex items-start gap-3 px-3.5 py-3">
                  <span className={`pt-0.5 font-mono text-[10px] font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{number}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{title}</p>
                    <p className={`mt-0.5 text-xs leading-5 ${muted}`}>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {projects.length > 0 && (
            <div className={`mt-7 max-w-lg border-t pt-6 ${divider}`}>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Open a recent project</h2>
              <div className={`mt-2 divide-y ${divider}`}>
                {projects.map(project => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setActiveProjectId(project.id);
                      setIsCreatingNew(false);
                    }}
                    className={`group flex w-full items-center justify-between gap-3 py-3 text-left transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-950'}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FolderCode className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="truncate text-sm font-medium">{project.name}</span>
                    </span>
                    <ArrowRight className={`h-4 w-4 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={`w-full rounded-2xl border p-6 shadow-sm sm:p-7 ${isDark ? 'border-white/[0.09] bg-[#141518]' : 'border-slate-200/80 bg-white/95 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.26)]'}`}>
          <div>
            <h2 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Create a new project</h2>
            <p className={`mt-1.5 text-sm leading-5 ${muted}`}>Choose a name to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-6">
            <div className="space-y-2">
              <label htmlFor="new-project-name" className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Project name</label>
              <div className={`rounded-xl transition-shadow ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}>
                <input
                  id="new-project-name"
                  type="text"
                  className={`w-full rounded-xl border px-4 py-3.5 text-sm font-medium outline-none transition-colors ${
                    isDark
                      ? 'border-white/[0.1] bg-[#0F1012] text-white placeholder:text-slate-600 focus:border-blue-500/70'
                      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                  }`}
                  placeholder="e.g. online-store"
                  value={inputName}
                  onChange={event => setInputName(event.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoFocus
                />
              </div>
              <div className={`inline-flex max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-mono">~/blueprint/{inputName.trim() ? inputName.trim().toLowerCase().replace(/\s+/g, '-') : 'project-name'}</span>
              </div>
            </div>

            <div className={`flex flex-wrap items-center justify-between gap-3 border-t pt-5 ${divider}`}>
              <span className={`flex items-center gap-1.5 text-xs ${muted}`}>
                <CornerDownLeft className="h-3.5 w-3.5" />
                Press Enter to continue
              </span>
              <div className="flex items-center gap-2">
                {projects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      if (!activeProjectId) setActiveProjectId(projects[0].id);
                    }}
                    className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!inputName.trim()}
                    className={`group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:pointer-events-none ${
                    inputName.trim()
                      ? 'btn-primary-blue text-white'
                      : isDark ? 'bg-white/[0.07] text-slate-500' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  Create project
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
