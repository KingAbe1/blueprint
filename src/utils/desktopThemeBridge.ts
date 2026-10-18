import { isTauri } from '@tauri-apps/api/core';
import { brandAppIconPngSrc } from '../constants/brandAssets';
import type { Theme, ThemePreference } from '../types/project';
import { isDesktopApp } from './platform';
import { getSystemTheme } from './themePreference';

let lastNativeAppIconTheme: Theme | null = null;

function isNativeShell(): boolean {
  return isTauri() || isDesktopApp();
}

type NativeTheme = Theme | null;

/** macOS appearance from Rust (`AppleInterfaceStyle`); null in browser dev. */
export async function readNativeOsTheme(): Promise<Theme | null> {
  if (!isNativeShell()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const value = await invoke<string>('get_os_theme');
    if (value === 'dark' || value === 'light') return value;
  } catch {
    // Fall through to webview heuristics.
  }
  return null;
}

/** Resolved appearance when preference is System (macOS / prefers-color-scheme). */
function resolveSystemAppearance(native: string | null | undefined, osTheme: Theme): Theme {
  if (native === 'dark') return 'dark';
  if (native === 'light' && osTheme === 'dark') return 'dark';
  if (native === 'light') return 'light';
  return osTheme;
}

/** Read OS appearance for System preference. */
export async function readSystemTheme(): Promise<Theme> {
  const fromNative = await readNativeOsTheme();
  if (fromNative) return fromNative;

  const osTheme = getSystemTheme();
  if (!isNativeShell()) {
    return osTheme;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const native = await getCurrentWindow().theme();
    return resolveSystemAppearance(native, osTheme);
  } catch {
    return osTheme;
  }
}

/** Keep Tauri app + window chrome aligned with appearance preference (System = follow macOS). */
export async function syncNativeWindowTheme(preference: ThemePreference): Promise<void> {
  if (!isNativeShell()) return;

  const value: NativeTheme = preference === 'system' ? null : preference;

  try {
    const { setTheme: setAppTheme } = await import('@tauri-apps/api/app');
    await setAppTheme(value);
  } catch {
    // Browser dev or missing permission — UI still follows resolved theme classes.
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTheme(value);
  } catch {
    // Window theme is optional when app theme is set (macOS is app-wide).
  }
}

/** Native shell: OS appearance preference + dock/window icon for resolved light/dark. */
export async function syncNativeShell(
  preference: ThemePreference,
  resolvedTheme: Theme,
): Promise<void> {
  await syncNativeWindowTheme(preference);
  await syncNativeAppIcon(resolvedTheme);
}

/** Updates dock (macOS) / window icon to match resolved light/dark theme. */
export async function syncNativeAppIcon(resolvedTheme: Theme): Promise<void> {
  if (!isNativeShell()) return;
  if (lastNativeAppIconTheme === resolvedTheme) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_theme_app_icon', { theme: resolvedTheme });
    lastNativeAppIconTheme = resolvedTheme;
  } catch {
    // Fallback: window.setIcon is a no-op on macOS but helps on Windows/Linux dev.
    try {
      const { Image } = await import('@tauri-apps/api/image');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const iconUrl = new URL(brandAppIconPngSrc(resolvedTheme), window.location.href);
      const response = await fetch(iconUrl);
      if (!response.ok) return;

      const bytes = new Uint8Array(await response.arrayBuffer());
      const image = await Image.fromBytes(bytes);
      await getCurrentWindow().setIcon(image);
      await image.close();
      lastNativeAppIconTheme = resolvedTheme;
    } catch {
      // In-app BrandMark still updates.
    }
  }
}

export async function subscribeNativeThemeChanges(
  onChange: (theme: Theme) => void,
): Promise<(() => void) | undefined> {
  if (!isNativeShell()) return undefined;

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const unlisten = await getCurrentWindow().onThemeChanged(({ payload }) => {
      void readNativeOsTheme().then(fromNative => {
        if (fromNative) {
          onChange(fromNative);
          return;
        }
        onChange(resolveSystemAppearance(payload, getSystemTheme()));
      });
    });
    return unlisten;
  } catch {
    return undefined;
  }
}
