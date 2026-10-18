import { BRAND_NAME } from '../constants/brand';
import { isDesktopApp } from './platform';

export interface NativeNotificationPayload {
  title: string;
  body: string;
}

let nativePermissionPrimed = false;

export async function ensureNativeNotificationPermission(): Promise<boolean> {
  if (isDesktopApp()) {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      if (await isPermissionGranted()) return true;
      if (nativePermissionPrimed) return false;
      nativePermissionPrimed = true;
      return (await requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  if (nativePermissionPrimed) return false;
  nativePermissionPrimed = true;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** True when the main window is focused (in-app toasts are enough). */
export async function isAppWindowFocused(): Promise<boolean> {
  if (typeof document !== 'undefined' && document.hasFocus()) {
    return true;
  }

  if (!isDesktopApp()) {
    return document.hasFocus();
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return await getCurrentWindow().isFocused();
  } catch {
    return document.hasFocus();
  }
}

/**
 * OS notification when the app is not focused (Tauri plugin on desktop, Web Notifications in browser).
 * No-op when focused — use in-app toasts instead.
 */
export async function sendNativeNotificationIfBackground(
  payload: NativeNotificationPayload,
): Promise<void> {
  if (await isAppWindowFocused()) return;

  const granted = await ensureNativeNotificationPermission();
  if (!granted) return;

  const title = payload.title || BRAND_NAME;
  const body = payload.body;

  if (isDesktopApp()) {
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
      return;
    } catch {
      // Fall through to web API when plugin unavailable (e.g. web dev).
    }
  }

  try {
    new Notification(title, { body });
  } catch {
    // Restricted context — ignore.
  }
}

/** Dev/QA only — sends OS notification even when the window is focused. */
export async function sendNativeNotificationForced(payload: NativeNotificationPayload): Promise<boolean> {
  const granted = await ensureNativeNotificationPermission();
  if (!granted) return false;

  const title = payload.title || BRAND_NAME;
  const body = payload.body;

  if (isDesktopApp()) {
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
      return true;
    } catch {
      return false;
    }
  }

  try {
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}
