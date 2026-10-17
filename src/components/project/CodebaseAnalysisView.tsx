import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ExternalLink,
  KeyRound,
  X,
  Loader2,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { StartupAndTestsPanel } from './StartupAndTestsPanel';
import { UsefulCommandsPanel } from './UsefulCommandsPanel';
import { CodebaseQualityView } from './CodebaseQualityView';
import { ProjectStructureTree } from './ProjectStructureTree';
import { CodebaseHeroPulse } from './CodebaseHeroPulse';
import {
  CodebaseProjectSection,
  useCodebaseWorkspace,
} from '../../context/CodebaseWorkspaceContext';
import { FrameworkSpecializationPanel } from './FrameworkSpecializationPanel';
import { LanguageDistributionBar } from './LanguageDistributionBar';
import { DependencyInventoryPanel } from './DependencyInventoryPanel';
import { CodebaseHotspotsPanel } from './CodebaseHotspotsPanel';
import { useTheme } from '../../context/ThemeContext';
import { useGitHub } from '../../context/GitHubContext';
import { parseGitHubRemote } from '../../services/githubService';

export type ProjectSection = CodebaseProjectSection;

interface IDEOption {
  id: string;
  name: string;
  shortName: string;
  getProtocolUrl: (path: string) => string;
  getCliCommand: (path: string) => string;
}

const SUPPORTED_IDES: IDEOption[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    shortName: 'VS Code',
    getProtocolUrl: (path) => `vscode://file/${encodeURI(path)}`,
    getCliCommand: (path) => `code "${path}"`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    shortName: 'Cursor',
    getProtocolUrl: (path) => `cursor://file/${encodeURI(path)}`,
    getCliCommand: (path) => `cursor "${path}"`,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    shortName: 'Windsurf',
    getProtocolUrl: (path) => `windsurf://file/${encodeURI(path)}`,
    getCliCommand: (path) => `windsurf "${path}"`,
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    shortName: 'WebStorm',
    getProtocolUrl: (path) => `webstorm://open?file=${encodeURI(path)}`,
    getCliCommand: (path) => `webstorm "${path}"`,
  },
  {
    id: 'idea',
    name: 'IntelliJ IDEA',
    shortName: 'IntelliJ',
    getProtocolUrl: (path) => `idea://open?file=${encodeURI(path)}`,
    getCliCommand: (path) => `idea "${path}"`,
  },
  {
    id: 'zed',
    name: 'Zed',
    shortName: 'Zed',
    getProtocolUrl: (path) => `zed://file/${encodeURI(path)}`,
    getCliCommand: (path) => `zed "${path}"`,
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    shortName: 'Sublime',
    getProtocolUrl: (path) => `subl://open?url=file://${encodeURI(path)}`,
    getCliCommand: (path) => `subl "${path}"`,
  },
];

interface CodeAnalysisInspectorProps {
  analysis: CodebaseAnalysis;
  visibleScripts: NonNullable<CodebaseAnalysis['scripts']>;
  onOpenQualityTab?: () => void;
}

