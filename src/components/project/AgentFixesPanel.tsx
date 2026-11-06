import React, { useCallback, useMemo, useState } from 'react';
import { Check, ClipboardList, FileDown, Loader2 } from 'lucide-react';
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
}

/** Turns scan results into prompts and a FIXES.md checklist for a coding agent. */
export const AgentFixesPanel: React.FC<AgentFixesPanelProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const { confirm } = useConfirm();

  const items = useMemo(() => collectFixItems(analysis), [analysis]);
  const [filter, setFilter] = useState<PriorityFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [writing, setWriting] = useState(false);

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter(item => item.priority === filter)),
    [items, filter],
  );
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filtered.length - visible.length;
  const counts = useMemo(
    () => ({
      all: items.length,
      high: items.filter(i => i.priority === 'high').length,
      medium: items.filter(i => i.priority === 'medium').length,
      low: items.filter(i => i.priority === 'low').length,
    }),
    [items],
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
    const markdown = buildFixesMarkdown(analysis, filtered);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      notify.error('Clipboard access was blocked.', { title: 'Could not copy fixes' });
    }
  }, [analysis, filtered, notify]);

  const writeFixesFile = useCallback(async () => {
    const content = buildFixesMarkdown(analysis, items);
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
  }, [analysis, items, canWriteToRepo, confirm, notify]);

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
              : `${items.length} item${items.length === 1 ? '' : 's'} from this scan, highest priority first. Copy a prompt for one, or hand your agent the whole list.`}
          </p>
        </div>
        {items.length > 0 ? (
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

      {items.length > 0 ? (
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
