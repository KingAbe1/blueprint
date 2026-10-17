import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';

export function workbenchCanvasClass(isDark: boolean): string {
  return isDark ? 'bg-[#0E0F12]' : 'bg-[#F6F7F9]';
}

export function workbenchPagePadding(desktop: boolean): string {
  return desktop
    ? 'w-full px-6 py-7 lg:px-8 xl:px-10'
    : 'w-full px-5 py-7 sm:px-6 lg:px-8 lg:py-8';
}

export function workbenchTheme(isDark: boolean) {
  return {
    border: overviewBorderClass(isDark),
    panel: overviewPanelClass(isDark),
    muted: isDark ? 'text-slate-400' : 'text-slate-500',
    title: isDark ? 'text-slate-100' : 'text-slate-900',
    inner: isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200/90 bg-slate-50/80',
    input: isDark
      ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
      : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400',
  };
}
