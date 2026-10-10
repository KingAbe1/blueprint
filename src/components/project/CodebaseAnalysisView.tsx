import React, { useState } from 'react';
import {
  Folder,
  RefreshCw,
  Trash2,
  Terminal,
  Download,
  GitBranch,
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  LayoutDashboard,
  FileCode2,
  ShieldCheck,
  Workflow,
  Database,
  GitCommit,
  ExternalLink,
  KeyRound,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { StartupAndTestsPanel } from './StartupAndTestsPanel';
import { UsefulCommandsPanel } from './UsefulCommandsPanel';
import { LanguageIcon } from './LanguageIcon';
import { FrameworkToolBadge } from './FrameworkToolBadge';
import { CodebaseQualityView } from './CodebaseQualityView';
import { ProjectStructureTree } from './ProjectStructureTree';
import { CodebaseHeroPulse } from './CodebaseHeroPulse';
import { ArchitectureTopologyDiagram } from './ArchitectureTopologyDiagram';
import { LanguageDistributionBar } from './LanguageDistributionBar';
import { DependencyInventoryPanel } from './DependencyInventoryPanel';
import { CodebaseHotspotsPanel } from './CodebaseHotspotsPanel';
import { useTheme } from '../../context/ThemeContext';
import { useGitHub } from '../../context/GitHubContext';
import { parseGitHubRemote } from '../../services/githubService';

export type ProjectSection = 'overview' | 'analysis' | 'quality';

interface CodebaseAnalysisViewProps {
  analysis: CodebaseAnalysis;
  projectId?: string;
  onRescan?: () => Promise<void>;
  onDelete?: () => void;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
}

function readSavedProjectSection(storageKey: string): ProjectSection {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'overview' || saved === 'quality' || saved === 'analysis' ? saved : 'overview';
  } catch {
    return 'overview';
  }
}

