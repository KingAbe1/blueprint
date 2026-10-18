import type { Theme, ThemePreference } from '../types/project';

const STORAGE_KEY = 'blueprint_theme';
const USER_SET_KEY = 'blueprint_theme_user_set';

export function hasUserThemeChoice(): boolean {
  try {
    return localStorage.getItem(USER_SET_KEY) === '1';
  } catch {
    return false;
  }
}

export function markThemePreferenceChosen(): void {
  try {
    localStorage.setItem(USER_SET_KEY, '1');
  } catch {
    // Non-fatal.
  }
}

export function readStoredThemePreference(): ThemePreference | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage errors; fall back to system.
  }
  return null;
}

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): Theme {
  if (preference === 'system') return getSystemTheme();
  return preference;
}

export function getInitialThemePreference(): ThemePreference {
  if (!hasUserThemeChoice()) {
    return 'system';
  }
  const stored = readStoredThemePreference();
  if (stored === 'system' || stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'system';
}

/** Clears a pinned light/dark choice so appearance follows macOS again. */
export function resetThemePreferenceToSystem(): void {
  try {
    localStorage.removeItem(USER_SET_KEY);
    localStorage.setItem(STORAGE_KEY, 'system');
  } catch {
    // Non-fatal.
  }
}

export function persistThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Preference still applies for this session.
  }
}

export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;
  const isDark = theme === 'dark';
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  const bg = isDark ? '#101113' : '#f8fafc';
  root.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
}
