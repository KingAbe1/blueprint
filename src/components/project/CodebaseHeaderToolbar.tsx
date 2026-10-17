import React, { useState } from 'react';
import { ChevronDown, Download, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useCodebaseWorkspace } from '../../context/CodebaseWorkspaceContext';

export const CodebaseHeaderToolbar: React.FC = () => {
  const { isDark } = useTheme();
  const { enabled, toolbar } = useCodebaseWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!enabled) return null;

  const {
    rescan,
    isRescanning,
    openPreferredIde,
    preferredIdeShortName = 'IDE',
    exportReport,
    deleteProject,
  } = toolbar;

  const iconButton = isDark
    ? 'border-white/[0.12] text-slate-300 hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';

  return (
    <div className="flex items-center gap-1">
      {openPreferredIde ? (
        <button
          type="button"
          onClick={openPreferredIde}
          className={`hidden items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium sm:inline-flex ${iconButton}`}
          title={`Open in ${preferredIdeShortName}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>{preferredIdeShortName}</span>
        </button>
      ) : null}
      {rescan ? (
        <button
          type="button"
          onClick={() => void rescan()}
          disabled={isRescanning}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${iconButton}`}
          title="Rescan folder"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRescanning ? 'Scanning…' : 'Rescan'}</span>
        </button>
      ) : null}
      {(exportReport || deleteProject || openPreferredIde) ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className={`rounded-lg border p-1.5 ${iconButton}`}
            aria-label="More project actions"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div
              className={`absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border p-1 shadow-lg ${
                isDark ? 'border-white/[0.1] bg-[#16171B]' : 'border-slate-200 bg-white'
              }`}
              onMouseLeave={() => setMenuOpen(false)}
            >
              {openPreferredIde ? (
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs sm:hidden ${
                    isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    openPreferredIde();
                    setMenuOpen(false);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in {preferredIdeShortName}
                </button>
              ) : null}
              {exportReport ? (
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ${
                    isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    exportReport();
                    setMenuOpen(false);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export summary
                </button>
              ) : null}
              {deleteProject ? (
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-rose-500 ${
                    isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'
                  }`}
                  onClick={() => {
                    deleteProject();
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove project
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
