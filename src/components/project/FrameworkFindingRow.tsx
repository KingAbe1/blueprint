import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import type { CodebaseAnalysis } from '../../types/codebase';
import { resolveIdeOption } from '../../constants/supportedIdes';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { coerceFindingLine, openInPreferredIde } from '../../utils/openInIde';
import { resolveLineForIdeOpen } from '../../services/findingLineResolve';
import { useNotification } from '../../context/NotificationContext';
import {
  overviewRowEmphasis,
  overviewSeverityLabel,
  type OverviewEmphasis,
} from './overviewUi';
import {
  FindingAiPanel,
  FindingAiProvider,
  FindingAiTrigger,
} from './FindingAiExplanation';

export interface FrameworkFindingRowProps {
  id: string;
  title: string;
  severity: string;
  categoryLabel: string;
  file?: string;
  line?: number;
  impact: string;
  remediation: string;
  frameworkLabel: string;
  analysis?: CodebaseAnalysis;
  rowEmphasis: OverviewEmphasis;
  copied: boolean;
  onCopyPrompt: () => void;
}

function actionBtnClass(isDark: boolean, active = false): string {
  if (active) {
    return isDark
      ? 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-300'
      : 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700';
  }
  return isDark
    ? 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white'
    : 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900';
}

/** Compact Overview finding row with a shared action toolbar. */
export const FrameworkFindingRow: React.FC<FrameworkFindingRowProps> = ({
  id,
  title,
  severity,
  categoryLabel,
  file,
  line,
  impact,
  remediation,
  frameworkLabel,
  analysis,
  rowEmphasis,
  copied,
  onCopyPrompt,
}) => {
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const { preferences } = useSystemSettings();
  const ide = resolveIdeOption(preferences.preferredIdeId);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const body = isDark ? 'text-slate-300' : 'text-slate-700';
  const toolbarShell = isDark
    ? 'inline-flex shrink-0 flex-nowrap items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5'
    : 'inline-flex shrink-0 flex-nowrap items-center gap-0.5 rounded-lg border border-slate-200/90 bg-slate-50/80 p-0.5';

  const rowClass = overviewRowEmphasis(isDark, rowEmphasis);
  const openLine = coerceFindingLine(line);

  const openIde = () => {
    if (!file || !analysis?.rootPath) return;
    void (async () => {
      const resolvedLine =
        openLine ||
        (await resolveLineForIdeOpen({
          rootPath: analysis.rootPath,
          relativePath: file,
          line,
          title,
          impact,
          category: categoryLabel,
        }));
      const result = await openInPreferredIde({
        rootPath: analysis.rootPath,
        relativePath: file,
        line: resolvedLine,
        ideId: preferences.preferredIdeId,
      });
      if (!result.ok) notify.error(result.message, { title: 'Could not open IDE' });
    })();
  };

  return (
    <FindingAiProvider
      findingId={id}
      frameworkLabel={frameworkLabel}
      title={title}
      category={categoryLabel}
      severity={severity}
      impact={impact}
      remediation={remediation}
      file={file}
      focusLine={openLine}
      analysis={analysis}
      variant="toolbar"
    >
      <li className={`py-3 pr-4 sm:pr-5 ${rowClass || 'px-4 sm:px-5'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-medium leading-snug ${titleText}`}>{title}</p>
            <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] ${muted}`}>
              <span className={overviewSeverityLabel(isDark, severity)}>{severity}</span>
              <span aria-hidden>·</span>
              <span>{categoryLabel}</span>
              {file ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="max-w-[min(100%,28rem)] truncate font-mono text-[10.5px] opacity-90">
                    {file}
                    {openLine ? `:${openLine}` : ''}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className={toolbarShell} role="group" aria-label="Finding actions">
            {file && analysis?.rootPath ? (
              <button
                type="button"
                onClick={openIde}
                className={actionBtnClass(isDark)}
                title={`Open in ${ide.name}${openLine ? ` at line ${openLine}` : ''}`}
              >
                <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
                {ide.shortName}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCopyPrompt}
              className={actionBtnClass(isDark, copied)}
              title="Copy fix prompt"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 opacity-80" aria-hidden />
                  Prompt
                </>
              )}
            </button>
            <FindingAiTrigger />
          </div>
        </div>

        <p className={`mt-2 line-clamp-2 text-xs leading-relaxed ${body}`}>{impact}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setDetailsOpen(open => !open)}
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
              isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? (
              <ChevronDown className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden />
            )}
            {detailsOpen ? 'Hide details' : 'Details & fix'}
          </button>
        </div>

        {detailsOpen ? (
          <div className={`mt-2 border-t pt-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-200/80'}`}>
            <p className={`text-[10px] font-medium uppercase tracking-wide ${muted}`}>Suggested fix</p>
            <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{remediation}</p>
          </div>
        ) : null}

        <FindingAiPanel className="mt-2" />
      </li>
    </FindingAiProvider>
  );
};
