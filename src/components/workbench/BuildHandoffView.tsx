import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileCode2,
  FolderOpen,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { isDesktopApp } from '../../utils/platform';
import { Dropdown } from '../common/Dropdown';
import { MarkdownDocumentPreview } from './MarkdownDocumentPreview';
import { WorkbenchPhaseHeader } from './WorkbenchPhaseHeader';
import { generateHandoffPackage } from '../../services/handoffService';
import {
  chooseHandoffTarget,
  exportHandoffFiles,
  HandoffExportResult,
  HandoffTarget,
  inspectHandoffConflicts,
  openHandoffFolder,
} from '../../services/handoffExportService';
import { HandoffPackage, IDETarget } from '../../types/project';

const IDE_OPTIONS: Array<{ id: IDETarget; label: string; detail: string }> = [
  { id: 'cursor', label: 'Cursor', detail: 'Adds a project rule' },
  { id: 'vscode', label: 'VS Code', detail: 'Adds Copilot instructions' },
  { id: 'codex', label: 'Codex', detail: 'Uses AGENTS.md' },
  { id: 'claude', label: 'Claude Code', detail: 'Adds CLAUDE.md' },
  { id: 'jetbrains', label: 'JetBrains', detail: 'Adds an AI rule' },
  { id: 'other', label: 'Other IDE', detail: 'Portable Markdown only' },
];

const FILE_GROUPS = [
  { id: 'start', title: 'Start here', description: 'The entry point for your coding agent.' },
  { id: 'blueprint', title: 'Project blueprint', description: 'Product, architecture, roadmap, and requirements.' },
  { id: 'ide', title: 'IDE instructions', description: 'Settings that connect your IDE to the blueprint.' },
] as const;

function fileGroup(path: string) {
  if (path === 'AGENTS.md') return 'start';
  if (path.startsWith('blueprint/')) return 'blueprint';
  return 'ide';
}

