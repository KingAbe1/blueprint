import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CornerDownLeft, FolderCode, Layers, Loader2, SearchCode, Trash2 } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { CodebaseAnalysis } from '../../types/codebase';
import { Project } from '../../types/project';
import { chooseAndAnalyzeCodebase } from '../../services/codebaseAnalysisService';
import { isDesktopApp } from '../../utils/platform';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

type EntryMode = 'greenfield' | 'brownfield';

const PENDING_CODEBASE_ANALYSIS_KEY = 'blueprint_pending_codebase_analysis_v1';

const SCAN_DELIVERABLES = [
  'Languages, frameworks, and entry points',
  'Folder structure and dependency inventory',
  'Static quality hints and optional AI review',
] as const;

const STARTING_POINTS: {
  mode: EntryMode;
  title: string;
  description: string;
  icon: typeof FolderCode;
  idleBadge: string;
}[] = [
  {
    mode: 'greenfield',
    title: 'Plan a new project',
    description: 'Shape the product brief, architecture, and coding-agent handoff.',
    icon: FolderCode,
    idleBadge: 'New blueprint',
  },
  {
    mode: 'brownfield',
    title: 'Understand an existing codebase',
    description: 'Explore its structure, understand how it works, and plan what to change.',
    icon: SearchCode,
    idleBadge: 'Local scan',
  },
];

function loadPendingCodebaseAnalysis(): CodebaseAnalysis | null {
  try {
    const saved = localStorage.getItem(PENDING_CODEBASE_ANALYSIS_KEY);
    if (!saved) return null;
    const analysis = JSON.parse(saved) as CodebaseAnalysis;
    return typeof analysis.rootName === 'string'
      && typeof analysis.rootPath === 'string'
      && typeof analysis.scannedAt === 'number'
      && Array.isArray(analysis.languages)
      ? analysis
      : null;
  } catch {
    return null;
  }
}

function projectKind(project: Project): 'codebase' | 'blueprint' {
  return project.codebaseAnalysis ? 'codebase' : 'blueprint';
}

