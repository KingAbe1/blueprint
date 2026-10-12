/** True when running inside the Tauri desktop shell (not the Vite dev browser tab alone). */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.classList.contains('desktop-app')) return true;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

export function markDesktopAppShell(): void {
  if (typeof document === 'undefined') return;
  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
    document.documentElement.classList.add('desktop-app');
  }
}