export const CodebaseAnalysisView: React.FC<CodebaseAnalysisViewProps> = ({
  analysis,
  projectId,
  onRescan,
  onDelete,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
  const github = useGitHub();
  const navigationStorageKey = `blueprint:project-section:${projectId || analysis.rootPath}`;
  const [activePage, setActivePage] = useState<ProjectSection>(() => readSavedProjectSection(navigationStorageKey));
  const [isRescanning, setIsRescanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [githubTokenInput, setGitHubTokenInput] = useState('');
  const [githubRemoteInput, setGitHubRemoteInput] = useState('');
  const [githubConnectError, setGitHubConnectError] = useState<string | null>(null);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Analysis sub-tab switcher (Files & Structure vs Packages vs Hotspots vs Tests & Scripts)
  const [analysisInspectorTab, setAnalysisInspectorTab] = useState<'packages' | 'hotspots' | 'startup' | 'scripts'>('packages');

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';
  const allScripts = analysis.scripts || [];
  const preferredScriptNames = ['dev', 'start', 'serve', 'build', 'test', 'lint', 'typecheck', 'check', 'tauri:dev'];
  const preferredScripts = preferredScriptNames
    .map(name => allScripts.find(script => script.name === name))
    .filter((script): script is NonNullable<typeof script> => Boolean(script));
  const visibleScripts = (preferredScripts.length > 0 ? preferredScripts : allScripts).slice(0, 8);

  const remote = analysis.git?.remote;
  const githubConnected = github.isConnectedFor(remote, projectId);
  const githubStatus = githubConnected ? github.status : null;
  const supportsGitHub = Boolean(remote && parseGitHubRemote(remote));

  const selectProjectSection = (page: ProjectSection) => {
    try {
      window.localStorage.setItem(navigationStorageKey, page);
    } catch {
      // Ignore storage error
    }
    setActivePage(page);
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction(label);
      setTimeout(() => setCopiedAction(null), 2000);
    } catch {
      // Ignore
    }
  };

  const exportSummaryMarkdown = () => {
    const lines = [
      `# ${analysis.rootName} · Architectural Blueprint Summary`,
      ``,
      `*Scanned on ${new Date(analysis.scannedAt).toLocaleString()} via Blueprint Studio*`,
      ``,
      `## Project Overview`,
      `- **Root Path:** \`${analysis.rootPath}\``,
      `- **Files Scanned:** ${analysis.filesScanned.toLocaleString()}`,
      `- **Source Files:** ${analysis.sourceFiles.toLocaleString()}`,
      `- **Estimated Lines of Code:** ${analysis.quality?.linesOfCode ? analysis.quality.linesOfCode.toLocaleString() : 'N/A'}`,
      `- **Architecture Shape:** ${analysis.architecture?.topology || 'General application'} (${analysis.architecture?.confidence || 'low'} confidence)`,
      `- **Primary Database:** ${analysis.architecture?.database.name || 'Not detected'}`,
      ``,
      `## Languages & Frameworks`,
      `- **Languages:** ${analysis.languages.map(l => `${l.name} (${l.files} files)`).join(', ') || 'N/A'}`,
      `- **Frameworks:** ${analysis.frameworks.join(', ') || 'N/A'}`,
      analysis.nextjs ? `- **Next.js:** ${analysis.nextjs.router} (Next ${analysis.nextjs.version || 'detected'})` : '',
      ``,
      `## Git & Source Control`,
      analysis.git?.tracked ? `- **Branch:** ${analysis.git.branch || 'main'}` : '- Git: Not tracked',
      analysis.git?.remote ? `- **Remote:** \`${analysis.git.remote}\`` : '',
      analysis.git?.latestCommit ? `- **Latest Commit:** ${analysis.git.latestCommit}` : '',
      ``,
      `## Quality & Risk Score`,
      analysis.quality ? `- **Overall Health Score:** ${analysis.quality.score}/100` : '- Quality assessment not calculated',
      analysis.quality?.findings ? `- **Findings Count:** ${analysis.quality.findings.length} findings` : '',
      ``,
      `---`,
      `*Generated with Blueprint Desktop Studio*`,
    ].filter(Boolean).join('\n');

    const blob = new Blob([lines], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysis.rootName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_blueprint_summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedAction('exported');
    setTimeout(() => setCopiedAction(null), 2500);
  };

  return (
    <div className={`relative flex flex-col flex-1 h-full min-h-0 overflow-hidden ${
      isDark ? 'bg-[#0E0F12] text-[#F4F4F6]' : 'bg-[#F6F7F9] text-slate-900'
    }`}>
      {/* ======================================================== */}
      {/* COMPACT NATIVE DESKTOP SUB-HEADER / WORKSPACE TOOLBAR     */}
      {/* ======================================================== */}
      <div className={`flex shrink-0 items-center justify-between px-4 sm:px-6 h-12 border-b select-none z-10 ${
        isDark ? 'border-white/[0.08] bg-[#121316]' : 'border-slate-200/90 bg-white'
      }`}>
        {/* Left: Project identity badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
            <Folder className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs tracking-tight truncate" title={analysis.rootName}>
              {analysis.rootName}
            </span>
            {analysis.rootPath && analysis.rootPath !== analysis.rootName && (
              <span className={`hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border max-w-[200px] truncate ${
                isDark ? 'border-white/[0.06] bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`} title={analysis.rootPath}>
                {analysis.rootPath.includes('/') ? `~/${analysis.rootPath.split('/').filter(Boolean).slice(-2).join('/')}` : analysis.rootPath}
              </span>
            )}
            {analysis.git?.tracked && (
              <span className={`hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
              }`}>
                <GitBranch className="h-2.5 w-2.5" />
                {analysis.git.branch || 'main'}
              </span>
            )}
          </div>
        </div>

        {/* Center: Desktop Segmented Tab Switcher */}
        <nav aria-label="Project sections" className={`flex p-0.5 rounded-lg border ${
          isDark ? 'border-white/[0.08] bg-black/40' : 'border-slate-200 bg-slate-100/90'
        }`}>
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'analysis', label: 'Code Analysis', icon: FileCode2 },
            { id: 'quality', label: 'Quality & Risks', icon: ShieldCheck },
          ].map(tab => {
            const isSelected = activePage === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectProjectSection(tab.id as ProjectSection)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  isSelected
                    ? (isDark
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-semibold')
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? (isDark ? 'text-white' : 'text-blue-600') : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Desktop Action Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => copyToClipboard(`cd "${analysis.rootPath}" && code .`, 'code')}
            title="Open in VS Code (`code .`)"
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isDark
                ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
            }`}
          >
            {copiedAction === 'code' ? <Check className="h-3 w-3 text-emerald-500" /> : <Terminal className="h-3 w-3 text-blue-500" />}
            <span>{copiedAction === 'code' ? 'Copied' : 'VS Code'}</span>
          </button>

          <button
            type="button"
            onClick={rescan}
            disabled={isRescanning}
            title="Re-analyze codebase"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
              isDark
                ? 'border-blue-400/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                : 'border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 shadow-2xs'
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${isRescanning ? 'animate-spin' : ''}`} />
            <span>{isRescanning ? 'Scanning…' : 'Rescan'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreActions(v => !v)}
              className={`p-1 rounded-md border transition-colors ${
                isDark
                  ? 'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="More actions"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showMoreActions && (
              <div
                className={`absolute right-0 mt-1 w-44 rounded-lg border p-1 shadow-xl z-30 ${
                  isDark ? 'border-white/[0.1] bg-[#16171B]' : 'border-slate-200 bg-white'
                }`}
                onMouseLeave={() => setShowMoreActions(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActions(false);
                    exportSummaryMarkdown();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors ${
                    isDark ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Report (.md)</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreActions(false);
                      onDelete();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs text-rose-500 transition-colors ${
                      isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Project</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT SCROLLABLE CONTENT CANVAS                  */}
      {/* ======================================================== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto max-w-[1400px]">
          {scanError && (
            <p role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-500">
              {scanError}
            </p>
          )}

          {analysis.truncated && (
            <div className={`mb-4 rounded-xl border px-3.5 py-2 text-xs ${
              isDark ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              Safety limit reached: Some folders/files in this large repository were skipped.
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 1: OVERVIEW                                      */}
          {/* ---------------------------------------------------- */}
          {activePage === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Desktop KPI Hero Pulse Strip */}
              <CodebaseHeroPulse analysis={analysis} />

              {/* Connected Visual Topology Diagram */}
              <ArchitectureTopologyDiagram analysis={analysis} />

              {/* 2-Column Architecture & Delivery Deep Dive */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: Architecture Signals & Shape */}
                <section className={`rounded-xl border p-5 ${panel}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Workflow className="h-4 w-4 text-blue-500" />
                    <h3 className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Architecture & Data Signals</h3>
                  </div>

                  <div className="space-y-3">
                    <div className={`rounded-lg p-3.5 ${isDark ? 'bg-white/[0.025] border border-white/[0.06]' : 'bg-slate-50 border border-slate-200/70'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-semibold uppercase ${muted}`}>Topology Shape</span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          analysis.architecture?.confidence === 'high'
                            ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700')
                        }`}>
                          {analysis.architecture?.confidence || 'low'} confidence
                        </span>
                      </div>
                      <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {analysis.architecture?.topology || 'Not enough evidence'}
                      </p>
                      <p className={`mt-0.5 text-xs ${muted}`}>
                        {analysis.architecture?.summary}
                      </p>
                    </div>

                    {/* Database Box */}
                    <div className={`rounded-lg p-3.5 ${isDark ? 'bg-white/[0.025] border border-white/[0.06]' : 'bg-slate-50 border border-slate-200/70'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Database className="h-3.5 w-3.5 text-violet-500" />
                        <span className={`text-[10px] font-semibold uppercase ${muted}`}>Storage & Database</span>
                      </div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {analysis.architecture?.database.name || 'Not assessed'}
                      </p>
                      {(analysis.architecture?.database.evidence || []).slice(0, 2).map((item, idx) => (
                        <p key={idx} className={`mt-1 text-[11px] ${muted}`}>• {item}</p>
                      ))}
                    </div>

                    {/* Next.js Profile if available */}
                    {analysis.nextjs && (
                      <div className={`rounded-lg p-3.5 ${isDark ? 'bg-white/[0.025] border border-white/[0.06]' : 'bg-slate-50 border border-slate-200/70'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-semibold uppercase ${muted}`}>Next.js Route Structure</span>
                          {analysis.nextjs.version && <span className="font-mono text-[10px] text-blue-500">v{analysis.nextjs.version}</span>}
                        </div>
                        <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.nextjs.router}</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div className={`p-2 rounded text-center ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                            <p className="font-semibold text-xs">{analysis.nextjs.appRouteCount}</p>
                            <p className={`text-[9px] ${muted}`}>App Pages</p>
                          </div>
                          <div className={`p-2 rounded text-center ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                            <p className="font-semibold text-xs">{analysis.nextjs.pagesRouteCount}</p>
                            <p className={`text-[9px] ${muted}`}>Pages Routes</p>
                          </div>
                          <div className={`p-2 rounded text-center ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                            <p className="font-semibold text-xs">{analysis.nextjs.apiRouteCount}</p>
                            <p className={`text-[9px] ${muted}`}>API Endpoints</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Right Card: Improvement Suggestions & Source Control */}
                <section className={`rounded-xl border p-5 ${panel}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-emerald-500" />
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Source Control & Delivery</h3>
                    </div>
                    {supportsGitHub && !githubConnected && (
                      <button
                        type="button"
                        onClick={openGitHubDialog}
                        className="text-[10px] font-semibold text-blue-500 hover:underline"
                      >
                        Connect GitHub Actions
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className={`rounded-lg p-3.5 ${isDark ? 'bg-white/[0.025] border border-white/[0.06]' : 'bg-slate-50 border border-slate-200/70'}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{analysis.git?.tracked ? 'Git Tracked Repository' : 'Unversioned Local Directory'}</span>
                        {analysis.git?.branch && <span className="font-mono text-[10px] text-emerald-500">{analysis.git.branch}</span>}
                      </div>
                      {analysis.git?.latestCommit && (
                        <p className={`mt-1.5 flex items-center gap-1.5 font-mono text-[11px] truncate ${muted}`}>
                          <GitCommit className="h-3 w-3 shrink-0" />
                          <span className="truncate">{analysis.git.latestCommit}</span>
                        </p>
                      )}
                    </div>

                    {/* Suggestions list */}
                    <div>
                      <p className={`text-[10px] font-semibold uppercase mb-2 ${muted}`}>Recommended Next Steps</p>
                      <div className="space-y-2">
                        {(analysis.suggestions || []).slice(0, 3).map((sug, i) => (
                          <div key={i} className={`p-2.5 rounded-lg border text-xs ${
                            isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200/80 bg-white'
                          }`}>
                            <p className="font-semibold text-xs">{sug.title}</p>
                            <p className={`mt-0.5 text-[11px] leading-4 ${muted}`}>{sug.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 2: CODE ANALYSIS                                 */}
          {/* ---------------------------------------------------- */}
          {activePage === 'analysis' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Language Distribution Bar */}
              <LanguageDistributionBar languages={analysis.languages} />

              {/* 2-Column IDE-style Layout: Left Tree (40%), Right Inspector (60%) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 5 Cols: Searchable Project Structure Tree */}
                <div className="lg:col-span-5 space-y-4">
                  <ProjectStructureTree analysis={analysis} />

                  {/* Summary Box */}
                  <div className={`p-4 rounded-xl border ${panel}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${muted}`}>Repository Volume</p>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                        <p className="text-xl font-semibold">{analysis.filesScanned.toLocaleString()}</p>
                        <p className={`text-[10px] mt-0.5 ${muted}`}>Files Scanned</p>
                      </div>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                        <p className="text-xl font-semibold">{analysis.sourceFiles.toLocaleString()}</p>
                        <p className={`text-[10px] mt-0.5 ${muted}`}>Source Files</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 7 Cols: Inspector Panels Switcher */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Inspector Segmented Switcher */}
                  <div className={`flex items-center justify-between p-1 rounded-xl border ${
                    isDark ? 'border-white/[0.08] bg-black/20' : 'border-slate-200 bg-slate-100/70'
                  }`}>
                    {[
                      { id: 'packages', label: 'Packages' },
                      { id: 'hotspots', label: 'Complexity & Debt' },
                      { id: 'startup', label: 'Entry & Tests' },
                      { id: 'scripts', label: 'Scripts' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAnalysisInspectorTab(tab.id as typeof analysisInspectorTab)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                          analysisInspectorTab === tab.id
                            ? (isDark ? 'bg-[#18191D] text-white shadow-xs border border-white/[0.08]' : 'bg-white text-slate-900 shadow-xs border border-slate-200/70')
                            : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Active Inspector Panel Content */}
                  <div>
                    {analysisInspectorTab === 'packages' && (
                      <DependencyInventoryPanel inventory={analysis.dependencyInventory} />
                    )}
                    {analysisInspectorTab === 'hotspots' && (
                      <CodebaseHotspotsPanel analysis={analysis} />
                    )}
                    {analysisInspectorTab === 'startup' && (
                      <StartupAndTestsPanel analysis={analysis} />
                    )}
                    {analysisInspectorTab === 'scripts' && (
                      <UsefulCommandsPanel scripts={visibleScripts} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 3: QUALITY & RISKS                               */}
          {/* ---------------------------------------------------- */}
          {activePage === 'quality' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <CodebaseQualityView
                analysis={analysis}
                onRescan={rescan}
                isRescanning={isRescanning}
                onUpdateAnalysis={onUpdateAnalysis}
              />
            </div>
          )}
        </div>
      </div>

      {/* GitHub Auth Connect Dialog */}
      {showGitHubDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) setShowGitHubDialog(false); }}>
          <form onSubmit={connectGitHub} className={`max-h-[calc(100vh-32px)] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-2xl ${
            isDark ? 'border-white/[0.1] bg-[#151619] text-white' : 'border-slate-200 bg-white text-slate-900'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-blue-500" />
                  <h2 className="text-sm font-semibold">Connect GitHub Repository</h2>
                </div>
                <p className={`mt-1 text-xs ${muted}`}>Read workflow runs and deployment status for this repository.</p>
              </div>
              <button type="button" onClick={() => setShowGitHubDialog(false)} className={`rounded-md p-1 ${muted}`} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className={`mt-5 block text-[10px] font-semibold uppercase tracking-wide ${muted}`} htmlFor="github-repository-url">GitHub Repository URL</label>
            <input id="github-repository-url" value={githubRemoteInput} onChange={e => setGitHubRemoteInput(e.target.value)} placeholder="https://github.com/owner/repository" className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs outline-none ${
              isDark ? 'border-white/[0.1] bg-black/20 text-white placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
            }`} />
            <label className={`mt-4 block text-[10px] font-semibold uppercase tracking-wide ${muted}`} htmlFor="github-token">Personal Access Token (Read-Only)</label>
            <input id="github-token" type="password" autoComplete="off" value={githubTokenInput} onChange={e => setGitHubTokenInput(e.target.value)} placeholder="github_pat_…" className={`mt-1.5 w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none ${
              isDark ? 'border-white/[0.1] bg-black/20 text-white placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
            }`} />
            {githubConnectError && <p role="alert" className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{githubConnectError}</p>}
            <div className={`mt-5 flex justify-end gap-2 border-t pt-4 ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
              <button type="button" onClick={() => setShowGitHubDialog(false)} className={`rounded-lg px-3 py-2 text-xs ${muted}`}>Cancel</button>
              <button type="submit" disabled={!githubTokenInput.trim() || !parseGitHubRemote(githubRemoteInput) || github.isLoading} className="inline-flex items-center gap-2 rounded-lg btn-primary-blue px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {github.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {github.isLoading ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
