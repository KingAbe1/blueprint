import React from 'react';
import { isDesktopApp } from '../../utils/platform';
import { useTheme } from '../../context/ThemeContext';
import { useTauriWindowMaximized } from '../../hooks/useTauriWindowMaximized';

/** Reserves the macOS overlay title-bar zone so traffic lights do not sit on app controls. */
export const DesktopTitlebarStrip: React.FC = () => {
  const desktop = isDesktopApp();
  const { isDark } = useTheme();
  const chromeExpanded = useTauriWindowMaximized();

  if (!desktop || chromeExpanded) return null;

  return (
    <div
      data-tauri-drag-region
      className={`drag-window desktop-titlebar-strip shrink-0 border-b ${
        isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-white'
      }`}
      aria-hidden
    />
  );
};
