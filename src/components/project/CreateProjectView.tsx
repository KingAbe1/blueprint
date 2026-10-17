import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CornerDownLeft,
  FolderCode,
  Layers,
  Loader2,
  SearchCode,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { getBlueprintHubStatus } from '../../services/greenfieldProgress';
import { CodebaseAnalysis } from '../../types/codebase';
import { Project } from '../../types/project';
import { chooseAndAnalyzeCodebase } from '../../services/codebaseAnalysisLoader';
import { isDesktopApp } from '../../utils/platform';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewPanelClass,
} from './overviewUi';

type EntryMode = 'greenfield' | 'brownfield';

const PENDING_CODEBASE_ANALYSIS_KEY = 'blueprint_pending_codebase_analysis_v1';
const HUB_ENTRY_MODE_KEY = 'blueprint_hub_entry_mode_v1';
const HUB_DRAFT_KEY = 'blueprint_hub_new_project_draft_v1';
const RECENT_COLLAPSED_COUNT = 6;

const SCAN_DELIVERABLES = [
  'Languages, frameworks, and entry points',
  'Folder structure and dependency inventory',
  'Static quality hints and optional AI review',
] as const;

const IDEA_STARTERS = [
  'Fleet dashboard for dispatchers to track drivers and jobs in real time',
  'Internal booking tool for staff to schedule rooms and equipment',
  'B2B SaaS where teams manage projects, tasks, and client updates',
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

function loadSavedEntryMode(): EntryMode {
  try {
    const saved = localStorage.getItem(HUB_ENTRY_MODE_KEY);
    return saved === 'brownfield' ? 'brownfield' : 'greenfield';
  } catch {
    return 'greenfield';
  }
}

function loadHubDraft(): { name: string; idea: string } {
  try {
    const raw = sessionStorage.getItem(HUB_DRAFT_KEY);
    if (!raw) return { name: '', idea: '' };
    const parsed = JSON.parse(raw) as { name?: string; idea?: string };
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      idea: typeof parsed.idea === 'string' ? parsed.idea : '',
    };
  } catch {
    return { name: '', idea: '' };
  }
}

function projectKind(project: Project): 'codebase' | 'blueprint' {
  return project.codebaseAnalysis ? 'codebase' : 'blueprint';
}