const CodeAnalysisInspector: React.FC<CodeAnalysisInspectorProps> = React.memo(({
  analysis,
  visibleScripts,
  onOpenQualityTab,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'packages' | 'hotspots' | 'startup' | 'scripts'>('packages');
  const advisoryCount = analysis.dependencyRisk?.advisories?.length ?? 0;
  const packageCount = analysis.dependencyInventory?.packages.length || 0;

  return (
    <div className="lg:col-span-7 space-y-4">
      {/* Inspector Segmented Switcher */}
      <div className={`flex items-center justify-between p-1 rounded-xl border ${
        isDark ? 'border-white/[0.08] bg-black/25' : 'border-slate-200 bg-slate-100/70'
      }`}>
        {[
          {
            id: 'packages',
            label: advisoryCount > 0
              ? `Packages (${packageCount}) · ${advisoryCount} CVE`
              : `Packages (${packageCount})`,
          },
          { id: 'hotspots', label: 'Hotspots' },
          { id: 'startup', label: 'Run & test' },
          { id: 'scripts', label: `Scripts (${analysis.scripts?.length || 0})` },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? (isDark ? 'bg-[#1E2024] text-white shadow-xs border border-white/[0.08]' : 'bg-white text-slate-900 shadow-xs border border-slate-200/70')
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Inspector Panel Content */}
      <div>
        <div className={activeTab === 'packages' ? 'block' : 'hidden'}>
          <DependencyInventoryPanel
            inventory={analysis.dependencyInventory}
            dependencyRisk={analysis.dependencyRisk}
            onViewSecurityDetails={onOpenQualityTab}
          />
        </div>
        <div className={activeTab === 'hotspots' ? 'block' : 'hidden'}>
          <CodebaseHotspotsPanel analysis={analysis} />
        </div>
        <div className={activeTab === 'startup' ? 'block' : 'hidden'}>
          <StartupAndTestsPanel analysis={analysis} />
        </div>
        <div className={activeTab === 'scripts' ? 'block' : 'hidden'}>
          <UsefulCommandsPanel scripts={visibleScripts} />
        </div>
      </div>
    </div>
  );
});

interface CodebaseAnalysisViewProps {
  analysis: CodebaseAnalysis;
  projectId?: string;
  onRescan?: () => Promise<void>;
  onDelete?: () => void;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
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
  const {
    activeSection: activePage,
    selectSection: selectProjectSection,
    openQualitySection,
    qualitySectionFocus,
    clearQualitySectionFocus,
    registerToolbar,
  } = useCodebaseWorkspace();
  const activeSection = activePage ?? 'overview';
  const [isRescanning, setIsRescanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [githubTokenInput, setGitHubTokenInput] = useState('');
  const [githubRemoteInput, setGitHubRemoteInput] = useState('');
  const [githubConnectError, setGitHubConnectError] = useState<string | null>(null);

  // Preferred IDE (persisted)
  const [selectedIdeId] = useState<string>(() => {
    try {
      return window.localStorage.getItem('blueprint:preferred-ide') || 'vscode';
    } catch {
      return 'vscode';
    }
  });

  const selectedIde = SUPPORTED_IDES.find(ide => ide.id === selectedIdeId) || SUPPORTED_IDES[0];

  const launchIDE = useCallback((ide: IDEOption) => {
    const protocolUrl = ide.getProtocolUrl(analysis.rootPath);
    try {
      const a = document.createElement('a');
      a.href = protocolUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.assign(protocolUrl);
    }
  }, [analysis.rootPath]);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const visibleScripts = useMemo(() => {
    const allScripts = analysis.scripts || [];
    const preferredScriptNames = ['dev', 'start', 'serve', 'build', 'test', 'lint', 'typecheck', 'check', 'tauri:dev'];
    const preferredScripts = preferredScriptNames
      .map(name => allScripts.find(script => script.name === name))
      .filter((script): script is NonNullable<typeof script> => Boolean(script));
    return (preferredScripts.length > 0 ? preferredScripts : allScripts).slice(0, 8);
  }, [analysis.scripts]);

  const qualityTabBadges = useMemo(() => {
    const score = analysis.quality?.score;
    const staticFindings = analysis.quality?.findings?.length ?? 0;
    const advisories = analysis.dependencyRisk?.advisories?.length ?? 0;
    const openItems = staticFindings + advisories;
    return {
      score: typeof score === 'number' ? score : null,
      openItems,
      staticFindings,
      advisories,
    };
  }, [analysis.quality?.score, analysis.quality?.findings, analysis.dependencyRisk?.advisories]);

  const hasNextJsDeepReview = Boolean(
    analysis.nextjs || analysis.frameworkProfile?.id === 'nextjs',
  );
  const scanSuggestions = analysis.suggestions ?? [];
  const showScanSuggestions = scanSuggestions.length > 0 && !hasNextJsDeepReview;

  const remote = analysis.git?.remote;
  const githubConnected = github.isConnectedFor(remote, projectId);
  const supportsGitHub = Boolean(remote && parseGitHubRemote(remote));

  useEffect(() => {
    if (activeSection !== 'quality' || !qualitySectionFocus) return;
    const targetId =
      qualitySectionFocus === 'findings'
        ? 'quality-findings-panel'
        : qualitySectionFocus === 'supply-chain'
          ? 'quality-supply-chain-panel'
          : 'quality-score-panel';
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      clearQualitySectionFocus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeSection, qualitySectionFocus, clearQualitySectionFocus]);

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

  const rescan = useCallback(async () => {
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
  }, [onRescan]);

  const exportSummaryMarkdown = useCallback(() => {
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
  }, [analysis]);

  const openPreferredIde = useCallback(() => {
    launchIDE(selectedIde);
  }, [launchIDE, selectedIde]);

  const lastScannedLabel = useMemo(() => {
    try {
      return new Date(analysis.scannedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return undefined;
    }
  }, [analysis.scannedAt]);

  useEffect(() => {
    registerToolbar({
      rescan: onRescan ? rescan : undefined,
      isRescanning,
      lastScannedLabel,
      openPreferredIde,
      preferredIdeShortName: selectedIde.shortName,
      exportReport: exportSummaryMarkdown,
      deleteProject: onDelete,
    });
  }, [
    registerToolbar,
    onRescan,
    rescan,
    isRescanning,
    lastScannedLabel,
    openPreferredIde,
    selectedIde.shortName,
    exportSummaryMarkdown,
    onDelete,
  ]);

  return (
    <div className={`relative flex flex-col flex-1 h-full min-h-0 overflow-hidden ${
      isDark ? 'bg-[#0E0F12] text-[#F4F4F6]' : 'bg-[#F6F7F9] text-slate-900'
    }`}>
      {isRescanning ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center px-6"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className={`absolute inset-0 backdrop-blur-[2px] ${
              isDark ? 'bg-[#0E0F12]/80' : 'bg-[#F6F7F9]/85'
            }`}
          />
          <div
            className={`relative flex max-w-sm flex-col items-center gap-3 rounded-2xl border px-8 py-7 text-center shadow-lg ${
              isDark
                ? 'border-white/[0.1] bg-[#16171B]'
                : 'border-slate-200 bg-white'
            }`}
          >
            <Loader2 className={`h-9 w-9 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Rescanning project
              </p>
              <p className={`mt-1.5 text-xs leading-relaxed ${muted}`}>
                Reading files and checking dependency advisories. This can take a moment on large repos.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Scrollable content canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 lg:px-8">
        <div className="flex min-h-full w-full flex-col">
          {(analysis.truncated || (supportsGitHub && !githubConnected)) && (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              {analysis.truncated ? (
                <p className={`mr-auto text-xs ${muted}`}>Large repo — some files were skipped in the scan.</p>
              ) : null}
              {supportsGitHub && !githubConnected ? (
                <button
                  type="button"
                  onClick={openGitHubDialog}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors border-blue-500/25 bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 dark:text-blue-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect GitHub
                </button>
              ) : null}
            </div>
          )}

          {scanError && (
            <p role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-500">
              {scanError}
            </p>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 1: OVERVIEW                                        */}
          {/* ---------------------------------------------------- */}
          <div className={activeSection === 'overview' ? 'flex flex-1 flex-col gap-5' : 'hidden'} role="tabpanel">
            <CodebaseHeroPulse analysis={analysis} onOpenQuality={openQualitySection} />

            <div className="flex flex-1 flex-col gap-5">
              {showScanSuggestions && (
                <section className={`rounded-xl border p-5 ${panel}`}>
                  <h3 className={`mb-3 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Suggested next steps
                  </h3>
                  <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
                    {scanSuggestions.map((sug, i) => (
                      <li
                        key={i}
                        className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${
                          isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200/80 bg-slate-50/70'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                          sug.priority === 'high'
                            ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                            : isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {sug.title}
                          </p>
                          <p className={`mt-0.5 text-xs leading-relaxed ${muted}`}>
                            {sug.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <FrameworkSpecializationPanel analysis={analysis} />
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* TAB 2: CODE                                           */}
          {/* ---------------------------------------------------- */}
          <div className={activeSection === 'analysis' ? 'space-y-5' : 'hidden'} role="tabpanel">
            <LanguageDistributionBar languages={analysis.languages} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 space-y-4">
                <ProjectStructureTree analysis={analysis} />

                <div className={`p-4 rounded-xl border ${panel}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2.5 ${muted}`}>Repository volume</p>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-slate-50 border-slate-200/70'}`}>
                      <p className="text-xl font-bold">{analysis.filesScanned.toLocaleString()}</p>
                      <p className={`text-[10px] mt-0.5 ${muted}`}>Files scanned</p>
                    </div>
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-slate-50 border-slate-200/70'}`}>
                      <p className="text-xl font-bold">{analysis.sourceFiles.toLocaleString()}</p>
                      <p className={`text-[10px] mt-0.5 ${muted}`}>Source files</p>
                    </div>
                  </div>
                </div>
              </div>

              <CodeAnalysisInspector
                analysis={analysis}
                visibleScripts={visibleScripts}
                onOpenQualityTab={() => openQualitySection('supply-chain')}
              />
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* TAB 3: QUALITY                                         */}
          {/* ---------------------------------------------------- */}
          <div className={activeSection === 'quality' ? 'space-y-5' : 'hidden'} role="tabpanel">
            <CodebaseQualityView
              analysis={analysis}
              onRescan={rescan}
              isRescanning={isRescanning}
              onUpdateAnalysis={onUpdateAnalysis}
            />
          </div>
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
