import React, { useState } from 'react';
import { Database, ExternalLink, FileCode2, GitBranch, GitCommit, KeyRound, Layers3, Lightbulb, Loader2, RefreshCw, ShieldCheck, Trash2, Workflow, X } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { StartupAndTestsPanel } from './StartupAndTestsPanel';
import { UsefulCommandsPanel } from './UsefulCommandsPanel';
import { LanguageIcon } from './LanguageIcon';
import { FrameworkToolBadge } from './FrameworkToolBadge';
import { CodebaseQualityView } from './CodebaseQualityView';
import { ProjectSection, ProjectSectionNavigation } from './ProjectSectionNavigation';
import { ProjectStructureTree } from './ProjectStructureTree';
import { useTheme } from '../../context/ThemeContext';
import { useGitHub } from '../../context/GitHubContext';
import { parseGitHubRemote } from '../../services/githubService';

interface CodebaseAnalysisViewProps {
  analysis: CodebaseAnalysis;
  projectId?: string;
  onRescan?: () => Promise<void>;
  onDelete?: () => void;
}

function readSavedProjectSection(storageKey: string): ProjectSection {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'overview' || saved === 'quality' || saved === 'analysis' ? saved : 'overview';
  } catch {
    return 'overview';
  }
}

export const CodebaseAnalysisView: React.FC<CodebaseAnalysisViewProps> = ({ analysis, projectId, onRescan, onDelete }) => {
  const { isDark } = useTheme();
  const github = useGitHub();
  const navigationStorageKey = `blueprint:project-section:${projectId || analysis.rootPath}`;
  const [savedSection, setSavedSection] = useState(() => ({
    key: navigationStorageKey,
    page: readSavedProjectSection(navigationStorageKey),
  }));
  const activePage = savedSection.key === navigationStorageKey ? savedSection.page : readSavedProjectSection(navigationStorageKey);
  const [isRescanning, setIsRescanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [githubTokenInput, setGitHubTokenInput] = useState('');
  const [githubRemoteInput, setGitHubRemoteInput] = useState('');
  const [githubConnectError, setGitHubConnectError] = useState<string | null>(null);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';
  const allScripts = analysis.scripts || [];
  const preferredScriptNames = ['dev', 'start', 'serve', 'build', 'test', 'lint', 'typecheck', 'check', 'tauri:dev'];
  const preferredScripts = preferredScriptNames
    .map(name => allScripts.find(script => script.name === name))
    .filter((script): script is NonNullable<typeof script> => Boolean(script));
  const visibleScripts = (preferredScripts.length > 0 ? preferredScripts : allScripts).slice(0, 6);
  const remote = analysis.git?.remote;
  const githubConnected = github.isConnectedFor(remote, projectId);
  const githubStatus = githubConnected ? github.status : null;
  const supportsGitHub = Boolean(remote && parseGitHubRemote(remote));

  const selectProjectSection = (page: ProjectSection) => {
    try {
      window.localStorage.setItem(navigationStorageKey, page);
    } catch {
      // Keep navigation functional when browser storage is unavailable.
    }
    setSavedSection({ key: navigationStorageKey, page });
  };


  const openGitHubDialog = () => {
    setGitHubRemoteInput(remote || '');
    setGitHubTokenInput('');
    setGitHubConnectError(null);
    setShowGitHubDialog(true);
  };

  const connectGitHub = async (event: React.FormEvent) => {
    event.preventDefault();
    setGitHubConnectError(null);
    try {
      await github.connect(githubRemoteInput, githubTokenInput, projectId);
      setGitHubTokenInput('');
      setShowGitHubDialog(false);
    } catch (error) {
      setGitHubConnectError(error instanceof Error ? error.message : 'Could not connect this repository.');
    }
  };


  const rescan = async () => {
    if (!onRescan) return;
    setIsRescanning(true);
    setScanError(null);
    try {
      await onRescan();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not scan this codebase.');
    } finally {
      setIsRescanning(false);
    }
  };

  return (
    <div className={`relative flex min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8 ${isDark ? 'bg-[#101113]' : 'bg-[radial-gradient(ellipse_at_40%_20%,#ffffff_0%,#f7f9fd_48%,#eef3fa_100%)]'}`}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 lg:flex-row lg:gap-8">
        <ProjectSectionNavigation analysis={analysis} activePage={activePage} onSelect={selectProjectSection} />

        <div className="min-w-0 flex-1">
        <header className="mb-7">
          <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Codebase overview</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className={`min-w-0 flex-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-slate-950'}`}>{analysis.rootName}</h1>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onDelete && <button type="button" onClick={onDelete} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${isDark ? 'border-red-400/20 bg-red-400/[0.06] text-red-200 hover:border-red-400/35 hover:bg-red-400/[0.12]' : 'border-red-200 bg-red-50/70 text-red-700 hover:border-red-300 hover:bg-red-50'}`}><Trash2 className="h-3.5 w-3.5" />Delete project</button>}
              {onRescan && <button type="button" onClick={rescan} disabled={isRescanning} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-wait disabled:opacity-60 ${isDark ? 'border-blue-400/35 bg-blue-400/[0.09] text-blue-200 hover:border-blue-300/50 hover:bg-blue-400/[0.15]' : 'border-blue-200 bg-blue-50/80 text-blue-700 hover:border-blue-300 hover:bg-blue-50'}`}>
                <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
                {isRescanning ? 'Analyzing…' : 'Re-analyze codebase'}
              </button>}
            </div>
          </div>
          <p className={`mt-2 break-all font-mono text-xs ${muted}`}>{analysis.rootPath}</p>
          <p className={`mt-4 max-w-3xl text-sm leading-6 ${muted}`}>
            A local, read-only scan of project files and manifests. Source stays on this device unless you choose files to send for an AI review.
          </p>
        </header>

        {scanError && <p role="alert" className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{scanError}</p>}

        {analysis.truncated && (
          <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            This repository is large. The scan reached its safety limit, so some folders and files may be missing from the report.
          </div>
        )}

        <div className="mb-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{activePage === 'overview' ? 'Project overview' : activePage === 'quality' ? 'Quality & risks' : 'Code analysis'}</h2>
          <p className={`mt-1 text-xs ${muted}`}>{activePage === 'overview' ? 'Understand the project shape, data signals, delivery setup, and recommended next steps.' : activePage === 'quality' ? 'Review code health, structure, tests, automation, and evidence-backed follow-ups.' : 'Explore the scanned files, technologies, startup points, tests, and useful commands.'}</p>
        </div>

        {activePage === 'overview' ? <>
        <section className={`mb-4 rounded-2xl border p-5 sm:p-6 ${panel}`}>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-blue-500" />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Architecture and next steps</h2>
          </div>
          <p className={`mt-1 text-xs ${muted}`}>A first-pass assessment from project files and manifests. Confirm these signals by tracing the code.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className={`rounded-xl p-4 ${isDark ? 'bg-white/[0.035]' : 'bg-slate-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Likely project shape</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-700'}`}>{analysis.architecture?.confidence || 'low'} confidence</span>
                </div>
                <p className={`mt-1.5 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.architecture?.topology || 'Not enough evidence'}</p>
                <p className={`mt-1 text-xs leading-5 ${muted}`}>{analysis.architecture?.summary || 'Architecture signals were not available in this saved scan.'}</p>
                {(analysis.architecture?.evidence || []).length > 0 && <ul className={`mt-3 space-y-1 border-t pt-2 text-[11px] ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  {analysis.architecture?.evidence.slice(0, 3).map(item => <li key={item}>• {item}</li>)}
                  </ul>}
              </div>
              {analysis.nextjs && <div className={`rounded-xl border p-4 ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Next.js profile</p><p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.nextjs.router}</p></div>
                  {analysis.nextjs.version && <span className={`rounded-full px-2 py-1 font-mono text-[9px] ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Next {analysis.nextjs.version}</span>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { value: analysis.nextjs.appRouteCount, label: 'App pages' },
                    { value: analysis.nextjs.pagesRouteCount, label: 'Pages routes' },
                    { value: analysis.nextjs.apiRouteCount, label: 'API routes' },
                  ].map(item => <div key={item.label} className={`rounded-lg px-2.5 py-2 ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}><p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.value}</p><p className={`mt-0.5 text-[9px] ${muted}`}>{item.label}</p></div>)}
                </div>
                <p className={`mt-3 text-[9px] font-semibold uppercase tracking-wide ${muted}`}>Route examples · inferred from file names</p>
                {analysis.nextjs.routeExamples.length > 0 ? <ul className="mt-1.5 space-y-1">{analysis.nextjs.routeExamples.slice(0, 4).map(route => <li key={route} className={`truncate font-mono text-[9px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`} title={route}>{route}</li>)}</ul> : <p className={`mt-1 text-[10px] ${muted}`}>No conventional route files were recognized.</p>}
                {(analysis.nextjs.configFiles.length > 0 || analysis.nextjs.requestBoundaryFiles.length > 0 || analysis.nextjs.requestBoundaryNote) && <div className={`mt-3 border-t pt-2 text-[9px] leading-4 ${isDark ? 'border-white/[0.07] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  {analysis.nextjs.configFiles.length > 0 && <>Config: {analysis.nextjs.configFiles.slice(0, 2).join(', ')}. </>}
                  {analysis.nextjs.requestBoundaryFiles.length > 0 && <>Request boundary: {analysis.nextjs.requestBoundaryFiles.slice(0, 2).join(', ')}.</>}
                  {analysis.nextjs.requestBoundaryNote && <p className={`mt-1 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{analysis.nextjs.requestBoundaryNote}</p>}
                </div>}
              </div>}
              <div className={`rounded-xl p-4 ${isDark ? 'bg-white/[0.035]' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-violet-500" /><p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Database signals</p></div>
                <p className={`mt-1.5 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.architecture?.database.name || 'Not assessed'}</p>
                <p className={`mt-1 text-[10px] ${muted}`}>{analysis.architecture?.database.confidence || 'low'} confidence · A missing signal does not prove the project has no database.</p>
                {(analysis.architecture?.database.evidence || []).slice(0, 2).map(item => <p key={item} className={`mt-2 text-[11px] ${muted}`}>{item}</p>)}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2"><Lightbulb className="h-3.5 w-3.5 text-amber-500" /><p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Improvement opportunities</p></div>
              <div className="space-y-2">
                {(analysis.suggestions || []).map((suggestion, index) => <div key={suggestion.title} className={`rounded-xl border p-3.5 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>
                    <div><p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{suggestion.title}</p><p className={`mt-1 text-[11px] leading-5 ${muted}`}>{suggestion.detail}</p></div>
                  </div>
                </div>)}
                {(!analysis.suggestions || analysis.suggestions.length === 0) && <p className={`text-xs ${muted}`}>No improvement signals were available in this saved scan. Re-analyze the codebase to refresh the assessment.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className={`mb-4 rounded-2xl border p-5 sm:p-6 ${panel}`}>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-blue-500" />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Source control and delivery</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl p-3.5 ${isDark ? 'bg-white/[0.035]' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-white text-slate-600'}`}><GitBranch className="h-3.5 w-3.5" /></div>
                <div><p className={`text-[9px] font-semibold uppercase tracking-wide ${muted}`}>Git repository</p><p className={`mt-0.5 text-[11px] font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{analysis.git?.tracked ? analysis.git.branch || 'Git tracked' : analysis.git ? 'Not detected' : 'Not scanned'}</p></div>
              </div>
              {analysis.git?.tracked ? <>
                {analysis.git.remote && <span className={`max-w-full truncate font-mono text-[10px] ${muted}`} title={analysis.git.remote}>{analysis.git.remote}</span>}
                {typeof analysis.git.changedFiles === 'number' && <span className={`text-[10px] ${muted}`}>{analysis.git.changedFiles} changed · {analysis.git.untrackedFiles || 0} untracked</span>}
                {analysis.git.latestCommit && <span className={`flex min-w-0 items-center gap-1.5 text-[10px] ${muted}`} title={analysis.git.latestCommit}><GitCommit className="h-3 w-3 shrink-0" /><span className="max-w-sm truncate">{analysis.git.latestCommit}</span></span>}
                {!analysis.git.branch && <span className={`text-[9px] ${muted}`}>This browser scan can’t read branch or working-tree status.</span>}
              </> : <p className={`text-[10px] ${muted}`}>{analysis.git ? 'No Git repository metadata was detected in the selected folder.' : 'Git information was not captured in this scan. Re-analyze to check.'}</p>}
            </div>
            <div className="min-w-0 grid items-start gap-3 lg:grid-cols-2">
              <div className={`rounded-xl border p-4 ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-slate-700/50 text-slate-200' : 'bg-slate-100 text-slate-700'}`}><GitBranch className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>GitHub Actions & deployments</h3>
                      {githubStatus ? <a href={githubStatus.htmlUrl} target="_blank" rel="noreferrer" className={`mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[10px] ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>{githubStatus.fullName}<ExternalLink className="h-3 w-3 shrink-0" /></a> : <p className={`mt-0.5 text-[10px] ${muted}`}>Live pipeline activity from your repository.</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {githubConnected && <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${isDark ? 'bg-emerald-400/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>CONNECTED</span>}
                    {githubConnected ? <button type="button" onClick={() => void github.refresh()} disabled={github.isLoading} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-medium transition-colors disabled:opacity-60 ${isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Refresh GitHub status">
                      {github.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}{github.isLoading ? 'Refreshing' : 'Refresh'}
                    </button> : <button type="button" onClick={openGitHubDialog} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg btn-primary-blue px-3 text-[10px] font-semibold text-white"><GitBranch className="h-3.5 w-3.5" />Connect GitHub</button>}
                  </div>
                </div>
                {githubStatus ? <>
                  <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
                    <p className={`text-[10px] ${muted}`}>Read-only · default branch <span className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{githubStatus.defaultBranch}</span></p>
                    <button type="button" onClick={github.disconnect} className={`text-[10px] font-medium ${isDark ? 'text-slate-400 hover:text-rose-300' : 'text-slate-500 hover:text-rose-600'}`}>Disconnect</button>
                  </div>
                  {github.error && <p role="alert" className={`mt-3 rounded-lg border px-3 py-2 text-[10px] ${isDark ? 'border-rose-400/20 bg-rose-400/[0.06] text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{github.error}</p>}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className={`min-w-0 rounded-lg border p-3 ${isDark ? 'border-white/[0.06] bg-black/15' : 'border-slate-100 bg-slate-50/70'}`}>
                      <div className="mb-2 flex items-center justify-between gap-2"><p className={`text-[10px] font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Recent workflow runs</p><span className={`text-[9px] ${muted}`}>{githubStatus.runs.length} found</span></div>
                      {githubStatus.runs.length ? <div className="space-y-1.5">{githubStatus.runs.slice(0, 4).map(run => {
                        const result = run.status === 'completed' ? run.conclusion || 'completed' : run.status;
                        const tone = result === 'success' ? (isDark ? 'text-emerald-300 bg-emerald-400/10' : 'text-emerald-700 bg-emerald-50') : ['failure', 'cancelled', 'timed_out', 'action_required'].includes(result) ? (isDark ? 'text-rose-300 bg-rose-400/10' : 'text-rose-700 bg-rose-50') : (isDark ? 'text-amber-200 bg-amber-400/10' : 'text-amber-700 bg-amber-50');
                        return <a key={run.id} href={run.htmlUrl} target="_blank" rel="noreferrer" className={`flex min-h-10 items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-colors ${isDark ? 'bg-white/[0.035] hover:bg-white/[0.07]' : 'bg-white hover:bg-slate-100'}`}>
                          <span className="min-w-0"><span className={`block truncate text-[10px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{run.name}</span><span className={`mt-0.5 block truncate text-[9px] ${muted}`}>{run.branch || run.event} · {new Date(run.updatedAt).toLocaleDateString()}</span></span>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold capitalize ${tone}`}>{result.replaceAll('_', ' ')}</span>
                        </a>;
                      })}</div> : <p className={`rounded-md px-2.5 py-3 text-[10px] ${muted} ${isDark ? 'bg-white/[0.035]' : 'bg-white'}`}>No recent workflow runs were returned.</p>}
                    </div>
                    <div className={`min-w-0 rounded-lg border p-3 ${isDark ? 'border-white/[0.06] bg-black/15' : 'border-slate-100 bg-slate-50/70'}`}>
                      <div className="mb-2 flex items-center justify-between gap-2"><p className={`text-[10px] font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Deployments</p><span className={`text-[9px] ${muted}`}>{githubStatus.deployments.length} found</span></div>
                      {githubStatus.deployments.length ? <div className="space-y-1.5">{githubStatus.deployments.slice(0, 4).map(deployment => {
                        const successful = deployment.state === 'success';
                        const failed = ['failure', 'error', 'inactive'].includes(deployment.state);
                        const tone = successful ? (isDark ? 'text-emerald-300 bg-emerald-400/10' : 'text-emerald-700 bg-emerald-50') : failed ? (isDark ? 'text-rose-300 bg-rose-400/10' : 'text-rose-700 bg-rose-50') : (isDark ? 'text-amber-200 bg-amber-400/10' : 'text-amber-700 bg-amber-50');
                        return <div key={deployment.id} className={`flex min-h-10 items-center justify-between gap-2 rounded-md px-2.5 py-2 ${isDark ? 'bg-white/[0.035]' : 'bg-white'}`}>
                          <span className="min-w-0"><span className={`block truncate text-[10px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{deployment.environment}</span><span className={`mt-0.5 block text-[9px] ${muted}`}>{new Date(deployment.updatedAt).toLocaleDateString()}</span></span>
                          <span className="flex shrink-0 items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[8px] font-semibold capitalize ${tone}`}>{deployment.state}</span>{deployment.environmentUrl && <a href={deployment.environmentUrl} target="_blank" rel="noreferrer" className="text-[9px] font-medium text-blue-500 hover:underline">Open</a>}</span>
                        </div>;
                      })}</div> : <p className={`rounded-md px-2.5 py-3 text-[10px] ${muted} ${isDark ? 'bg-white/[0.035]' : 'bg-white'}`}>No recent deployments were returned.</p>}
                    </div>
                  </div>
                  {githubStatus.warnings.map(warning => <p key={warning} className="mt-2 text-[10px] text-amber-500">{warning}</p>)}
                  <p className={`mt-2 text-right text-[9px] ${muted}`}>{github.isLoading ? 'Updating live status…' : `Last updated ${new Date(githubStatus.fetchedAt).toLocaleString()}`}</p>
                </> : <div className={`mt-3 rounded-lg border border-dashed px-4 py-4 ${isDark ? 'border-white/[0.1] bg-black/10' : 'border-slate-200 bg-slate-50/60'}`}>
                  <p className={`text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Connect a repository to see live pipeline activity</p>
                  <p className={`mt-1 max-w-xl text-[10px] leading-4 ${muted}`}>Blueprint will show recent Actions runs and deployment environments. The read-only token stays on this device until you disconnect.</p>
                  {github.error && <p role="alert" className="mt-2 text-[10px] text-rose-500">The saved GitHub connection could not be refreshed.</p>}
                  {!supportsGitHub && <p className={`mt-2 text-[9px] ${muted}`}>This scan has no GitHub origin. You can enter the repository URL when connecting.</p>}
                </div>}
              </div>

              <div className={`rounded-xl border p-4 ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Workflow files detected in this scan</h3><p className={`mt-0.5 text-[9px] ${muted}`}>Static workflow configuration from the local codebase.</p></div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-medium ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{analysis.pipeline?.workflows.length || 0} found</span>
                </div>
                {analysis.pipeline?.workflows.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {analysis.pipeline.workflows.slice(0, 4).map(workflow => <div key={workflow.path} className={`min-w-0 rounded-lg border p-3 ${isDark ? 'border-white/[0.07] bg-black/15' : 'border-slate-100 bg-slate-50/70'}`}>
                    <p className={`truncate text-[10px] font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{workflow.name}</p>
                    <p className={`mt-1 truncate font-mono text-[9px] ${muted}`} title={workflow.path}>{workflow.path}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{workflow.triggers.map(trigger => <span key={trigger} className={`rounded px-1.5 py-0.5 text-[8px] ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-white text-slate-600'}`}>{trigger}</span>)}{workflow.jobs.slice(0, 3).map(job => <span key={job} className={`rounded px-1.5 py-0.5 text-[8px] ${isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-700'}`}>{job}</span>)}</div>
                    {workflow.deploySignals.length > 0 && <p className={`mt-2 truncate text-[9px] ${muted}`}>Deploys to: {workflow.deploySignals.join(', ')}</p>}
                  </div>)}
                </div> : <p className={`mt-3 rounded-lg px-3 py-3 text-[10px] ${muted} ${isDark ? 'bg-black/15' : 'bg-slate-50'}`}>{analysis.pipeline ? 'No GitHub Actions workflow files were found in the scanned repository.' : 'Workflow files were not included in this saved scan. Re-analyze to inspect them.'}</p>}
                <div className={`mt-3 border-t pt-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
                  <p className={`mb-1.5 text-[9px] font-semibold uppercase tracking-wide ${muted}`}>Deployment configuration</p>
                  {analysis.pipeline?.deploymentTargets.length ? <div className="flex flex-wrap gap-1.5">{analysis.pipeline.deploymentTargets.map(target => <span key={target} className={`rounded-md px-2 py-1 text-[9px] ${isDark ? 'bg-violet-400/10 text-violet-200' : 'bg-violet-50 text-violet-700'}`}>{target}</span>)}</div> : <p className={`text-[10px] ${muted}`}>{analysis.pipeline ? 'No deployment platform was detected in the scanned configuration.' : 'Not assessed in this scan.'}</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        </> : <div className={activePage === 'analysis' ? 'contents' : 'hidden'}><>
        <div className="grid gap-4 lg:grid-cols-3">
          <section className={`rounded-2xl border p-5 ${panel}`}>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-blue-500" />
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Repository size</h2>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>{analysis.filesScanned.toLocaleString()}</p>
                <p className={`mt-1 text-xs ${muted}`}>Files scanned</p>
              </div>
              <div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>{analysis.sourceFiles.toLocaleString()}</p>
                <p className={`mt-1 text-xs ${muted}`}>Source files</p>
              </div>
            </div>
            <div className={`mt-5 border-t pt-4 ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-500"><ShieldCheck className="h-3.5 w-3.5" /> Local read-only scan</div>
              <p className={`mt-1 text-[11px] ${muted}`}>Dependency, build, and cache folders were skipped.</p>
            </div>
          </section>

          <section className={`rounded-2xl border p-5 ${panel}`}>
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-violet-500" />
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Languages and tools</h2>
            </div>
            {analysis.languages.length || analysis.frameworks.length ? (
              <div className="mt-4 space-y-4">
                {analysis.languages.length > 0 && <div>
                  <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Languages</p>
                  <div className="flex flex-wrap gap-2">{analysis.languages.slice(0, 5).map(language => (
                    <LanguageIcon key={language.name} name={language.name} files={language.files} />
                  ))}</div>
                </div>}
                {analysis.frameworks.length > 0 && <div>
                  <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Frameworks and tools</p>
                  <div className="flex flex-wrap gap-1.5">{analysis.frameworks.slice(0, 6).map(name => <FrameworkToolBadge key={name} name={name} />)}</div>
                </div>}
              </div>
            ) : <p className={`mt-4 text-xs ${muted}`}>No common language or framework signals found.</p>}
          </section>

          <ProjectStructureTree analysis={analysis} />

          <StartupAndTestsPanel analysis={analysis} />

          <UsefulCommandsPanel scripts={visibleScripts} />
        </div>

        </></div>}
        <div className={activePage === 'quality' ? 'contents' : 'hidden'}><CodebaseQualityView analysis={analysis} onRescan={rescan} isRescanning={isRescanning} /></div>

        <p className={`mt-5 text-[11px] ${muted}`}>
          Scanned {new Date(analysis.scannedAt).toLocaleString()} · Findings come from file names and selected project manifests.
        </p>
      </div>
      </div>
      {showGitHubDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setShowGitHubDialog(false); }}>
        <form onSubmit={connectGitHub} className={`max-h-[calc(100vh-32px)] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-white/[0.1] bg-[#151619] text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
          <div className="flex items-start justify-between gap-3">
            <div><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-blue-500" /><h2 className="text-sm font-semibold">Connect this GitHub repository</h2></div><p className={`mt-1 text-xs ${muted}`}>Read recent workflow runs and deployment status for this repository.</p></div>
            <button type="button" onClick={() => setShowGitHubDialog(false)} className={`rounded-md p-1 ${muted}`} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className={`mt-4 rounded-xl border p-3.5 ${isDark ? 'border-blue-400/20 bg-blue-400/[0.05]' : 'border-blue-100 bg-blue-50/60'}`}>
            <p className={`text-[11px] font-semibold ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>How to create the token</p>
            <ol className={`mt-2 list-decimal space-y-1.5 pl-4 text-[10px] leading-4 ${muted}`}>
              <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="font-semibold text-blue-500 underline underline-offset-2">Open GitHub’s token page</a> and choose <strong>Generate new token</strong>.</li>
              <li>Give it a name and expiration. Set <strong>Resource owner</strong> to <strong>{parseGitHubRemote(githubRemoteInput)?.owner || 'the organization that owns this repository'}</strong>.</li>
              <li>Under <strong>Repository access</strong>, choose <strong>Only select repositories</strong>, then select this repository.</li>
              <li>Under <strong>Repository permissions</strong>, set <strong>Actions</strong> and <strong>Deployments</strong> to <strong>Read-only</strong>.</li>
              <li>Generate the token, copy it, and paste it below.</li>
            </ol>
            <p className={`mt-2 text-[9px] leading-4 ${muted}`}>If GitHub marks the token as <strong>Pending</strong>, ask an organization admin to approve it. A pending token cannot read this private repository yet.</p>
          </div>
          <label className={`mt-5 block text-[10px] font-semibold uppercase tracking-wide ${muted}`} htmlFor="github-repository-url">GitHub repository URL</label>
          <input id="github-repository-url" value={githubRemoteInput} onChange={event => setGitHubRemoteInput(event.target.value)} placeholder="https://github.com/owner/repository" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs outline-none ${isDark ? 'border-white/[0.1] bg-black/20 text-white placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'}`} />
          <label className={`mt-4 block text-[10px] font-semibold uppercase tracking-wide ${muted}`} htmlFor="github-token">Fine-grained personal access token</label>
          <input id="github-token" type="password" autoComplete="off" value={githubTokenInput} onChange={event => setGitHubTokenInput(event.target.value)} placeholder="github_pat_…" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 font-mono text-xs outline-none ${isDark ? 'border-white/[0.1] bg-black/20 text-white placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'}`} />
          <p className={`mt-1.5 text-[10px] leading-4 ${muted}`}>Blueprint saves the token in this device’s local app storage so it survives refresh. Disconnect to remove it; avoid saving it on a shared device.</p>
          <p className={`mt-2 text-[10px] leading-5 ${muted}`}>Blueprint sends the token only to api.github.com, keeps it in memory, and clears it when the app closes or refreshes.</p>
          {githubConnectError && <p role="alert" className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{githubConnectError}</p>}
          <div className={`mt-5 flex justify-end gap-2 border-t pt-4 ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
            <button type="button" onClick={() => setShowGitHubDialog(false)} className={`rounded-lg px-3 py-2 text-xs ${muted}`}>Cancel</button>
            <button type="submit" disabled={!githubTokenInput.trim() || !parseGitHubRemote(githubRemoteInput) || github.isLoading} className="inline-flex items-center gap-2 rounded-lg btn-primary-blue px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">{github.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{github.isLoading ? 'Connecting…' : 'Connect read-only'}</button>
          </div>
        </form>
      </div>}
    </div>
  );
};