export const CreateProjectView: React.FC = () => {
  const { user } = useAuth();
  const {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    setIsCreatingNew,
    isCreatingNew,
    createProject,
    createCodebaseProject,
    setProjectToDelete,
    isLoaded,
  } = useProjects();
  const { isDark } = useTheme();
  const [entryMode, setEntryMode] = useState<EntryMode>('greenfield');
  const [inputName, setInputName] = useState('');
  const [inputIdea, setInputIdea] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [restoringScan, setRestoringScan] = useState<CodebaseAnalysis | null>(() => loadPendingCodebaseAnalysis());
  const [isAnalyzingCodebase, setIsAnalyzingCodebase] = useState(false);
  const [codebaseError, setCodebaseError] = useState<string | null>(null);
  const restoreStarted = useRef(false);
  const createCodebaseProjectRef = useRef(createCodebaseProject);
  createCodebaseProjectRef.current = createCodebaseProject;

  useEffect(() => {
    if (!isLoaded || !restoringScan || restoreStarted.current) return;
    restoreStarted.current = true;
    try {
      localStorage.removeItem(PENDING_CODEBASE_ANALYSIS_KEY);
    } catch {
      // ignore
    }
    createCodebaseProjectRef.current(restoringScan);
    setRestoringScan(null);
  }, [isLoaded, restoringScan]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputName.trim()) return;
    createProject(inputName, inputIdea);
    setInputName('');
    setInputIdea('');
  };

  const handleAnalyzeCodebase = async () => {
    setCodebaseError(null);
    setIsAnalyzingCodebase(true);
    try {
      const analysis = await chooseAndAnalyzeCodebase();
      if (analysis) {
        localStorage.removeItem(PENDING_CODEBASE_ANALYSIS_KEY);
        createCodebaseProject(analysis);
      }
    } catch (error) {
      setCodebaseError(error instanceof Error ? error.message : 'Could not scan this codebase.');
    } finally {
      setIsAnalyzingCodebase(false);
    }
  };

  const exitNewProjectFlow = () => {
    setIsCreatingNew(false);
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  };

  const selectMode = (mode: EntryMode) => {
    setEntryMode(mode);
    setCodebaseError(null);
    if (mode === 'greenfield') {
      requestAnimationFrame(() => document.getElementById('new-project-name')?.focus());
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const panelClass = isDark
    ? 'border-white/[0.09] bg-[#141518]'
    : 'border-slate-200/80 bg-white/95 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.26)]';

  const modeCardClass = (selected: boolean) => {
    if (selected) {
      return isDark ? 'border-blue-400/30 bg-blue-500/[0.08]' : 'border-blue-200 bg-blue-50/70';
    }
    return isDark
      ? 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
      : 'border-slate-200 bg-white/60 hover:border-slate-300 hover:bg-white';
  };

  const desktop = isDesktopApp();
  const openedFromActiveProject = isCreatingNew && Boolean(activeProjectId && activeProject);
  /** Top-of-page back when opened from Home; panel uses Cancel only when not in that flow. */
  const showPanelDismiss = projects.length > 0 && !openedFromActiveProject;
  const isRestoringLastScan = Boolean(restoringScan);

  const recentProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
      ),
    [projects],
  );

  const trimmedName = inputName.trim();
  const duplicateNameProject = useMemo(() => {
    if (!trimmedName) return undefined;
    const lower = trimmedName.toLowerCase();
    return projects.find(p => p.name.trim().toLowerCase() === lower);
  }, [projects, trimmedName]);

  const handleIdeaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      if (inputName.trim()) {
        createProject(inputName, inputIdea);
        setInputName('');
        setInputIdea('');
      }
      return;
    }
    event.preventDefault();
  };

  const recentProjectsSection = projects.length > 0 ? (
    <div className={`max-w-lg pt-1 lg:border-t lg:pt-6 ${divider}`}>
      <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Open a recent project</h2>
      <div className={`mt-2 divide-y ${isDark ? 'divide-white/[0.07]' : 'divide-slate-200/60'}`}>
        {recentProjects.map(project => {
          const kind = projectKind(project);
          const KindIcon = kind === 'codebase' ? SearchCode : FolderCode;
          const touchedAt = project.updatedAt ?? project.createdAt;
          return (
            <div key={project.id} className="group flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveProjectId(project.id);
                  setIsCreatingNew(false);
                }}
                className={`flex min-w-0 flex-1 items-center justify-between gap-3 py-3 text-left transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-950'}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <KindIcon className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{project.name}</span>
                    <span className={`text-[10px] ${muted}`}>
                      {kind === 'codebase' ? 'Codebase scan' : 'Product blueprint'}
                      {' · '}
                      Updated {formatRelativeTime(touchedAt)}
                    </span>
                  </span>
                </span>
                <ArrowRight className={`h-4 w-4 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
              </button>
              <button
                type="button"
                onClick={() => setProjectToDelete(project)}
                aria-label={`Delete ${project.name}`}
                title="Delete project"
                className={`shrink-0 rounded-md p-1.5 opacity-60 transition-colors hover:opacity-100 ${isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-300' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <p className={`mt-4 text-[11px] leading-4 ${muted}`}>
        Stored in this browser&apos;s localStorage. Use{' '}
        <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Export JSON</span>{' '}
        in the project menu to back up.
      </p>
    </div>
  ) : null;

  return (
    <div className={`desktop-hub-shell relative flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto ${isDark ? 'bg-[#101113]' : desktop ? 'bg-[#F5F7FA]' : 'bg-[radial-gradient(ellipse_at_40%_38%,#ffffff_0%,#f7f9fd_48%,#eef3fa_100%)]'}`}>
      {isRestoringLastScan ? (
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 ${isDark ? 'bg-[#101113]/90' : 'bg-white/85'} backdrop-blur-[2px]`}
          role="status"
          aria-live="polite"
        >
          <Loader2 className={`h-8 w-8 animate-spin ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Restoring your last scan…</p>
          <p className={`max-w-xs text-center text-xs leading-5 ${muted}`}>
            Opening {restoringScan?.rootName ?? 'codebase'} as a workspace.
          </p>
        </div>
      ) : null}
      <div className="flex min-h-full items-center justify-center px-5 py-10 sm:px-8 min-[500px]:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:gap-12 xl:max-w-[68rem]">
        <section className="min-w-0 flex-1 lg:max-w-xl">
          {openedFromActiveProject && (
            <button
              type="button"
              onClick={exitNewProjectFlow}
              className={`btn-secondary-accent mb-4 inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {activeProject?.name}
            </button>
          )}
          {!desktop && (
            <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
              <Layers className="h-5 w-5" />
            </div>
          )}
          <p className={`text-xs font-medium ${isDark ? 'text-[#8E9098]' : 'text-slate-500'}`}>
            {user ? user.name : 'Local workspace'}
          </p>
          <h1 className={`max-w-xl font-semibold tracking-tight ${desktop ? `mt-1 text-xl ${isDark ? 'text-white' : 'text-slate-950'}` : `mt-3 text-3xl sm:text-[2.65rem] sm:leading-[1.1] ${isDark ? 'text-white' : 'text-slate-950'}`}`}>
            {openedFromActiveProject && projects.length > 0
              ? 'Your projects'
              : 'Where are we starting?'}
          </h1>
          <p className={`mt-2 max-w-lg text-sm leading-6 ${muted}`}>
            {openedFromActiveProject
              ? 'Open a recent project, start a new blueprint, or scan a codebase. Everything stays on this device.'
              : desktop
                ? 'Plan a product or scan a folder on this machine. Nothing is uploaded to Blueprint cloud.'
                : 'Bring an idea to life or get oriented in a codebase you already have. Projects stay on this device only.'}
          </p>

          {recentProjectsSection ? (
            <div className="mt-7 lg:hidden">{recentProjectsSection}</div>
          ) : null}

          <div className="mt-7 grid max-w-lg gap-3" role="listbox" aria-label="Project entry mode">
            {STARTING_POINTS.map(({ mode, title, description, icon: Icon, idleBadge }) => {
              const selected = entryMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectMode(mode)}
                  disabled={isAnalyzingCodebase}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${modeCardClass(selected)}`}
                >
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected
                    ? isDark ? 'bg-blue-400/10 text-blue-300' : 'bg-white text-blue-700'
                    : isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${selected
                        ? isDark ? 'bg-blue-400/10 text-blue-300' : 'bg-blue-100 text-blue-700'
                        : isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selected ? 'Selected' : mode === 'brownfield' && isAnalyzingCodebase ? 'Scanning…' : idleBadge}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs leading-5 ${muted}`}>{description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {codebaseError && (
            <p role="alert" className="mt-3 max-w-lg rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
              {codebaseError}
            </p>
          )}

          {recentProjectsSection ? (
            <div className="mt-7 hidden lg:block">{recentProjectsSection}</div>
          ) : null}
        </section>

        <section
          className={`desktop-panel w-full shrink-0 border p-5 sm:p-6 lg:sticky lg:top-6 lg:w-[min(100%,400px)] lg:max-w-[400px] lg:self-start ${desktop ? 'rounded-lg' : 'rounded-2xl p-6 shadow-sm sm:p-7'} ${panelClass}`}
        >
          {entryMode === 'greenfield' ? (
            <>
              <h2 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Name your workspace</h2>
              <p className={`mt-1.5 text-sm leading-5 ${muted}`}>
                Pick a name you will recognize in the project list. You will shape the product brief on the next screen.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-6">
                <div className="space-y-2">
                  <label htmlFor="new-project-name" className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Project name
                  </label>
                  <div className={`rounded-xl transition-shadow ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}>
                    <input
                      id="new-project-name"
                      type="text"
                      className={`w-full rounded-xl border px-4 py-3.5 text-sm font-medium outline-none transition-colors ${isDark
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
                </div>

                <div className="space-y-2">
                  <label htmlFor="new-project-idea" className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    One-line idea <span className={`font-normal ${muted}`}>(optional)</span>
                  </label>
                  <textarea
                    id="new-project-idea"
                    rows={2}
                    value={inputIdea}
                    onChange={event => setInputIdea(event.target.value)}
                    onKeyDown={handleIdeaKeyDown}
                    placeholder="Who is it for and what should they be able to do?"
                    className={`w-full resize-none rounded-xl border px-4 py-3 text-sm leading-5 outline-none transition-colors ${isDark
                      ? 'border-white/[0.1] bg-[#0F1012] text-white placeholder:text-slate-600 focus:border-blue-500/70'
                      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                    }`}
                  />
                </div>

                {inputIdea.trim() ? (
                  <p
                    className={`rounded-lg border px-3 py-2 text-xs leading-5 ${
                      isDark
                        ? 'border-blue-500/25 bg-blue-500/10 text-blue-100'
                        : 'border-blue-200 bg-blue-50 text-blue-900'
                    }`}
                  >
                    Your one-line idea will seed the product brief on the next screen. You can edit or expand it there.
                  </p>
                ) : null}

                {duplicateNameProject ? (
                  <p className={`text-xs leading-5 ${isDark ? 'text-amber-200/90' : 'text-amber-800'}`}>
                    You already have &ldquo;{duplicateNameProject.name}&rdquo;.{' '}
                    <button
                      type="button"
                      className={`font-semibold underline underline-offset-2 ${isDark ? 'text-amber-100' : 'text-amber-900'}`}
                      onClick={() => {
                        setActiveProjectId(duplicateNameProject.id);
                        setIsCreatingNew(false);
                      }}
                    >
                      Open it
                    </button>{' '}
                    or use a different name.
                  </p>
                ) : null}

                <div className={`flex flex-wrap items-center justify-between gap-3 border-t pt-5 ${divider}`}>
                  <span className={`flex flex-col gap-0.5 text-xs ${muted} sm:flex-row sm:items-center sm:gap-1.5`}>
                    <span className="inline-flex items-center gap-1.5">
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />
                      Enter in name field to continue
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="text-[11px]">{desktop ? 'Ctrl' : '⌘'}+Enter in idea field</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {showPanelDismiss ? (
                      <button
                        type="button"
                        onClick={exitNewProjectFlow}
                        className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={!inputName.trim()}
                      className={`group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:pointer-events-none ${inputName.trim()
                        ? 'btn-primary-blue text-white'
                        : isDark ? 'bg-white/[0.07] text-slate-500' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      Continue to blueprint
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Choose a folder</h2>
              <p className={`mt-1.5 text-sm leading-5 ${muted}`}>
                Scan a codebase on this device. Blueprint reads structure and manifests only—read-only, nothing uploaded to Blueprint.
              </p>

              <ul className={`mt-5 space-y-2 text-xs leading-5 ${muted}`}>
                {SCAN_DELIVERABLES.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>

              <div className={`mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5 ${divider}`}>
                <span className={`text-xs ${muted}`}>
                  {isAnalyzingCodebase ? 'Scanning…' : 'Opens the system folder picker'}
                </span>
                <div className="flex items-center gap-2">
                  {showPanelDismiss ? (
                    <button
                      type="button"
                      onClick={exitNewProjectFlow}
                      disabled={isAnalyzingCodebase}
                      className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleAnalyzeCodebase()}
                    disabled={isAnalyzingCodebase}
                    className="group inline-flex items-center gap-1.5 rounded-lg btn-primary-blue px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60"
                  >
                    {isAnalyzingCodebase ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Scanning…
                      </>
                    ) : (
                      <>
                        Choose folder
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        </div>
      </div>
    </div>
  );
};
