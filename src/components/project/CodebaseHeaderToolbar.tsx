import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useCodebaseWorkspace } from '../../context/CodebaseWorkspaceContext';

export const CodebaseHeaderToolbar: React.FC = () => {
  const { isDark } = useTheme();
  const { enabled, toolbar } = useCodebaseWorkspace();

  if (!enabled) return null;

  const { rescan, isRescanning, lastScannedLabel, exportReport } = toolbar;

  const iconButton = isDark
    ? 'border-white/[0.12] text-slate-300 hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';

  return (
    <div className="flex items-center gap-1">
      {rescan ? (
        <button
          type="button"
          onClick={() => void rescan()}
          disabled={isRescanning}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${iconButton}`}
          title={
            lastScannedLabel
              ? `Last scan: ${lastScannedLabel}. Click to rescan.`
              : 'Rescan folder'
          }
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRescanning ? 'Scanning…' : 'Rescan'}</span>
        </button>
      ) : null}
      {exportReport ? (
        <button
          type="button"
          onClick={exportReport}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${iconButton}`}
          title="Export project summary as Markdown"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      ) : null}
    </div>
  );
};
