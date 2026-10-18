import React, { useEffect } from 'react';
import { MonitorCog, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';

export const SystemSettingsModal: React.FC = () => {
  const {
    isDark,
    themePreference,
    setThemePreference,
    isSystemSettingsOpen,
    setIsSystemSettingsOpen,
  } = useTheme();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSystemSettingsOpen) setIsSystemSettingsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSystemSettingsOpen, setIsSystemSettingsOpen]);

  if (!isSystemSettingsOpen) return null;

  const border = overviewBorderClass(isDark);
  const panel = overviewPanelClass(isDark);
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setIsSystemSettingsOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-settings-title"
        className={`flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel}`}
      >
        <header className={`shrink-0 border-b px-5 py-4 sm:px-6 ${border}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MonitorCog className={`h-4 w-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} aria-hidden />
                <h2 id="system-settings-title" className={`text-[15px] font-medium ${titleText}`}>
                  System settings
                </h2>
              </div>
              <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
                Appearance and other app preferences that stay on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSystemSettingsOpen(false)}
              className={`shrink-0 rounded-lg p-2 transition-colors ${isDark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="px-5 py-5 sm:px-6">
          <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>Appearance</p>
          <div
            className={`mt-2 inline-flex gap-0.5 rounded-lg border p-0.5 ${border} ${isDark ? 'bg-black/20' : 'bg-slate-100/90'}`}
            role="radiogroup"
            aria-label="Theme"
          >
            {(
              [
                { id: 'system' as const, label: 'System' },
                { id: 'light' as const, label: 'Light' },
                { id: 'dark' as const, label: 'Dark' },
              ] as const
            ).map(option => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={themePreference === option.id}
                onClick={() => setThemePreference(option.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  themePreference === option.id
                    ? isDark
                      ? 'bg-white/[0.1] text-white shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className={`mt-2 text-[11px] leading-relaxed ${muted}`}>
            System follows your computer&apos;s light or dark mode and updates when it changes.
          </p>
        </div>
      </div>
    </div>
  );
};
