import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileCode2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { Dropdown } from '../common/Dropdown';
import { MarkdownDocumentPreview } from './MarkdownDocumentPreview';
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
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false);
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isWorkspacePanelOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    workspaceCloseRef.current?.focus();

    const manageDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWorkspacePanelOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="dialog"] button:not(:disabled), [role="dialog"] [tabindex]:not([tabindex="-1"]), [role="dialog"] input:not(:disabled), [role="dialog"] select:not(:disabled), [role="dialog"] textarea:not(:disabled)',
      )).filter(element => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', manageDialogKeys);
    return () => {
      document.removeEventListener('keydown', manageDialogKeys);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isWorkspacePanelOpen]);

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
  const subtle = isDark
    ? 'border-white/[0.09] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900';

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
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className={`mx-auto max-w-2xl rounded-2xl border p-8 text-center ${surface}`}>
          <Sparkles className="mx-auto h-6 w-6 text-blue-500" />
          <h1 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>Complete the architecture first</h1>
          <p className={`mt-2 text-sm leading-6 ${muted}`}>The build handoff is generated from the approved product brief, interview decisions, architecture, and system map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-5 py-7 sm:px-6 lg:px-10 lg:py-8 xl:px-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className={`mb-2 text-xs font-medium ${muted}`}>Project handoff</div>
            <h1 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Prepare the project for your IDE</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>Review the generated blueprint files, then add them to your project when you’re ready.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button ref={workspaceTriggerRef} type="button" onClick={() => setIsWorkspacePanelOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/15 transition-colors hover:bg-blue-500">
              <FolderOpen className="h-3.5 w-3.5" />
              {target ? 'Review & add files' : 'Choose project folder'}
            </button>
            <button type="button" onClick={() => regenerate()} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${subtle}`}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate package
            </button>
          </div>
        </div>

        <section aria-label="Build handoff files">
        <div className="grid min-h-[min(70vh,840px)] gap-4 xl:h-[min(68vh,720px)] xl:max-h-[720px] xl:min-h-[400px] xl:grid-cols-[236px_minmax(0,1fr)]">
          <section className={`order-1 flex min-h-0 flex-col overflow-hidden rounded-xl border ${isDark ? 'border-white/[0.08] bg-black/10' : 'border-slate-200 bg-slate-50/60'}`}>
            <div className={`border-b px-4 py-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Generated files</h2>
              <p className={`mt-1 text-xs ${muted}`}>Select a file to review it.</p>
            </div>
            <div className="max-h-[280px] overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable] xl:max-h-none xl:min-h-0 xl:flex-1">
              {groupedFiles.map(group => (
                <div key={group.id} className="px-1 pb-2">
                  <div className={`px-2.5 pb-1.5 pt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em]">{group.title}</p>
                    <p className="mt-0.5 text-[10px] leading-4 normal-case tracking-normal">{group.description}</p>
                  </div>
                  {group.files.map(file => {
                const active = file.path === selectedFile?.path;
                const existing = conflicts.includes(file.path);
                return (
                  <button
                    key={file.path}
                    type="button"
                    title={`${file.path} — ${file.description}`}
                    onClick={() => setSelectedPath(file.path)}
                    className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active
                        ? isDark ? 'bg-blue-500/10 text-white ring-1 ring-inset ring-blue-400/20' : 'bg-blue-50 text-slate-950 ring-1 ring-inset ring-blue-200'
                        : isDark ? 'text-slate-400 hover:bg-white/[0.04] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <FileCode2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? 'text-blue-500' : ''}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-all text-[11px] font-medium leading-4">{file.path}</span>
                      <span className={`mt-0.5 block text-[10px] leading-4 ${muted}`}>{file.description}</span>
                      <span className={`mt-0.5 block text-[9px] ${muted}`}>{file.content.split('\n').length} lines</span>
                    </span>
                    {existing && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
                  </button>
                );
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className={`order-2 flex min-w-0 flex-col overflow-hidden rounded-xl border xl:h-full xl:min-h-0 ${isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white'}`}>
            <div className={`flex min-h-16 items-center justify-between gap-4 border-b px-4 py-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
              <div className="min-w-0">
                <h2 className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedFile?.path}</h2>
                <p className={`mt-1 truncate text-xs ${muted}`}>{selectedFile?.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasManualEdits && <span className={`rounded-full px-2 py-1 text-[9px] font-medium ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>Edited</span>}
                <div role="group" aria-label="Document view" className={`flex rounded-lg border p-0.5 ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
                  <button
                    type="button"
                    aria-pressed={!isSourceView}
                    onClick={() => setIsSourceView(false)}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors ${!isSourceView ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >Preview</button>
                  <button
                    type="button"
                    aria-pressed={isSourceView}
                    onClick={() => setIsSourceView(true)}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors ${isSourceView ? 'bg-blue-600 text-white shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >Edit source</button>
                </div>
              </div>
            </div>
            {isSourceView ? (
                <textarea
                value={selectedFile?.content || ''}
                onChange={event => updateSelectedFile(event.target.value)}
                spellCheck={false}
                aria-label={`Edit Markdown source for ${selectedFile?.path || 'handoff file'}`}
                className={`min-h-[min(58vh,680px)] flex-1 resize-none p-5 font-mono text-[11px] leading-[1.7] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/30 sm:text-xs xl:min-h-0 ${
                  isDark ? 'bg-[#0e0f12] text-slate-300' : 'bg-slate-50/70 text-slate-700'
                }`}
              />
            ) : (
              <MarkdownDocumentPreview content={selectedFile?.content || ''} isDark={isDark} />
            )}
          </section>

        </div>

        {isWorkspacePanelOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <button type="button" aria-label="Close workspace setup" onClick={() => setIsWorkspacePanelOpen(false)} className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />
            <aside role="dialog" aria-modal="true" aria-label="Add to your workspace" className={`relative z-10 flex h-full w-full flex-col border-l shadow-2xl sm:max-w-[440px] ${isDark ? 'border-white/10 bg-[#141518]' : 'border-slate-200 bg-white'}`}>
              <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
                <div>
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add to your workspace</h2>
                  <p className={`mt-1 text-xs leading-5 ${muted}`}>Choose your IDE and project folder to add these blueprint files.</p>
                </div>
                <button ref={workspaceCloseRef} type="button" aria-label="Close workspace setup" onClick={() => setIsWorkspacePanelOpen(false)} className={`rounded-lg border p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${subtle}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <Dropdown<IDETarget>
                  label="1. Choose your IDE"
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
                  className="mt-2"
                  triggerClassName="!rounded-lg !py-2.5"
                  menuClassName="!rounded-xl"
                />
                <p className={`mt-1.5 text-[10px] ${muted}`}>{selectedIDE.detail}</p>
              </div>

              <div>
                <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] ${muted}`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[9px] text-blue-500">2</span>
                  Project folder
                </div>
                <button type="button" onClick={chooseFolder} disabled={isChoosingFolder} className={`mt-2 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs font-medium disabled:opacity-50 ${subtle}`}>
                  {isChoosingFolder ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />}
                  <span className="min-w-0 flex-1 truncate">{target ? target.name : 'Select your project folder'}</span>
                  {target && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                </button>
                <p className={`mt-1.5 text-[10px] leading-4 ${muted}`}>Choose your project’s main folder. Blueprint files will be placed in their matching folders.</p>
              </div>

              {target && (
                <div className={`rounded-lg border px-3 py-2.5 ${
                  conflicts.length > 0
                    ? isDark ? 'border-amber-500/20 bg-amber-500/[0.05]' : 'border-amber-200 bg-amber-50'
                    : isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50'
                }`}>
                  <div className="flex items-start gap-2">
                    {conflicts.length > 0 ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                    <div>
                      <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {conflicts.length > 0 ? `${conflicts.length} matching file${conflicts.length === 1 ? '' : 's'} already exist` : 'Folder is ready'}
                      </p>
                      <p className={`mt-1 text-[9px] leading-4 ${muted}`}>
                        {conflicts.length > 0 ? 'We’ll ask before replacing any existing files.' : `${handoff.files.length} files will be added; nothing will be replaced.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] ${muted}`}>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[9px] text-blue-500">3</span>
                Review and add
              </div>
              <button
                type="button"
                onClick={exportPackage}
                disabled={!target || isExporting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-semibold text-white shadow-sm shadow-blue-600/15 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isExporting ? 'Adding files…' : `Add ${handoff.files.length} files to ${selectedIDE.label}`}
              </button>
              <p className={`-mt-2 text-center text-[9px] leading-4 ${muted}`}>Only the files shown in the preview will be written.</p>

              {exportResult && (
                <div className={`mt-3 rounded-xl border p-3 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <p className={`text-[10px] font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>Handoff complete</p>
                      <p className={`mt-1 text-[9px] leading-4 ${muted}`}>{exportResult.written.length} files are ready in {target?.name}. Open that folder in {selectedIDE.label} and start with AGENTS.md.</p>
                      {exportResult.overwritten.length > 0 && (
                        <p className={`mt-1 text-[9px] leading-4 ${muted}`}>{exportResult.overwritten.length} existing file{exportResult.overwritten.length === 1 ? ' was' : 's were'} updated.</p>
                      )}
                      <details className="mt-2">
                        <summary className={`cursor-pointer text-[9px] font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>View files added</summary>
                        <ul className={`mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md p-2 text-[9px] ${isDark ? 'bg-black/20 text-slate-300' : 'bg-white/70 text-slate-600'}`}>
                          {exportResult.written.map(path => <li key={path} className="break-all">{path}</li>)}
                        </ul>
                      </details>
                      {target?.kind === 'tauri' && (
                        <button type="button" onClick={openProjectFolder} className={`mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold transition-colors ${isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15' : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'}`}>
                          <FolderOpen className="h-3 w-3" />
                          Open project folder
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
            </aside>
          </div>
        )}
        </section>
      </div>
    </div>
  );
};
