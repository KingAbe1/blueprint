import React, { useState, useMemo, useCallback } from 'react';
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
  ExternalLink,
  KeyRound,
  X,
  Loader2,
  Check,
  Sparkles,
  Copy,
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
import { FrameworkSpecializationPanel } from './FrameworkSpecializationPanel';
import { LanguageDistributionBar } from './LanguageDistributionBar';
import { DependencyInventoryPanel } from './DependencyInventoryPanel';
import { CodebaseHotspotsPanel } from './CodebaseHotspotsPanel';
import { useTheme } from '../../context/ThemeContext';
import { useGitHub } from '../../context/GitHubContext';
import { parseGitHubRemote } from '../../services/githubService';

export type ProjectSection = 'overview' | 'analysis' | 'quality';

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
}

const CodeAnalysisInspector: React.FC<CodeAnalysisInspectorProps> = React.memo(({ analysis, visibleScripts }) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'packages' | 'hotspots' | 'startup' | 'scripts'>('packages');

  return (
    <div className="lg:col-span-7 space-y-4">
      {/* Inspector Segmented Switcher */}
      <div className={`flex items-center justify-between p-1 rounded-xl border ${
        isDark ? 'border-white/[0.08] bg-black/25' : 'border-slate-200 bg-slate-100/70'
      }`}>
        {[
          { id: 'packages', label: `Packages (${analysis.dependencyInventory?.packages.length || 0})` },
          { id: 'hotspots', label: 'Complexity & Debt' },
          { id: 'startup', label: 'Entry & Tests' },
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
          <DependencyInventoryPanel inventory={analysis.dependencyInventory} />
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
  const [showIdeDropdown, setShowIdeDropdown] = useState(false);

  // Preferred IDE state with persistence
  const [selectedIdeId, setSelectedIdeId] = useState<string>(() => {
    try {
      return window.localStorage.getItem('blueprint:preferred-ide') || 'vscode';
    } catch {
      return 'vscode';
    }
  });

  const selectedIde = SUPPORTED_IDES.find(ide => ide.id === selectedIdeId) || SUPPORTED_IDES[0];

  const changePreferredIde = (ideId: string) => {
    setSelectedIdeId(ideId);
    try {
      window.localStorage.setItem('blueprint:preferred-ide', ideId);
    } catch {
      // ignore
    }
  };

  const launchIDE = (ide: IDEOption) => {
    const protocolUrl = ide.getProtocolUrl(analysis.rootPath);
    try {
      const a = document.createElement('a');
      a.href = protocolUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setCopiedAction(`opened:${ide.id}`);
      setTimeout(() => setCopiedAction(null), 2500);
    } catch {
      window.location.assign(protocolUrl);
    }
  };

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

  const remote = analysis.git?.remote;
  const githubConnected = github.isConnectedFor(remote, projectId);
  const githubStatus = githubConnected ? github.status : null;
  const supportsGitHub = Boolean(remote && parseGitHubRemote(remote));

  const selectProjectSection = useCallback((page: ProjectSection) => {
    try {
      window.localStorage.setItem(navigationStorageKey, page);
    } catch {
      // Ignore storage error
    }
    setActivePage(page);
  }, [navigationStorageKey]);

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
        {/* Left: Project identity badge + Left-Aligned Segmented Tab Switcher */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <Folder className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-xs tracking-tight truncate max-w-[130px] sm:max-w-[200px]" title={analysis.rootName}>
                {analysis.rootName}
              </span>
              {analysis.rootPath && analysis.rootPath !== analysis.rootName && (
                <span className={`hidden xl:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border max-w-[180px] truncate ${
                  isDark ? 'border-white/[0.06] bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`} title={analysis.rootPath}>
                  {analysis.rootPath.includes('/') ? `~/${analysis.rootPath.split('/').filter(Boolean).slice(-2).join('/')}` : analysis.rootPath}
                </span>
              )}
              {analysis.git?.tracked && (
                <span className={`hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <GitBranch className="h-2.5 w-2.5" />
                  {analysis.git.branch || 'main'}
                </span>
              )}
            </div>
          </div>

          {/* Thin vertical separator */}
          <div className={`hidden sm:block h-4 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />

          {/* Unified Left-Aligned Segmented Tab Switcher */}
          <nav aria-label="Project sections" className={`flex p-0.5 rounded-lg border ${
            isDark ? 'border-white/[0.08] bg-black/40' : 'border-slate-200 bg-slate-100/90'
          }`}>
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'analysis', label: 'Code Analysis', icon: FileCode2 },
              { id: 'quality', label: 'Quality & Risks', icon: ShieldCheck, badge: analysis.quality?.score ? `${analysis.quality.score}` : undefined },
            ].map(tab => {
              const isSelected = activePage === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectProjectSection(tab.id as ProjectSection)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    isSelected
                      ? (isDark
                          ? 'bg-white/[0.12] text-white shadow-xs ring-1 ring-white/10 font-semibold'
                          : 'bg-white text-slate-950 shadow-xs border border-slate-200/80 font-semibold')
                      : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isSelected ? (isDark ? 'text-blue-400' : 'text-blue-600') : ''}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`ml-0.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-semibold ${
                      Number(tab.badge) < 60
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Desktop Action Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Dynamic Multi-IDE Launcher Split Button */}
          <div className="relative inline-flex items-center">
            <div className={`inline-flex items-center rounded-md border text-[11px] font-medium transition-colors ${
              isDark
                ? 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                : 'border-slate-200 bg-white text-slate-700 shadow-2xs'
            }`}>
              <button
                type="button"
                onClick={() => launchIDE(selectedIde)}
                title={`Open project in ${selectedIde.name} (${selectedIde.getProtocolUrl(analysis.rootPath)})`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-l-md transition-colors ${
                  isDark ? 'hover:bg-white/[0.08] hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {copiedAction === `opened:${selectedIde.id}` ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <ExternalLink className="h-3 w-3 text-blue-500" />
                )}
                <span>
                  {copiedAction === `opened:${selectedIde.id}`
                    ? `Opening…`
                    : selectedIde.shortName}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowIdeDropdown(v => !v)}
                title="Choose IDE or copy CLI command"
                className={`px-1.5 py-1 border-l transition-colors ${
                  isDark
                    ? 'border-white/[0.08] hover:bg-white/[0.08] text-slate-400 hover:text-white'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            {showIdeDropdown && (
              <div
                className={`absolute right-0 top-full mt-1.5 w-60 rounded-xl border p-1.5 shadow-2xl z-30 ${
                  isDark ? 'border-white/[0.1] bg-[#16171B]' : 'border-slate-200 bg-white'
                }`}
                onMouseLeave={() => setShowIdeDropdown(false)}
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Open Project In IDE
                </div>

                <div className="space-y-0.5">
                  {SUPPORTED_IDES.map(ide => {
                    const isCurrent = ide.id === selectedIde.id;
                    return (
                      <button
                        key={ide.id}
                        type="button"
                        onClick={() => {
                          changePreferredIde(ide.id);
                          launchIDE(ide);
                          setShowIdeDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                          isCurrent
                            ? (isDark ? 'bg-blue-500/15 text-blue-300 font-medium' : 'bg-blue-50 text-blue-700 font-medium')
                            : (isDark ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white' : 'text-slate-700 hover:bg-slate-100')
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-3 w-3 text-blue-400 shrink-0" />
                          <span>{ide.name}</span>
                        </div>
                        {isCurrent && <Check className="h-3 w-3 text-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className={`my-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />

                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(`cd "${analysis.rootPath}" && ${selectedIde.getCliCommand('.')}`, 'cli');
                    setShowIdeDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    isDark ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Terminal className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">Copy CLI command</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(analysis.rootPath, 'path');
                    setShowIdeDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    isDark ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Copy className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Copy Directory Path</span>
                </button>
              </div>
            )}
          </div>

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
          {/* TAB 1: OVERVIEW (Zero-Lag Persistent DOM)             */}
          {/* ---------------------------------------------------- */}
          <div className={activePage === 'overview' ? 'space-y-5' : 'hidden'} role="tabpanel">
            {/* Desktop KPI Hero Pulse Strip */}
            <CodebaseHeroPulse analysis={analysis} />

            {/* Pluggable Framework Specialization Console */}
            <FrameworkSpecializationPanel analysis={analysis} />

            {/* Connected Visual Topology Diagram */}
            <ArchitectureTopologyDiagram analysis={analysis} />

            {/* Prioritized Architectural Next Steps */}
            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <section className={`rounded-xl border p-5 ${panel}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>
                        Recommended Next Steps
                      </h3>
                      <p className={`text-[11px] mt-0.5 ${muted}`}>
                        High-leverage engineering actions inferred from codebase patterns and architecture
                      </p>
                    </div>
                  </div>
                  {supportsGitHub && !githubConnected && (
                    <button
                      type="button"
                      onClick={openGitHubDialog}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect GitHub Actions
                    </button>
                  )}
                </div>

                <div className={`grid grid-cols-1 ${
                  analysis.suggestions.length === 2 ? 'md:grid-cols-2' : ''
                } ${
                  analysis.suggestions.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : ''
                } gap-3.5`}>
                  {analysis.suggestions.map((sug, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        isDark
                          ? 'border-white/[0.06] bg-black/25 hover:border-white/[0.12]'
                          : 'border-slate-200/80 bg-slate-50/70 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span
                            className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              sug.priority === 'high'
                                ? isDark
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                                : isDark
                                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                                : 'border-blue-200 bg-blue-50 text-blue-700'
                            }`}
                          >
                            {sug.priority ? `${sug.priority} priority` : 'Action'}
                          </span>
                          <span className={`text-[10px] font-mono ${muted}`}>0{i + 1}</span>
                        </div>
                        <h4 className={`font-semibold text-xs leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {sug.title}
                        </h4>
                        <p className={`mt-1.5 text-[11px] leading-relaxed ${muted}`}>
                          {sug.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ---------------------------------------------------- */}
          {/* TAB 2: CODE ANALYSIS (Zero-Lag Persistent DOM)        */}
          {/* ---------------------------------------------------- */}
          <div className={activePage === 'analysis' ? 'space-y-5' : 'hidden'} role="tabpanel">
            {/* Language Distribution Bar */}
            <LanguageDistributionBar languages={analysis.languages} />

            {/* 2-Column IDE-style Layout: Left Tree (40%), Right Inspector (60%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left 5 Cols: Searchable Project Structure Tree */}
              <div className="lg:col-span-5 space-y-4">
                <ProjectStructureTree analysis={analysis} />

                {/* Volume Summary Box */}
                <div className={`p-4 rounded-xl border ${panel}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2.5 ${muted}`}>Repository Volume</p>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-slate-50 border-slate-200/70'}`}>
                      <p className="text-xl font-bold">{analysis.filesScanned.toLocaleString()}</p>
                      <p className={`text-[10px] mt-0.5 ${muted}`}>Files Scanned</p>
                    </div>
                    <div className={`p-3 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-slate-50 border-slate-200/70'}`}>
                      <p className="text-xl font-bold">{analysis.sourceFiles.toLocaleString()}</p>
                      <p className={`text-[10px] mt-0.5 ${muted}`}>Source Files</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 7 Cols: Isolated Zero-Lag Inspector Panels */}
              <CodeAnalysisInspector analysis={analysis} visibleScripts={visibleScripts} />
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* TAB 3: QUALITY & RISKS (Zero-Lag Persistent DOM)      */}
          {/* ---------------------------------------------------- */}
          <div className={activePage === 'quality' ? 'space-y-5' : 'hidden'} role="tabpanel">
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
