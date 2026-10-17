import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const RouteLoadingFallback: React.FC<{ label?: string }> = ({
  label = 'Loading…',
}) => {
  const { isDark } = useTheme();
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-3 ${
        isDark ? 'text-slate-400' : 'text-slate-500'
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className={`h-8 w-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
};
