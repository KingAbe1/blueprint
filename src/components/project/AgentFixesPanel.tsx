import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, FileDown, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import type { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  FIXES_FILE_PATH,
  buildFixPrompt,
  buildFixesMarkdown,
  collectFixItems,
  type FixPromptItem,
} from '../../services/fixPromptService';
import { findingKey } from '../../services/scanHistoryService';
import {
  canListChangedFiles,
  describeScope,
  filterItemsToChangedFiles,
  listChangedFiles,
  type ChangeScope,
  type ChangedFiles,
} from '../../services/changedFilesService';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { exportHandoffFiles, inspectHandoffConflicts, type HandoffTarget } from '../../services/handoffExportService';
import { saveExportText } from '../../utils/exportFileSave';
import { isDesktopApp } from '../../utils/platform';
import { FrameworkFindingRow } from './FrameworkFindingRow';
import { overviewBorderClass, overviewDivideClass, overviewPanelClass, type OverviewEmphasis } from './overviewUi';

const PREVIEW_COUNT = 8;

type PriorityFilter = 'all' | FixPromptItem['priority'];

function severityForPriority(priority: FixPromptItem['priority']): string {
  if (priority === 'high') return 'critical';
  if (priority === 'medium') return 'warning';
  return 'optimization';
}

function emphasisForPriority(priority: FixPromptItem['priority']): OverviewEmphasis {
  if (priority === 'high') return 'critical';
  if (priority === 'medium') return 'warning';
  return 'neutral';
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

interface AgentFixesPanelProps {
  analysis: CodebaseAnalysis;
  /** Finding keys that were not in the previous scan. */
  newFindingKeys?: Set<string>;
}

/** Turns scan results into prompts and a FIXES.md checklist for a coding agent. */
export const AgentFixesPanel: React.FC<AgentFixesPanelProps> = ({ analysis, newFindingKeys }) => {
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const { confirm } = useConfirm();

  const items = useMemo(() => collectFixItems(analysis), [analysis]);
  const [filter, setFilter] = useState<PriorityFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [writing, setWriting] = useState(false);

  const scopeAvailable = canListChangedFiles(analysis.rootPath, analysis.git?.tracked);
  const [scope, setScope] = useState<ChangeScope>('all');
  const [changed, setChanged] = useState<ChangedFiles | null>(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [scopeRefresh, setScopeRefresh] = useState(0);

  // Changed files are read live from git; re-read when the scope changes, after a rescan, or on refresh.
  useEffect(() => {
    if (scope === 'all' || !scopeAvailable) {
      setChanged(null);
      setScopeError(null);
      return;
    }
    let cancelled = false;
    setScopeLoading(true);
    setScopeError(null);
    listChangedFiles(analysis.rootPath, scope)
      .then(result => {
        if (!cancelled) setChanged(result);
      })
      .catch(error => {
        if (cancelled) return;
        setChanged(null);
        setScopeError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setScopeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, scopeAvailable, analysis.rootPath, analysis.scannedAt, scopeRefresh]);

  const scopedItems = useMemo(
    () => (scope !== 'all' && changed ? filterItemsToChangedFiles(items, changed) : scope === 'all' ? items : []),
    [items, scope, changed],
  );
  const scopeNote = scope !== 'all' && changed ? describeScope(changed) : undefined;

  const filtered = useMemo(
    () => (filter === 'all' ? scopedItems : scopedItems.filter(item => item.priority === filter)),
    [scopedItems, filter],
  );
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filtered.length - visible.length;
  const counts = useMemo(
    () => ({
      all: scopedItems.length,
      high: scopedItems.filter(i => i.priority === 'high').length,
      medium: scopedItems.filter(i => i.priority === 'medium').length,
      low: scopedItems.filter(i => i.priority === 'low').length,
    }),
    [scopedItems],
  );

  const canWriteToRepo = isDesktopApp() && isAbsolutePath(analysis.rootPath);

  const copyPrompt = useCallback(
    async (item: FixPromptItem) => {
      try {
        await navigator.clipboard.writeText(buildFixPrompt(item, analysis));
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(current => (current === item.id ? null : current)), 2000);
      } catch {
        notify.error('Clipboard access was blocked.', { title: 'Could not copy prompt' });
      }
    },
    [analysis, notify],
  );

  const copyAll = useCallback(async () => {
    const markdown = buildFixesMarkdown(analysis, filtered, { scopeNote });
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      notify.error('Clipboard access was blocked.', { title: 'Could not copy fixes' });
    }
  }, [analysis, filtered, scopeNote, notify]);

  const writeFixesFile = useCallback(async () => {
    const content = buildFixesMarkdown(analysis, scopedItems, { scopeNote });
    setWriting(true);
    try {
      if (canWriteToRepo) {
        const target: HandoffTarget = { kind: 'tauri', path: analysis.rootPath, name: analysis.rootName };
        const files = [{ path: FIXES_FILE_PATH, description: 'Fix checklist for coding agents', content }];
        const conflicts = await inspectHandoffConflicts(target, files);
        if (conflicts.length > 0) {
          const ok = await confirm({
            title: `Replace ${FIXES_FILE_PATH}?`,
            description:
              'This project already has a FIXES.md. Writing a new one replaces it, including any items your agent already checked off.',
            confirmLabel: 'Replace',
          });
          if (!ok) return;
        }
        await exportHandoffFiles(target, files, true);
        notify.success(`Ask your agent to "work through ${FIXES_FILE_PATH}".`, {
          title: `Wrote ${FIXES_FILE_PATH}`,
        });
      } else {
        const saved = await saveExportText(content, 'FIXES.md', 'md');
        if (saved) {
          notify.success(`Put it in your repo as ${FIXES_FILE_PATH} and ask your agent to work through it.`, {
            title: 'Saved FIXES.md',
          });
        }
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : String(error), { title: 'Could not write FIXES.md' });
    } finally {
      setWriting(false);
    }
  }, [analysis, scopedItems, scopeNote, canWriteToRepo, confirm, notify]);

  const panel = overviewPanelClass(isDark);
  const border = overviewBorderClass(isDark);
  const divide = overviewDivideClass(isDark);
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-white' : 'text-slate-900';
  const linkBtn = isDark
    ? 'inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50';
  const chip = (active: boolean) =>
    active
      ? isDark
        ? 'rounded-md bg-white/[0.08] px-2 py-1 text-[11px] font-medium text-white'
        : 'rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white'
      : isDark
        ? 'rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
        : 'rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800';

  return (
    <section id="quality-agent-fixes-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 ${border}`}>
        <div className="min-w-0">
          <h2 className={`text-[15px] font-medium ${title}`}>Fix with your agent</h2>
          <p className={`mt-0.5 text-[13px] ${muted}`}>
            {items.length === 0
              ? 'Nothing to fix in this scan.'
              : scopeNote
                ? `${scopedItems.length} of ${items.length} items are in files touched by ${scopeNote}.`
                : `${items.length} item${items.length === 1 ? '' : 's'} from this scan, highest priority first. Copy a prompt for one, or hand your agent the whole list.`}
          </p>
        </div>
        {scopedItems.length > 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void copyAll()} className={linkBtn} title="Copy the filtered list as a checklist prompt">
              {copiedAll ? <Check className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
              {copiedAll ? 'Copied' : filter === 'all' ? 'Copy all' : `Copy ${filter}`}
            </button>
            <button
              type="button"
              onClick={() => void writeFixesFile()}
              disabled={writing}
              className={linkBtn}
              title={canWriteToRepo ? `Write ${FIXES_FILE_PATH} into ${analysis.rootName}` : 'Save FIXES.md'}
            >
              {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              {canWriteToRepo ? `Write ${FIXES_FILE_PATH}` : 'Save FIXES.md'}
            </button>
          </div>
        ) : null}
      </header>

      {items.length > 0 && scopeAvailable ? (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-2 sm:px-6 ${border}`}>
          <div className="flex items-center gap-1" role="group" aria-label="Which changes to check">
            <GitBranch className={`mr-1 h-3.5 w-3.5 ${muted}`} aria-hidden />
            {(
              [
                ['all', 'Whole repo'],
                ['branch', 'This branch'],
                ['uncommitted', 'Uncommitted'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setScope(key);
                  setShowAll(false);
                }}
                className={chip(scope === key)}
                aria-pressed={scope === key}
                title={
                  key === 'branch'
                    ? 'Only findings in files changed since this branch left main, including uncommitted work'
                    : key === 'uncommitted'
                      ? 'Only findings in files with uncommitted changes'
                      : 'Every finding from the scan'
                }
              >
                {label}
              </button>
            ))}
          </div>
          {scope !== 'all' ? (
            <div className={`flex min-w-0 items-center gap-2 text-[11px] ${muted}`}>
              {scopeLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : scopeError ? (
                <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>{scopeError}</span>
              ) : changed ? (
                <span>
                  {changed.files.length} changed file{changed.files.length === 1 ? '' : 's'}
                  {changed.base ? ` vs ${changed.base}` : ''} · scanned {formatRelativeTime(analysis.scannedAt).replace('Just now', 'just now')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setScopeRefresh(n => n + 1)}
                disabled={scopeLoading}
                className={`inline-flex items-center rounded p-0.5 hover:opacity-80 disabled:opacity-40`}
                title="Re-read changed files from git"
                aria-label="Re-read changed files from git"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {scope !== 'all' && changed && !scopeLoading && scopedItems.length === 0 && items.length > 0 ? (
        <p className={`px-5 py-6 text-center text-[13px] sm:px-6 ${muted}`}>
          No findings in the {changed.files.length} file{changed.files.length === 1 ? '' : 's'} touched by {describeScope(changed)}.
          Rescan first if you edited files after the last scan.
        </p>
      ) : null}

      {scopedItems.length > 0 ? (
        <>
          <div className={`flex flex-wrap items-center gap-1 border-b px-5 py-2 sm:px-6 ${border}`} role="group" aria-label="Filter by priority">
            {(['all', 'high', 'medium', 'low'] as const).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key);
                  setShowAll(false);
                }}
                className={chip(filter === key)}
                aria-pressed={filter === key}
                disabled={key !== 'all' && counts[key] === 0}
              >
                {key === 'all' ? 'All' : key[0].toUpperCase() + key.slice(1)} {counts[key]}
              </button>
            ))}
          </div>

          <ul className={`divide-y ${divide}`}>
            {visible.map(item => (
              <FrameworkFindingRow
                key={item.id}
                id={item.id}
                title={item.title}
                severity={severityForPriority(item.priority)}
                categoryLabel={item.frameworkLabel ? `${item.frameworkLabel} · ${item.category}` : item.category}
                file={item.file}
                line={item.line}
                impact={item.impact}
                remediation={item.remediation || 'Investigate the location above and apply the smallest safe fix.'}
                frameworkLabel={item.frameworkLabel || 'General'}
                analysis={analysis}
                rowEmphasis={emphasisForPriority(item.priority)}
                copied={copiedId === item.id}
                onCopyPrompt={() => void copyPrompt(item)}
                badge={newFindingKeys?.has(findingKey(item)) ? 'New' : undefined}
              />
            ))}
          </ul>

          {hiddenCount > 0 || (showAll && filtered.length > PREVIEW_COUNT) ? (
            <div className={`border-t px-5 py-3 sm:px-6 ${border}`}>
              <button
                type="button"
                onClick={() => setShowAll(open => !open)}
                className={`text-[13px] font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
              >
                {hiddenCount > 0 ? `Show ${hiddenCount} more` : 'Show fewer'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
};
