import type { Theme, ThemePreference } from '../types/project';
import { isDesktopApp } from './platform';
import {
  readNativeOsTheme,
  readSystemTheme,
  syncNativeAppIcon,
  syncNativeWindowTheme,
} from './desktopThemeBridge';
import {
  applyThemeToDocument,
  getInitialThemePreference,
  getSystemTheme,
  resetThemePreferenceToSystem,
} from './themePreference';

let bootstrappedPreference: ThemePreference = 'system';
let bootstrappedResolved: Theme = 'dark';

export function getBootstrappedPreference(): ThemePreference {
  return bootstrappedPreference;
}

export function getBootstrappedResolvedTheme(): Theme {
  return bootstrappedResolved;
}

export async function bootstrapTheme(): Promise<void> {
  bootstrappedPreference = getInitialThemePreference();
  const nativeOs = await readNativeOsTheme();

  // Header toggle on a dark Mac pins "light" — reset so we follow macOS again.
  const osIsDark = nativeOs === 'dark' || (nativeOs === null && getSystemTheme() === 'dark');
  if (bootstrappedPreference === 'light' && osIsDark) {
    bootstrappedPreference = 'system';
    resetThemePreferenceToSystem();
  }

  if (isDesktopApp()) {
    await syncNativeWindowTheme(bootstrappedPreference);
  }

  if (bootstrappedPreference === 'system') {
    bootstrappedResolved = isDesktopApp() ? await readSystemTheme() : getSystemTheme();
  } else {
    bootstrappedResolved = bootstrappedPreference;
  }

  applyThemeToDocument(bootstrappedResolved);

  if (isDesktopApp()) {
    await syncNativeAppIcon(bootstrappedResolved);
  }
}
