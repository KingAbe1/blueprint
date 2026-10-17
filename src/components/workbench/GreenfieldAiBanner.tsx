import React, { useState } from 'react';
import { PlugZap, X } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import { overviewBorderClass } from '../project/overviewUi';

const DISMISS_KEY = 'blueprint_greenfield_ai_banner_dismissed';

export const GreenfieldAiBanner: React.FC = () => {
  const { isAiConfigured, setIsSettingsOpen } = useAI();
  const { isDark } = useTheme();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');

  if (isAiConfigured || dismissed) return null;

  const border = overviewBorderClass(isDark);

  return (
    <div
      className={`shrink-0 border-b px-4 py-2.5 sm:px-6 ${border} ${isDark ? 'bg-blue-500/[0.06]' : 'bg-blue-50/80'}`}
      role="status"
    >
      <div className="mx-auto flex max-w-none items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PlugZap className={`h-4 w-4 shrink-0 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
          <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-100/90' : 'text-blue-900'}`}>
            Connect AI to generate build questions and polish your brief. You can still use the standard question template without a key.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="btn-primary-blue px-3 py-1.5 text-[11px] font-medium text-white"
          >
            Connect AI
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, 'true');
              setDismissed(true);
            }}
            className={`rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-white/[0.06] hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