function fileBaseName(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export const BuildHandoffView: React.FC = () => {
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const architecture = activeProject?.spec.frameworkRecommendation || activeProject?.spec.frameworkRecommendations?.[0];
  const canGenerate = Boolean(activeProject && architecture && activeProject.spec.interview?.status === 'completed');

  const [handoff, setHandoff] = useState<HandoffPackage | null>(() => {
    if (!activeProject) return null;
    if (activeProject.spec.handoff) return activeProject.spec.handoff;
    return canGenerate ? generateHandoffPackage(activeProject, 'cursor') : null;
  });
  const [selectedPath, setSelectedPath] = useState(handoff?.files[0]?.path || '');
  const [target, setTarget] = useState<HandoffTarget | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<HandoffExportResult | null>(null);
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [isSourceView, setIsSourceView] = useState(false);

  useEffect(() => {
    if (!activeProject || !handoff) return;
    if (activeProject.spec.handoff !== handoff) {
      updateProjectSpec(activeProject.id, { handoff });
    }
  // Persist only when this locally managed package changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  useEffect(() => {
    if (!activeProject) return;
    const stored = activeProject.spec.handoff;
    const next = stored || (canGenerate ? generateHandoffPackage(activeProject, 'cursor') : null);
    setHandoff(next);
    setSelectedPath(next?.files[0]?.path || '');
    setTarget(null);
    setConflicts([]);
    setExportResult(null);
    setHasManualEdits(false);
  // The project ID is the boundary for a separate handoff package.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  const selectedFile = handoff?.files.find(file => file.path === selectedPath) || handoff?.files[0];
  const selectedIDE = IDE_OPTIONS.find(option => option.id === handoff?.ide) || IDE_OPTIONS[0];
  const groupedFiles = useMemo(() => FILE_GROUPS.map(group => ({
    ...group,
    files: handoff?.files.filter(file => fileGroup(file.path) === group.id) || [],
  })).filter(group => group.files.length > 0), [handoff]);
  const surface = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const desktop = isDesktopApp();
  const cardRadius = desktop ? 'rounded-lg' : 'rounded-2xl';
  const pagePadding = desktop
    ? 'w-full px-6 py-7 lg:px-8 xl:px-10'
    : 'w-full px-5 py-7 sm:px-6 lg:px-10 lg:py-8 xl:px-12';
  const subCard = isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200/90 bg-slate-50/70';

  if (!activeProject) return null;

  const regenerate = (ide: IDETarget = handoff?.ide || 'cursor', skipEditCheck = false) => {
    if (!canGenerate) return;
    if (!skipEditCheck && hasManualEdits && !window.confirm('Regenerating will replace your edits in the handoff preview. Continue?')) return;
    const next = generateHandoffPackage(activeProject, ide);
    setHandoff(next);
    setSelectedPath(next.files[0]?.path || '');
    setTarget(null);
    setConflicts([]);
    setExportResult(null);
    setHasManualEdits(false);
    notify.success('Build handoff regenerated from the current blueprint.');
  };

  const chooseIDE = (ide: IDETarget) => {
    if (handoff?.ide === ide) return;
    if (hasManualEdits && !window.confirm('Changing IDE regenerates the package and replaces your preview edits. Continue?')) return;
    regenerate(ide, true);
  };

  const chooseFolder = async () => {
    if (!handoff) return;
    setIsChoosingFolder(true);
    setExportResult(null);
    try {
      const nextTarget = await chooseHandoffTarget();
      if (!nextTarget) return;
      const existing = await inspectHandoffConflicts(nextTarget, handoff.files);
      setTarget(nextTarget);
      setConflicts(existing);
    } catch (error: any) {
      notify.error(error?.message || 'Could not access that project folder.');
    } finally {
      setIsChoosingFolder(false);
    }
  };

  const exportPackage = async () => {
    if (!handoff || !target) return;
    if (conflicts.length > 0) {
      const confirmed = window.confirm(
        `${conflicts.length} generated file${conflicts.length === 1 ? '' : 's'} already exist in ${target.name}. Exporting will replace only those listed files. Continue?`,
      );
      if (!confirmed) return;
    }

    setIsExporting(true);
    try {
      const result = await exportHandoffFiles(target, handoff.files, conflicts.length > 0);
      setExportResult(result);
      notify.success(`Handoff exported to ${target.name}.`);
    } catch (error: any) {
      notify.error(error?.message || 'Could not export the handoff package.');
    } finally {
      setIsExporting(false);
    }
  };

  const openProjectFolder = async () => {
    if (!target) return;
    try {
      const opened = await openHandoffFolder(target);
      if (!opened) notify.info('Open the selected folder in your file manager to continue in your IDE.');
    } catch (error: any) {
      notify.error(error?.message || 'Could not open the project folder.');
    }
  };

  const updateSelectedFile = (content: string) => {
    if (!handoff || !selectedFile) return;
    setHandoff({
      ...handoff,
      files: handoff.files.map(file => file.path === selectedFile.path ? { ...file, content } : file),
    });
    setHasManualEdits(true);
    setExportResult(null);
  };

  if (!canGenerate || !handoff) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className={pagePadding}>
          <section className={`mx-auto mt-4 max-w-lg border p-8 text-center ${cardRadius} ${surface}`}>
            <div className={`mx-auto flex h-12 w-12 items-center justify-center ${cardRadius} ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>Complete the architecture first</h1>
            <p className={`mx-auto mt-2 text-sm leading-6 ${muted}`}>
              Build handoff is generated from your product brief, build-question answers, and architecture map.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={pagePadding}>
        <WorkbenchPhaseHeader
          eyebrow={`${activeProject.name} · Step 3 of 3 · Export to your IDE`}
          title="Build handoff"
          description="Review agent-ready Markdown, pick your IDE, then write files into your project folder."
          actions={
            <button
              type="button"
              onClick={() => regenerate()}
              className="btn-secondary-accent flex shrink-0 items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate from blueprint
            </button>
          }
        />

        <div className="space-y-5">
          <section className={`border p-5 sm:p-6 ${cardRadius} ${surface}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-600'}`}>
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                    Handoff package
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {handoff.files.length} files for {selectedIDE.label}
                  </p>
                  <p className={`mt-1 text-xs ${muted}`}>
                    Start with <span className="font-mono text-[11px]">AGENTS.md</span> in your repo root.
                    {hasManualEdits ? ' · Preview includes your edits.' : ''}
                  </p>
                </div>
              </div>
              {hasManualEdits && (
                <span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-semibold ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                  Edited in preview
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className={`rounded-xl border p-4 ${subCard}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${muted}`}>1 · IDE</p>
                <Dropdown<IDETarget>
                  label="Target IDE"
                  options={IDE_OPTIONS.map(option => ({
                    value: option.id,
                    label: option.label,
                    description: option.detail,
                    icon: <Code2 className="h-3.5 w-3.5" />,
                  }))}
                  value={handoff.ide}
                  onChange={chooseIDE}
                  variant="subtle"
                  size="md"
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  className="mt-3"
                  triggerClassName="!rounded-lg !py-2.5"
                  menuClassName="!rounded-xl"
                />
                <p className={`mt-2 text-[11px] leading-5 ${muted}`}>{selectedIDE.detail}</p>
              </div>

              <div className={`rounded-xl border p-4 ${subCard}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${muted}`}>2 · Project folder</p>
                <button
                  type="button"
                  onClick={chooseFolder}
                  disabled={isChoosingFolder}
                  className="btn-secondary mt-3 flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs disabled:opacity-50"
                >
                  {isChoosingFolder ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />}
                  <span className="min-w-0 flex-1 truncate">{target ? target.name : 'Choose folder…'}</span>
                  {target && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                </button>
                {target && (
                  <div className={`mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                    conflicts.length > 0
                      ? isDark ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-amber-200 bg-amber-50/80'
                      : isDark ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-emerald-200 bg-emerald-50/80'
                  }`}>
                    {conflicts.length > 0
                      ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                    <p className={`text-[11px] leading-5 ${muted}`}>
                      {conflicts.length > 0
                        ? `${conflicts.length} file${conflicts.length === 1 ? '' : 's'} already exist — we’ll confirm before replacing.`
                        : `Ready to add ${handoff.files.length} files without overwriting.`}
                    </p>
                  </div>
                )}
              </div>

              <div className={`flex flex-col rounded-xl border p-4 ${subCard}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${muted}`}>3 · Add to project</p>
                <button
                  type="button"
                  onClick={exportPackage}
                  disabled={!target || isExporting}
                  className="btn-primary-blue mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isExporting ? 'Writing files…' : `Add ${handoff.files.length} files`}
                </button>
                <p className={`mt-2 text-[11px] leading-5 ${muted}`}>Only files in the preview below are written to disk.</p>

                {exportResult && (
                  <div className={`mt-3 rounded-lg border p-3 ${isDark ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-emerald-200 bg-emerald-50/90'}`}>
                    <div className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}>Handoff complete</p>
                        <p className={`mt-1 text-[11px] leading-5 ${muted}`}>
                          {exportResult.written.length} files in {target?.name}. Open {selectedIDE.label} and start with AGENTS.md.
                        </p>
                        {exportResult.overwritten.length > 0 && (
                          <p className={`mt-1 text-[11px] ${muted}`}>
                            Updated {exportResult.overwritten.length} existing file{exportResult.overwritten.length === 1 ? '' : 's'}.
                          </p>
                        )}
                        {target?.kind === 'tauri' && (
                          <button
                            type="button"
                            onClick={openProjectFolder}
                            className="btn-secondary-accent mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold"
                          >
                            <FolderOpen className="h-3 w-3" />
                            Open folder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section aria-label="Build handoff files" className={`grid min-h-[min(62vh,760px)] gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:min-h-[420px]`}>
            <aside className={`flex min-h-0 flex-col overflow-hidden border ${cardRadius} ${isDark ? 'border-white/[0.08] bg-black/10' : 'border-slate-200 bg-slate-50/60'}`}>
              <div className={`border-b px-4 py-3.5 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Files</h2>
                <p className={`mt-0.5 text-xs ${muted}`}>{handoff.files.length} generated · select to preview</p>
              </div>
              <div className="max-h-[320px] overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable] xl:max-h-none xl:flex-1">
                {groupedFiles.map(group => (
                  <div key={group.id} className="px-1 pb-2">
                    <p className={`px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] ${muted}`}>{group.title}</p>
                    {group.files.map(file => {
                      const active = file.path === selectedFile?.path;
                      const existing = conflicts.includes(file.path);
                      return (
                        <button
                          key={file.path}
                          type="button"
                          title={file.path}
                          onClick={() => setSelectedPath(file.path)}
                          className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                            active
                              ? isDark ? 'bg-blue-500/10 text-white ring-1 ring-inset ring-blue-400/25' : 'bg-blue-50 text-slate-950 ring-1 ring-inset ring-blue-200'
                              : isDark ? 'text-slate-400 hover:bg-white/[0.04] hover:text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <FileCode2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? 'text-blue-500' : ''}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-semibold leading-4">{fileBaseName(file.path)}</span>
                            <span className={`mt-0.5 block truncate font-mono text-[9px] leading-4 ${muted}`}>{file.path}</span>
                          </span>
                          {existing && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-label="File already exists in target folder" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </aside>

            <div className={`flex min-w-0 flex-col overflow-hidden border ${cardRadius} ${surface}`}>
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
                <div className="min-w-0">
                  <h2 className={`truncate font-mono text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedFile?.path}</h2>
                  <p className={`mt-0.5 truncate text-xs ${muted}`}>{selectedFile?.description}</p>
                </div>
                <div role="group" aria-label="Document view" className={`flex shrink-0 rounded-lg border p-0.5 ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
                  <button
                    type="button"
                    aria-pressed={!isSourceView}
                    onClick={() => setIsSourceView(false)}
                    className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${!isSourceView ? 'btn-secondary-accent shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    aria-pressed={isSourceView}
                    onClick={() => setIsSourceView(true)}
                    className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${isSourceView ? 'btn-secondary-accent shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Source
                  </button>
                </div>
              </div>
              {isSourceView ? (
                <textarea
                  value={selectedFile?.content || ''}
                  onChange={event => updateSelectedFile(event.target.value)}
                  spellCheck={false}
                  aria-label={`Edit Markdown source for ${selectedFile?.path || 'handoff file'}`}
                  className={`min-h-[min(52vh,640px)] flex-1 resize-none p-5 font-mono text-[11px] leading-[1.7] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/30 sm:text-xs xl:min-h-0 ${
                    isDark ? 'bg-[#0e0f12] text-slate-300' : 'bg-slate-50/70 text-slate-700'
                  }`}
                />
              ) : (
                <MarkdownDocumentPreview content={selectedFile?.content || ''} isDark={isDark} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
