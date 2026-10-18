import { isDesktopApp, isMacOS } from './platform';

/** Opens OS notification settings when supported (desktop). */
export async function openNotificationSystemSettings(): Promise<boolean> {
  if (!isDesktopApp()) return false;

  let url: string | undefined;
  if (isMacOS()) {
    url = 'x-apple.systempreferences:com.apple.Notifications-Settings.extension';
  } else if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    url = 'ms-settings:notifications';
  }

  if (!url) return false;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_external_url', { url });
    return true;
  } catch {
    return false;
  }
}
