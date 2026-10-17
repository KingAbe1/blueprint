import { useEffect, useState } from 'react';
import { isDesktopApp } from '../utils/platform';

/** Tracks whether the Tauri window is maximized (desktop only). */
export function useTauriWindowMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktopApp()) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const sync = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const next = await win.isMaximized();
        if (!cancelled) {
          setMaximized(next);
          document.documentElement.classList.toggle('window-maximized', next);
        }
      } catch {
        // ignore outside Tauri runtime
      }
    };

    void (async () => {
      await sync();
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        unlisten = await getCurrentWindow().onResized(() => {
          void sync();
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
      document.documentElement.classList.remove('window-maximized');
    };
  }, []);

  return maximized;
}
