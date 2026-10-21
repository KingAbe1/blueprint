import type { MouseEvent } from 'react';
import { isDesktopApp } from './platform';

/**
 * Open an http(s) URL in the system browser on desktop, or a new tab on web.
 * Tauri webviews block/ignore normal target=_blank navigation for external links.
 */
export async function openExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  if (isDesktopApp()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_external_url', { url: trimmed });
      return;
    } catch {
      // Fall through to window.open if invoke fails
    }
  }

  window.open(trimmed, '_blank', 'noopener,noreferrer');
}

/** Use on <a> click: desktop uses shell open; web keeps default new-tab behavior. */
export function handleExternalLinkClick(event: MouseEvent<HTMLAnchorElement>, url?: string): void {
  const href = (url || event.currentTarget.href || '').trim();
  if (!href || !isDesktopApp()) return;
  // Allow modified clicks to fall through when possible
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  void openExternalUrl(href);
}
