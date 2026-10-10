import React, { useEffect, useRef, useState } from 'react';
import { FolderCode, ArrowRight, CornerDownLeft, Layers, SearchCode, ShieldCheck, Trash2, X } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { CodebaseAnalysis } from '../../types/codebase';
import { chooseAndAnalyzeCodebase, reanalyzeCodebase } from '../../services/codebaseAnalysisService';
import { CodebaseAnalysisView } from './CodebaseAnalysisView';

const PENDING_CODEBASE_ANALYSIS_KEY = 'blueprint_pending_codebase_analysis_v1';

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

export const CreateProjectView: React.FC = () => {
  const { user } = useAuth();
  const { projects, activeProjectId, setActiveProjectId, setIsCreatingNew, createProject, createCodebaseProject, setProjectToDelete, isLoaded } = useProjects();
  const { isDark } = useTheme();
  const [inputName, setInputName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [codebaseAnalysis, setCodebaseAnalysis] = useState<CodebaseAnalysis | null>(loadPendingCodebaseAnalysis);
  const [isAnalyzingCodebase, setIsAnalyzingCodebase] = useState(false);
  const [codebaseError, setCodebaseError] = useState<string | null>(null);
  const [isCodebasePermissionExplainerOpen, setIsCodebasePermissionExplainerOpen] = useState(false);
  const migratedPendingAnalysis = useRef(false);

  useEffect(() => {
    try {
      if (codebaseAnalysis) {
        localStorage.setItem(PENDING_CODEBASE_ANALYSIS_KEY, JSON.stringify(codebaseAnalysis));
      } else {
        localStorage.removeItem(PENDING_CODEBASE_ANALYSIS_KEY);
      }
    } catch {
      // The scan summary is small; keep the current view usable if browser storage is unavailable.
    }
  }, [codebaseAnalysis]);

  useEffect(() => {
    if (!isLoaded || !codebaseAnalysis || migratedPendingAnalysis.current) return;
    migratedPendingAnalysis.current = true;
    localStorage.removeItem(PENDING_CODEBASE_ANALYSIS_KEY);
    createCodebaseProject(codebaseAnalysis);
    setCodebaseAnalysis(null);
  }, [isLoaded, codebaseAnalysis]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputName.trim()) return;
    createProject(inputName);
    setInputName('');
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

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const startingPoints = [
    {
      title: 'Plan a new project',
      description: 'Shape the product brief, architecture, and coding-agent handoff.',
      icon: FolderCode,
      selected: true,
    },
    {
      title: 'Understand an existing codebase',
      description: 'Explore its structure, understand how it works, and plan what to change.',
      icon: SearchCode,
      selected: false,
    },
  ];

  if (codebaseAnalysis) {
    return (
      <CodebaseAnalysisView
        analysis={codebaseAnalysis}
        onRescan={async () => {
          const nextAnalysis = await reanalyzeCodebase(codebaseAnalysis);
          if (nextAnalysis) {
            localStorage.removeItem(PENDING_CODEBASE_ANALYSIS_KEY);
            createCodebaseProject(nextAnalysis);
          }
        }}
      />
    );
  }

  return (
    <div className={`relative flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 py-8 sm:px-8 min-[1024px]:items-center min-[500px]:px-10 ${isDark ? 'bg-[#101113]' : 'bg-[radial-gradient(ellipse_at_40%_38%,#ffffff_0%,#f7f9fd_48%,#eef3fa_100%)]'}`}>
      <div
        className="grid w-full max-w-6xl grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,480px)] lg:gap-16"
      >
        <section className="min-w-0">
          <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex items-center space-x-2">
            <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              {user ? `Welcome, ${user.name}` : 'Start here'}
            </p>
            {user?.role && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}>
                {user.role}
              </span>
            )}
          </div>
          <h1 className={`mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-[2.65rem] sm:leading-[1.1] ${isDark ? 'text-white' : 'text-slate-950'}`}>
            Where are we starting?
          </h1>
          <p className={`mt-4 max-w-lg text-sm leading-6 sm:text-base sm:leading-7 ${muted}`}>
            Bring an idea to life or get oriented in a codebase you already have.
          </p>

          <div className="mt-7 grid max-w-lg gap-3">
            {startingPoints.map(({ title, description, icon: Icon, selected }) => (
              <button
                key={title}
                type="button"
                onClick={() => selected ? document.getElementById('new-project-name')?.focus() : setIsCodebasePermissionExplainerOpen(true)}
                disabled={isAnalyzingCodebase}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${selected
                    ? isDark ? 'border-blue-400/30 bg-blue-500/[0.08]' : 'border-blue-200 bg-blue-50/70'
                    : isDark ? 'border-white/[0.08] bg-white/[0.02] hover:border-blue-400/30 hover:bg-white/[0.04]' : 'border-slate-200 bg-white/60 hover:border-blue-200 hover:bg-white'
                  }`}
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
                      {selected ? 'Selected' : isAnalyzingCodebase ? 'Scanning…' : 'Analyze repository'}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs leading-5 ${muted}`}>{description}</p>
                </div>
              </button>
            ))}
          </div>

          {codebaseError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{codebaseError}</p>}

          {projects.length > 0 && (
            <div className={`mt-7 max-w-lg border-t pt-6 ${divider}`}>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Open a recent project</h2>
              <div className={`mt-2 divide-y ${isDark ? 'divide-white/[0.07]' : 'divide-slate-200/60'}`}>
                {projects.map(project => (
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
                        <FolderCode className="h-4 w-4 shrink-0 text-blue-500" />
                        <span className="truncate text-sm font-medium">{project.name}</span>
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
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={`w-full rounded-2xl border p-6 shadow-sm sm:p-7 ${isDark ? 'border-white/[0.09] bg-[#141518]' : 'border-slate-200/80 bg-white/95 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.26)]'}`}>
          <div>
            <h2 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Plan a new project</h2>
            <p className={`mt-1.5 text-sm leading-5 ${muted}`}>Give your workspace a name to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-6">
            <div className="space-y-2">
              <label htmlFor="new-project-name" className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Project name</label>
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
                  className={`group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:pointer-events-none ${inputName.trim()
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

      {isCodebasePermissionExplainerOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${isDark ? 'bg-black/60' : 'bg-slate-950/55'}`} onMouseDown={event => {
          if (event.target === event.currentTarget) setIsCodebasePermissionExplainerOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="codebase-access-title"
            className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl sm:p-6 ${isDark ? 'border-white/[0.1] bg-[#17181c]' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setIsCodebasePermissionExplainerOpen(false)}
                aria-label="Close"
                className={`rounded-md p-1.5 ${isDark ? 'text-slate-400 hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 id="codebase-access-title" className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>
              Blueprint needs read-only folder access
            </h2>
            <p className={`mt-2 text-sm leading-6 ${muted}`}>
              Choose the codebase you want to understand. Blueprint will scan file names and selected project manifests on this device. It won’t change or upload your files.
            </p>
            <p className={`mt-3 text-xs leading-5 ${muted}`}>
              Your browser will ask you to allow access to the folder next. You can cancel there at any time.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCodebasePermissionExplainerOpen(false)}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCodebasePermissionExplainerOpen(false);
                  void handleAnalyzeCodebase();
                }}
                className="rounded-lg btn-primary-blue px-3.5 py-2 text-xs font-semibold text-white"
              >
                Continue to folder selection
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