function clearHubDraft() {
  try {
    sessionStorage.removeItem(HUB_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export const CreateProjectView: React.FC = () => {
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
    duplicateBlueprintProject,
    isLoaded,
  } = useProjects();
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const { isAiConfigured, setIsSettingsOpen } = useAI();
  const [entryMode, setEntryMode] = useState<EntryMode>(() => loadSavedEntryMode());
  const [inputName, setInputName] = useState(() => loadHubDraft().name);
  const [inputIdea, setInputIdea] = useState(() => loadHubDraft().idea);
  const [isFocused, setIsFocused] = useState(false);
  const [restoringScan, setRestoringScan] = useState<CodebaseAnalysis | null>(() => loadPendingCodebaseAnalysis());
  const [isAnalyzingCodebase, setIsAnalyzingCodebase] = useState(false);
  const [codebaseError, setCodebaseError] = useState<string | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
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

  useEffect(() => {
    try {
      localStorage.setItem(HUB_ENTRY_MODE_KEY, entryMode);
    } catch {
      // ignore
    }
  }, [entryMode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        HUB_DRAFT_KEY,
        JSON.stringify({ name: inputName, idea: inputIdea }),
      );
    } catch {
      // ignore
    }
  }, [inputName, inputIdea]);

  const finishCreate = (created: Project | null) => {
    if (!created) {
      notify.warning('A project with this name already exists. Open it or pick another name.');
      return false;
    }
    setInputName('');
    setInputIdea('');
    clearHubDraft();
    return true;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputName.trim() || duplicateNameProject) return;
    finishCreate(createProject(inputName, inputIdea));
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
    } else {
      void import('../../services/codebaseAnalysisLoader');
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const border = overviewBorderClass(isDark);
  const divide = overviewDivideClass(isDark);
  const panel = overviewPanelClass(isDark);

  const inputClass = isDark
    ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400';

  const primaryActionClass = `inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
    isDark
      ? 'border-blue-500/35 bg-blue-500/[0.12] text-blue-100 hover:border-blue-500/45 hover:bg-blue-500/20'
      : 'border-blue-600/15 bg-blue-600 text-white hover:bg-blue-700 shadow-[0_1px_2px_rgba(37,99,235,0.2)]'
  }`;

  const secondaryActionClass = isDark
    ? 'text-xs font-medium text-slate-400 hover:text-slate-200'
    : 'text-xs font-medium text-slate-500 hover:text-slate-900';

  const chipClass = isDark
    ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-blue-500/30 hover:bg-blue-500/[0.08] hover:text-blue-100'
    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800';

  const desktop = isDesktopApp();
  const openedFromActiveProject = isCreatingNew && Boolean(activeProjectId && activeProject);
  const showPanelDismiss = projects.length > 0 && !openedFromActiveProject;
  const isRestoringLastScan = Boolean(restoringScan);
  const isFirstVisit = projects.length === 0;

  const recentProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
      ),
    [projects],
  );

  const visibleRecent = showAllRecent
    ? recentProjects
    : recentProjects.slice(0, RECENT_COLLAPSED_COUNT);

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
      if (inputName.trim() && !duplicateNameProject) {
        finishCreate(createProject(inputName, inputIdea));
      }
      return;
    }
    event.preventDefault();
  };

  const recentProjectsSection = projects.length > 0 ? (
    <div className={`max-w-lg pt-1 lg:border-t lg:pt-6 ${border}`}>
      <p className={`text-xs ${muted}`}>Recent</p>
      <h2 className={`mt-0.5 text-[15px] font-medium ${titleText}`}>Open a project</h2>
      <div className={`mt-3 overflow-hidden rounded-2xl border ${panel}`}>
        <ul className={`divide-y ${divide}`}>
          {visibleRecent.map(project => {
            const kind = projectKind(project);
            const KindIcon = kind === 'codebase' ? SearchCode : FolderCode;
            const touchedAt = project.updatedAt ?? project.createdAt;
            const statusLine =
              kind === 'blueprint'
                ? getBlueprintHubStatus(project)
                : project.codebaseAnalysis?.rootName ?? 'Codebase scan';
            return (
              <li key={project.id} className="group flex items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    setActiveProjectId(project.id);
                    setIsCreatingNew(false);
                  }}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
                    isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${
                        isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      <KindIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[13px] ${titleText}`}>{project.name}</span>
                      <span className={`mt-0.5 block truncate text-[11px] ${muted}`}>
                        {statusLine}
                        {' · '}
                        {formatRelativeTime(touchedAt)}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className={`h-4 w-4 shrink-0 opacity-30 transition-all group-hover:translate-x-0.5 group-hover:opacity-80 ${muted}`} />
                </button>
                {kind === 'blueprint' ? (
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      duplicateBlueprintProject(project.id);
                      notify.success(`Duplicated “${project.name}” - includes brief, questions, and map`);
                    }}
                    aria-label={`Duplicate ${project.name}`}
                    title="Duplicate blueprint"
                    className={`shrink-0 border-l px-3 ${border} ${
                      isDark ? 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setProjectToDelete(project)}
                  aria-label={`Delete ${project.name}`}
                  title="Delete project"
                  className={`shrink-0 border-l px-3 ${border} ${
                    isDark ? 'text-slate-500 hover:bg-rose-500/10 hover:text-rose-300' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {recentProjects.length > RECENT_COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAllRecent(open => !open)}
          className={`mt-2 text-xs font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
        >
          {showAllRecent ? 'Show fewer' : `Show all ${recentProjects.length} projects`}
        </button>
      ) : null}
      <p className={`mt-3 text-[11px] leading-relaxed ${muted}`}>
        Projects stay on this device. Export JSON from the project menu to back up.
      </p>
    </div>
  ) : null;

  return (
    <div
      className={`desktop-hub-shell relative flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto ${
        isDark ? 'bg-[#0E0F12]' : desktop ? 'bg-[#F6F7F9]' : 'bg-slate-50'
      }`}
    >
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
      <div className="flex min-h-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-24 xl:gap-32">
        <section className="min-w-0 flex-1 lg:max-w-xl lg:pr-4">
          {openedFromActiveProject && (
            <button
              type="button"
              onClick={exitNewProjectFlow}
              className={`mb-5 inline-flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {activeProject?.name}
            </button>
          )}
          <div className="flex items-start gap-3">
            <div
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:flex ${border} ${
                isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-600 shadow-sm'
              }`}
            >
              <Layers className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs ${muted}`}>Blueprint Studio</p>
              <h1 className={`mt-0.5 text-[22px] font-medium leading-snug tracking-tight sm:text-2xl ${titleText}`}>
                {isFirstVisit
                  ? 'Welcome to Blueprint Studio'
                  : openedFromActiveProject
                    ? 'Start something new'
                    : 'Welcome back'}
              </h1>
              <p className={`mt-2 max-w-md text-[13px] leading-relaxed ${muted}`}>
                {isFirstVisit
                  ? 'Create a product blueprint or scan a codebase. Everything stays on this device - export JSON anytime to back up.'
                  : openedFromActiveProject
                    ? 'Pick a path below or reopen a recent project. Everything stays on this device.'
                    : 'Plan a new product blueprint or scan an existing codebase - local only, no cloud upload.'}
              </p>
            </div>
          </div>

          {isFirstVisit ? (
            <div
              className={`mt-5 max-w-lg rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                isDark ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-100/90' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              <p className={`flex items-center gap-2 font-medium ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Your first workspace
              </p>
              <p className={`mt-1.5 ${isDark ? 'text-emerald-100/80' : 'text-emerald-800/90'}`}>
                Add a name on the right to get started - everything stays on this device.
              </p>
            </div>
          ) : null}

          {recentProjectsSection ? (
            <div className="mt-7 lg:hidden">{recentProjectsSection}</div>
          ) : null}

          <p className={`${isFirstVisit ? 'mt-6' : 'mt-8'} text-xs font-medium ${muted}`}>Choose a starting point</p>
          <div className="mt-2 grid max-w-lg gap-2" role="listbox" aria-label="Project entry mode">
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
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${border} ${
                    selected
                      ? isDark
                        ? 'border-blue-500/25 bg-blue-500/[0.04]'
                        : 'border-blue-200/90 bg-blue-50/50'
                      : isDark
                        ? 'bg-white/[0.02] hover:bg-white/[0.04]'
                        : 'bg-white/80 hover:bg-white'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${
                      selected
                        ? isDark
                          ? 'bg-blue-500/10 text-blue-300'
                          : 'bg-blue-50 text-blue-700'
                        : isDark
                          ? 'bg-white/[0.03] text-slate-500'
                          : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[13px] ${titleText}`}>{title}</p>
                      <span className={`shrink-0 text-[10px] tabular-nums ${muted}`}>
                        {mode === 'brownfield' && isAnalyzingCodebase ? 'Scanning…' : idleBadge}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{description}</p>
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
            <div className="mt-8 hidden lg:block">{recentProjectsSection}</div>
          ) : null}
        </section>

        <section
          className={`desktop-panel w-full shrink-0 overflow-hidden rounded-2xl border lg:sticky lg:top-8 lg:w-[min(100%,360px)] lg:max-w-[360px] lg:self-start ${panel}`}
        >
          <div className="px-5 py-6 sm:px-7 sm:py-7">
          {entryMode === 'greenfield' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p className={`text-[10px] font-medium uppercase tracking-wide ${muted}`}>New blueprint</p>
                  <h2 className={`mt-1 text-[15px] font-medium ${titleText}`}>Name & idea</h2>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-project-name" className={`text-xs font-medium ${titleText}`}>
                    Project name
                  </label>
                  <input
                    id="new-project-name"
                    type="text"
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors ${inputClass} ${
                      isFocused ? 'ring-2 ring-blue-500/15' : ''
                    }`}
                    placeholder="e.g. online-store"
                    value={inputName}
                    onChange={event => setInputName(event.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-project-idea" className={`text-xs font-medium ${titleText}`}>
                    One-line idea <span className={`font-normal ${muted}`}>(optional)</span>
                  </label>
                  <textarea
                    id="new-project-idea"
                    rows={3}
                    value={inputIdea}
                    onChange={event => setInputIdea(event.target.value)}
                    onKeyDown={handleIdeaKeyDown}
                    placeholder="Who is it for and what should they be able to do?"
                    className={`w-full resize-none rounded-lg border px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors ${inputClass}`}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {IDEA_STARTERS.map(starter => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setInputIdea(starter)}
                        className={`rounded-lg border px-2 py-1 text-[10px] leading-snug transition-colors ${chipClass}`}
                      >
                        {starter.length > 42 ? `${starter.slice(0, 42)}…` : starter}
                      </button>
                    ))}
                  </div>
                </div>

                {!isAiConfigured ? (
                  <div
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
                      isDark ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-100/90' : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <p>
                      Connect AI for build questions tailored to your product brief.{' '}
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className={`font-semibold underline underline-offset-2 ${isDark ? 'text-amber-50 hover:text-white' : 'text-amber-950'}`}
                      >
                        Open AI settings
                      </button>
                    </p>
                  </div>
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

                <p className={`flex items-center gap-1.5 text-[11px] ${muted}`}>
                  <CornerDownLeft className="h-3 w-3 shrink-0 opacity-70" />
                  {desktop ? 'Ctrl' : '⌘'}+Enter in idea field to create
                </p>

                <div className={`flex flex-wrap items-center justify-end gap-3 border-t pt-4 ${border}`}>
                  {showPanelDismiss ? (
                    <button type="button" onClick={exitNewProjectFlow} className={secondaryActionClass}>
                      Cancel
                    </button>
                  ) : null}
                  <button type="submit" disabled={!inputName.trim() || Boolean(duplicateNameProject)} className={`group ${primaryActionClass}`}>
                    Create blueprint
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-5">
                <p className={`text-[10px] font-medium uppercase tracking-wide ${muted}`}>Existing code</p>
                <h2 className={`mt-1 text-[15px] font-medium ${titleText}`}>Scan a folder</h2>
                <p className={`mt-1 text-xs leading-relaxed ${muted}`}>Read-only on this device.</p>
              </div>
              <ul className={`space-y-2.5 text-[13px] leading-relaxed ${muted}`}>
                {SCAN_DELIVERABLES.map(item => (
                  <li key={item} className="flex gap-2.5">
                    <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>

              <div className={`mt-6 flex flex-col gap-3 border-t pt-4 ${border}`}>
                <p className={`text-[11px] ${muted}`}>
                  {isAnalyzingCodebase ? 'Scanning folder…' : 'Opens your system folder picker'}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {showPanelDismiss ? (
                    <button
                      type="button"
                      onClick={exitNewProjectFlow}
                      disabled={isAnalyzingCodebase}
                      className={secondaryActionClass}
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleAnalyzeCodebase()}
                    disabled={isAnalyzingCodebase}
                    className={`group ${primaryActionClass}`}
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
          </div>
        </section>
        </div>
      </div>
    </div>
  );
};
