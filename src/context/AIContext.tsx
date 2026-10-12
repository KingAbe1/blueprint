import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AIProviderId, AIProviderConfig, AISettings, DEFAULT_AI_PROVIDERS } from '../types/ai';
import {
  loadAISettings,
  mergeAISettings,
  normalizeAISettings,
  providerIsConfigured,
  readAISettingsFromLocalStorage,
  saveAISettings,
} from '../services/aiSettingsStorage';

interface AIContextType {
  settings: AISettings;
  activeConfig: AIProviderConfig;
  isAiConfigured: boolean;
  isSettingsLoaded: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setActiveProvider: (providerId: AIProviderId) => void;
  updateProviderConfig: (providerId: AIProviderId, updates: Partial<AIProviderConfig>) => void;
}

const defaultSettings = normalizeAISettings(null);

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AISettings>(() => {
    return readAISettingsFromLocalStorage() || defaultSettings;
  });
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastSavedJsonRef = useRef('');

  useEffect(() => {
    let active = true;
    loadAISettings().then(({ settings: loaded }) => {
      if (!active) return;
      setSettings(loaded);
      lastSavedJsonRef.current = JSON.stringify(loaded);
      setIsSettingsLoaded(true);
    }).catch(() => {
      if (active) setIsSettingsLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isSettingsLoaded) return;
    const json = JSON.stringify(settings);
    if (json === lastSavedJsonRef.current) return;
    lastSavedJsonRef.current = json;
    void saveAISettings(settings);
  }, [settings, isSettingsLoaded]);

  const activeConfig = settings.providers[settings.activeProvider] || DEFAULT_AI_PROVIDERS.anthropic;

  const isAiConfigured = Object.values(settings.providers).some(providerIsConfigured);

  const setActiveProvider = (providerId: AIProviderId) => {
    setSettings(prev => normalizeAISettings({
      ...prev,
      activeProvider: providerId,
    }));
  };

  const updateProviderConfig = (providerId: AIProviderId, updates: Partial<AIProviderConfig>) => {
    setSettings(prev => {
      const merged = mergeAISettings(prev);
      const next: AISettings = {
        ...merged,
        providers: {
          ...merged.providers,
          [providerId]: {
            ...merged.providers[providerId],
            ...updates,
          },
        },
      };
      const updated = normalizeAISettings(next);
      if (updates.apiKey?.trim() || (providerId === 'ollama' && updates.baseUrl?.trim())) {
        updated.activeProvider = providerId;
      }
      return updated;
    });
  };

  return (
    <AIContext.Provider
      value={{
        settings,
        activeConfig,
        isAiConfigured,
        isSettingsLoaded,
        isSettingsOpen,
        setIsSettingsOpen,
        setActiveProvider,
        updateProviderConfig,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
