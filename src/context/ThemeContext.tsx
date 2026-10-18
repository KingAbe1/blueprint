import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Theme, ThemePreference } from '../types/project';
import {
  readSystemTheme,
  subscribeNativeThemeChanges,
  syncNativeShell,
} from '../utils/desktopThemeBridge';
import {
  getBootstrappedPreference,
  getBootstrappedResolvedTheme,
} from '../utils/themeBootstrap';
import {
  applyThemeToDocument,
  getSystemTheme,
  markThemePreferenceChosen,
  persistThemePreference,
} from '../utils/themePreference';

interface ThemeContextType {
  themePreference: ThemePreference;
  theme: Theme;
  setThemePreference: (preference: ThemePreference) => void;
  /** @deprecated Use setThemePreference — kept for compatibility. */
  setTheme: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  isDark: boolean;
  followsSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getBootstrappedPreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(() => {
    const preference = getBootstrappedPreference();
    if (preference === 'system') {
      return getBootstrappedResolvedTheme();
    }
    return getSystemTheme();
  });

  const theme = useMemo(
    () => (themePreference === 'system' ? systemTheme : themePreference),
    [themePreference, systemTheme],
  );

  useEffect(() => {
    persistThemePreference(themePreference);
    applyThemeToDocument(theme);
    void syncNativeShell(themePreference, theme);
  }, [themePreference, theme]);

  useEffect(() => {
    let cancelled = false;

    void readSystemTheme().then(next => {
      if (!cancelled) setSystemTheme(next);
    });

    return () => {
      cancelled = true;
    };
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'system') return;

    let cancelled = false;
    let unlistenNative: (() => void) | undefined;
    let media: MediaQueryList | undefined;

    const apply = (next: Theme) => {
      if (!cancelled) setSystemTheme(next);
    };

    void readSystemTheme().then(apply);

    void subscribeNativeThemeChanges(apply).then(unlisten => {
      unlistenNative = unlisten;
    });

    media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => {
      void readSystemTheme().then(apply);
    };
    media.addEventListener('change', onMediaChange);

    return () => {
      cancelled = true;
      unlistenNative?.();
      media?.removeEventListener('change', onMediaChange);
    };
  }, [themePreference]);

  const setThemePreference = (preference: ThemePreference) => {
    markThemePreferenceChosen();
    setThemePreferenceState(preference);
  };

  const toggleTheme = () => {
    markThemePreferenceChosen();
    setThemePreferenceState(theme === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'dark';
  const followsSystem = themePreference === 'system';

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        theme,
        setThemePreference,
        setTheme: setThemePreference,
        toggleTheme,
        isDark,
        followsSystem,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
