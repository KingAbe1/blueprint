import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import {
  persistSystemPreferences,
  readSystemPreferences,
  SystemPreferences,
} from '../utils/systemPreferences';

interface SystemSettingsContextType {
  preferences: SystemPreferences;
  setPreference: <K extends keyof SystemPreferences>(key: K, value: SystemPreferences[K]) => void;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<SystemPreferences>(() => readSystemPreferences());

  const setPreference = useCallback(<K extends keyof SystemPreferences>(key: K, value: SystemPreferences[K]) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: value };
      persistSystemPreferences(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
};

export function useSystemSettings(): SystemSettingsContextType {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
}
