import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface CodebaseRescanOverlayState {
  projectLabel: string;
  progress: number;
  phase: string;
}

interface CodebaseRescanOverlayProps {
  state: CodebaseRescanOverlayState;
}

export const CodebaseRescanOverlay: React.FC<CodebaseRescanOverlayProps> = ({ state }) => {
  const { isDark } = useTheme();
  const progress = Math.max(0, Math.min(100, state.progress));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rescan-overlay-title"
      aria-describedby="rescan-overlay-desc"
      aria-busy={progress < 100}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-hidden />

      <div
        className={`relative w-full max-w-md rounded-2xl border px-8 py-7 shadow-2xl ${
          isDark ? 'border-white/[0.1] bg-[#16171B] text-white' : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <Loader2
            className={`h-9 w-9 animate-spin ${progress >= 100 ? 'opacity-40' : ''} ${
              isDark ? 'text-blue-400' : 'text-blue-600'
            }`}
          />
          <p id="rescan-overlay-title" className="mt-4 text-sm font-semibold">
            Rescanning {state.projectLabel}
          </p>
          <p
            id="rescan-overlay-desc"
            className={`mt-1.5 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            {state.phase}
          </p>

          <div className="mt-5 w-full">
            <div
              className={`h-1.5 w-full overflow-hidden rounded-full ${
                isDark ? 'bg-white/[0.08]' : 'bg-slate-100'
              }`}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                  progress >= 100
                    ? isDark
                      ? 'bg-emerald-400'
                      : 'bg-emerald-500'
                    : isDark
                      ? 'bg-blue-400'
                      : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={`mt-2 text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {Math.round(progress)}%
            </p>
          </div>

          <p className={`mt-4 text-[11px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Stay on this project while the scan runs. Navigation is paused until analysis finishes.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
