import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { ConfirmRequest } from '../../context/ConfirmContext';
import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';

interface ConfirmDialogProps {
  request: ConfirmRequest;
  onClose: (confirmed: boolean) => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ request, onClose }) => {
  const { isDark } = useTheme();
  const border = overviewBorderClass(isDark);
  const panel = overviewPanelClass(isDark);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const danger = request.tone === 'danger';
  const ghostButton = isDark
    ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50';
  const confirmButton = danger
    ? isDark
      ? 'border border-rose-500/35 bg-rose-500/[0.14] text-rose-100 hover:border-rose-500/50 hover:bg-rose-500/22'
      : 'border border-rose-600/15 bg-rose-600 text-white hover:bg-rose-700'
    : isDark
      ? 'border border-blue-500/35 bg-blue-500/[0.14] text-blue-100 hover:border-blue-500/45 hover:bg-blue-500/22'
      : 'border border-blue-600/15 bg-blue-600 text-white hover:bg-blue-700';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${panel}`}
      >
        <header className={`border-b px-5 py-4 sm:px-6 ${border}`}>
          <div className="flex items-start gap-3">
            {danger ? (
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
                <AlertTriangle className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className={`text-[15px] font-medium ${titleText}`}>
                {request.title}
              </h2>
              <p id="confirm-dialog-description" className={`mt-1.5 text-[13px] leading-relaxed ${muted}`}>
                {request.description}
              </p>
            </div>
          </div>
        </header>
        <footer className={`flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 ${border}`}>
          <button
            type="button"
            onClick={() => onClose(false)}
            className={`inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-[13px] font-medium transition-colors ${ghostButton}`}
          >
            {request.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => onClose(true)}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors ${confirmButton}`}
          >
            {request.confirmLabel ?? 'Continue'}
          </button>
        </footer>
      </div>
    </div>
  );
};
