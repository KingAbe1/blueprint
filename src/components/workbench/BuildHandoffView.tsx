import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileCode2,
  FolderOpen,
  Loader2,
  Package,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import { useNotification } from '../../context/NotificationContext';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { isDesktopApp } from '../../utils/platform';
import { Dropdown } from '../common/Dropdown';
import { MarkdownDocumentPreview } from './MarkdownDocumentPreview';
import { WorkbenchPhaseHeader } from './WorkbenchPhaseHeader';
import { overviewDivideClass } from '../project/overviewUi';
import { workbenchCanvasClass, workbenchPagePadding, workbenchTheme } from './workbenchUi';
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
import { loadHandoffPrefs, saveHandoffPrefs } from '../../services/greenfieldHandoffPrefsStorage';
import { downloadHandoffZip } from '../../services/handoffZipDownload';

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
  const { confirm } = useConfirm();
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

  useEffect(() => {
    if (!activeProject?.id || !handoff) return;
    const prefs = loadHandoffPrefs(activeProject.id);
    if (prefs.target?.kind === 'tauri') {
      setTarget(prefs.target);
      void inspectHandoffConflicts(prefs.target, handoff.files).then(setConflicts);
    }
  }, [activeProject?.id, handoff]);

  const selectedFile = handoff?.files.find(file => file.path === selectedPath) || handoff?.files[0];
  const selectedIDE = IDE_OPTIONS.find(option => option.id === handoff?.ide) || IDE_OPTIONS[0];
  const groupedFiles = useMemo(() => FILE_GROUPS.map(group => ({
    ...group,
    files: handoff?.files.filter(file => fileGroup(file.path) === group.id) || [],
  })).filter(group => group.files.length > 0), [handoff]);
  const desktop = isDesktopApp();
  const { border, panel, muted, title: titleText, inner, input } = workbenchTheme(isDark);
  const divide = overviewDivideClass(isDark);
  const listRail = isDark ? 'bg-black/15' : 'bg-slate-50/90';
  const ghostButton = isDark
    ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50';

  if (!activeProject) return null;

  const regenerate = async (ide: IDETarget = handoff?.ide || 'cursor', skipEditCheck = false) => {
    if (!canGenerate) return;
    if (
      !skipEditCheck
      && hasManualEdits
      && !(await confirm({
        title: 'Regenerate handoff?',
        description: 'This replaces your preview edits with a fresh package from the current blueprint.',
        confirmLabel: 'Regenerate',
      }))
    ) {
      return;
    }
    const next = generateHandoffPackage(activeProject, ide);
    setHandoff(next);
    setSelectedPath(next.files[0]?.path || '');
    setTarget(null);
    setConflicts([]);
    setExportResult(null);
    setHasManualEdits(false);
    notify.success('Build handoff regenerated from the current blueprint.');
  };

  const chooseIDE = async (ide: IDETarget) => {
    if (handoff?.ide === ide) return;
    if (
      hasManualEdits
      && !(await confirm({
        title: 'Change target IDE?',
        description: 'The handoff package will be regenerated and preview edits will be replaced.',
        confirmLabel: 'Change IDE',
      }))
    ) {
      return;
    }
    saveHandoffPrefs(activeProject.id, { ide });
    void regenerate(ide, true);
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
      saveHandoffPrefs(activeProject.id, { target: nextTarget });
    } catch (error: any) {
      notify.error(error?.message || 'Could not access that project folder.');
    } finally {
      setIsChoosingFolder(false);
    }
  };

  const exportPackage = async () => {
    if (!handoff || !target) return;
    if (conflicts.length > 0) {
      const confirmed = await confirm({
        title: 'Replace existing files?',
        description: `${conflicts.length} file${conflicts.length === 1 ? '' : 's'} already exist in ${target.name}. Only generated paths will be written; conflicting files will be replaced.`,
        confirmLabel: 'Export anyway',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    setIsExporting(true);
    try {
      const result = await exportHandoffFiles(target, handoff.files, conflicts.length > 0);
      setExportResult(result);
      saveHandoffPrefs(activeProject.id, { ide: handoff.ide, target });
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
      <div className={`flex-1 overflow-y-auto ${workbenchCanvasClass(isDark)}`}>
        <div className={workbenchPagePadding(desktop)}>
          <section className={`mx-auto mt-2 max-w-lg overflow-hidden rounded-2xl border ${panel}`}>
            <div className="px-6 py-10 text-center">
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border ${border} ${inner}`}>
                <Package className="h-5 w-5 text-blue-500" strokeWidth={1.75} />
              </div>
              <h1 className={`mt-4 text-[15px] font-medium ${titleText}`}>Complete the architecture first</h1>
              <p className={`mx-auto mt-2 max-w-sm text-[13px] leading-relaxed ${muted}`}>
                Build handoff is generated from your product brief, build-question answers, and architecture map.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto ${workbenchCanvasClass(isDark)}`}>
      <div className={workbenchPagePadding(desktop)}>
        <WorkbenchPhaseHeader
          eyebrow={`${activeProject.name} · Step 3 of 3 · Export to your IDE`}
          title="Build handoff"
          description="Review agent-ready Markdown, pick your IDE, then write files into your project folder."
          actions={
            <button
              type="button"
              onClick={() => void regenerate()}
              className="btn-secondary-accent flex shrink-0 items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate from blueprint
            </button>
          }
        />

        <div className="space-y-5">
          <section className={`overflow-hidden rounded-2xl border ${panel}`}>
            <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-500'}`}>
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs ${muted}`}>Handoff package</p>
                    <p className={`mt-0.5 text-[13px] ${titleText}`}>
                      {handoff.files.length} Markdown files · {selectedIDE.label}
                    </p>
                    <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
                      Agent entry point is <span className="font-mono text-[11px]">AGENTS.md</span> at the repo root.
                      {hasManualEdits ? ' Preview edits are included when you export.' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {hasManualEdits ? (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                      Edited in preview
                    </span>
                  ) : null}
                  {architecture?.name ? (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      Stack · {architecture.name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={`grid gap-0 lg:grid-cols-3 lg:divide-x ${isDark ? 'lg:divide-white/[0.06]' : 'lg:divide-slate-200/90'}`}>
              <div className="space-y-3 p-5 sm:p-6 lg:col-span-1">
                <div>
                  <p className={`text-xs ${muted}`}>Step 1</p>
                  <p className={`mt-0.5 text-[13px] ${titleText}`}>Target IDE</p>
                  <p className={`mt-1 text-[11px] leading-relaxed ${muted}`}>{selectedIDE.detail}</p>
                </div>
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
                  triggerClassName="!rounded-lg !py-2.5"
                  menuClassName="!rounded-xl"
                />
              </div>

              <div className={`space-y-3 border-t p-5 sm:p-6 lg:border-t-0 ${border}`}>
                <div>
                  <p className={`text-xs ${muted}`}>Step 2</p>
                  <p className={`mt-0.5 text-[13px] ${titleText}`}>Project folder</p>
                  <p className={`mt-1 text-[11px] leading-relaxed ${muted}`}>Choose the repo where files should be written.</p>
                </div>
                <button
                  type="button"
                  onClick={chooseFolder}
                  disabled={isChoosingFolder}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50 ${ghostButton}`}
                >
                  {isChoosingFolder ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FolderOpen className="h-4 w-4 shrink-0 opacity-80" />}
                  <span className={`min-w-0 flex-1 truncate ${target ? titleText : muted}`}>
                    {target ? target.name : 'Choose folder…'}
                  </span>
                  {target ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden /> : null}
                </button>
                {target ? (
                  <div className="space-y-2">
                    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${border} ${inner}`}>
                      {conflicts.length > 0 ? (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      )}
                      <p className={`text-[11px] leading-relaxed ${muted}`}>
                        {conflicts.length > 0
                          ? `${conflicts.length} file${conflicts.length === 1 ? '' : 's'} already exist — you’ll confirm before replacing.`
                          : `Ready to add ${handoff.files.length} files without overwriting.`}
                      </p>
                    </div>
                    {conflicts.length > 0 ? (
                      <ul className={`max-h-28 overflow-y-auto rounded-lg border px-3 py-2 ${border} ${inner}`}>
                        {conflicts.map(path => (
                          <li key={path} className={`truncate font-mono text-[10px] ${muted}`}>
                            {path}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className={`flex flex-col space-y-3 border-t p-5 sm:p-6 lg:border-t-0 ${border}`}>
                <div>
                  <p className={`text-xs ${muted}`}>Step 3</p>
                  <p className={`mt-0.5 text-[13px] ${titleText}`}>Add to project</p>
                  <p className={`mt-1 text-[11px] leading-relaxed ${muted}`}>Only files shown in the preview below are written to disk.</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadHandoffZip(handoff.files, activeProject.name)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors ${ghostButton}`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download ZIP
                </button>
                <button
                  type="button"
                  onClick={() => void exportPackage()}
                  disabled={!target || isExporting}
                  className="btn-primary-blue flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCode2 className="h-3.5 w-3.5" />}
                  {isExporting ? 'Writing files…' : `Add ${handoff.files.length} files`}
                </button>

                {exportResult ? (
                  <div className={`rounded-xl border p-3.5 ${border} ${inner}`}>
                    <div className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0">
                        <p className={`text-[13px] ${titleText}`}>Handoff complete</p>
                        <p className={`mt-1 text-[11px] leading-relaxed ${muted}`}>
                          {exportResult.written.length} files in {target?.name}. Open {selectedIDE.label} and start with{' '}
                          <span className="font-mono">AGENTS.md</span>.
                        </p>
                        {exportResult.overwritten.length > 0 ? (
                          <p className={`mt-1 text-[11px] ${muted}`}>
                            Updated {exportResult.overwritten.length} existing file{exportResult.overwritten.length === 1 ? '' : 's'}.
                          </p>
                        ) : null}
                        {target?.kind === 'tauri' ? (
                          <button
                            type="button"
                            onClick={openProjectFolder}
                            className="btn-secondary-accent mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium"
                          >
                            <FolderOpen className="h-3 w-3" />
                            Open folder
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section
            aria-label="Build handoff files"
            className={`flex min-h-[min(62vh,760px)] flex-col overflow-hidden rounded-2xl border xl:min-h-[420px] xl:flex-row ${panel}`}
          >
            <aside className={`flex max-h-[40vh] min-h-0 w-full shrink-0 flex-col border-b xl:max-h-none xl:w-[min(100%,17.5rem)] xl:border-b-0 xl:border-r ${border} ${listRail}`}>
              <div className={`border-b px-4 py-3.5 sm:px-5 ${border}`}>
                <p className={`text-xs ${muted}`}>Handoff preview</p>
                <h2 className={`mt-0.5 text-[13px] ${titleText}`}>Package files</h2>
                <p className={`mt-0.5 text-[11px] ${muted}`}>{handoff.files.length} files · pick one to read or edit</p>
              </div>
              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]" aria-label="Handoff files">
                <ul className={`divide-y ${divide}`}>
                  {groupedFiles.map(group => (
                    <li key={group.id}>
                      <div className={`px-4 py-2.5 sm:px-5 ${isDark ? 'bg-white/[0.02]' : 'bg-white/50'}`}>
                        <p className={`text-[11px] ${titleText}`}>{group.title}</p>
                        <p className={`text-[10px] leading-relaxed ${muted}`}>{group.description}</p>
                      </div>
                      <ul className={`divide-y ${divide}`}>
                        {group.files.map(file => {
                          const active = file.path === selectedFile?.path;
                          const existing = conflicts.includes(file.path);
                          return (
                            <li key={file.path}>
                              <button
                                type="button"
                                title={file.path}
                                onClick={() => setSelectedPath(file.path)}
                                aria-current={active ? 'true' : undefined}
                                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors sm:px-5 ${
                                  active
                                    ? isDark
                                      ? 'bg-blue-500/[0.08] text-slate-100'
                                      : 'bg-blue-50/80 text-slate-900'
                                    : isDark
                                      ? 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
                                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                              >
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${border} ${
                                    active
                                      ? isDark
                                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                        : 'border-blue-200 bg-white text-blue-600'
                                      : isDark
                                        ? 'bg-white/[0.03] text-slate-500'
                                        : 'bg-white text-slate-500'
                                  }`}
                                >
                                  <FileCode2 className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate text-[12px] ${titleText}`}>{fileBaseName(file.path)}</span>
                                  <span className={`mt-0.5 block truncate font-mono text-[10px] ${muted}`}>{file.path}</span>
                                </span>
                                {existing ? (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="File already exists in target folder" />
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <div className="flex min-h-[min(48vh,520px)] min-w-0 flex-1 flex-col xl:min-h-0">
              <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5 ${border}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${inner}`}
                  >
                    <FileCode2 className="h-4 w-4 opacity-80" />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs ${muted}`}>Selected file</p>
                    <p className={`mt-0.5 truncate text-[13px] ${titleText}`}>{selectedFile ? fileBaseName(selectedFile.path) : '—'}</p>
                    <p className={`mt-0.5 truncate font-mono text-[10px] ${muted}`}>{selectedFile?.path}</p>
                  </div>
                </div>
                <div role="group" aria-label="Document view" className={`flex shrink-0 rounded-lg border p-0.5 ${border} ${inner}`}>
                  <button
                    type="button"
                    aria-pressed={!isSourceView}
                    onClick={() => setIsSourceView(false)}
                    className={`rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors ${!isSourceView ? 'btn-secondary-accent shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    aria-pressed={isSourceView}
                    onClick={() => setIsSourceView(true)}
                    className={`rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors ${isSourceView ? 'btn-secondary-accent shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Edit source
                  </button>
                </div>
              </div>

              {selectedFile?.description ? (
                <p className={`shrink-0 border-b px-4 py-2 text-[11px] leading-relaxed sm:px-5 ${border} ${muted}`}>
                  {selectedFile.description}
                </p>
              ) : null}

              <div className={`flex min-h-0 flex-1 flex-col ${isDark ? 'bg-black/10' : 'bg-slate-50/40'}`}>
                {isSourceView ? (
                  <textarea
                    value={selectedFile?.content || ''}
                    onChange={event => updateSelectedFile(event.target.value)}
                    spellCheck={false}
                    aria-label={`Edit Markdown source for ${selectedFile?.path || 'handoff file'}`}
                    className={`min-h-[min(44vh,560px)] flex-1 resize-none border-0 bg-transparent p-5 font-mono text-[11px] leading-[1.7] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/30 sm:px-6 sm:text-xs xl:min-h-0 ${input}`}
                  />
                ) : (
                  <MarkdownDocumentPreview content={selectedFile?.content || ''} isDark={isDark} layout="embedded" />
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
