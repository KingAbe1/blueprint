import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AIProviderId, AIProviderConfig, AISettings, DEFAULT_AI_PROVIDERS } from '../types/ai';
import {
  loadAISettings,
  mergeAISettings,
  normalizeAISettings,
  providerIsConfigured,
  readAISettingsFromLocalStorage,
  resolveActiveProvider,
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

  const activeProviderId = resolveActiveProvider(settings);
  const activeConfig = settings.providers[activeProviderId] || DEFAULT_AI_PROVIDERS.anthropic;

  // "Connected" means the In-use provider can serve requests — not merely that some other key exists.
  const isAiConfigured = providerIsConfigured(activeConfig);

  const setActiveProvider = (providerId: AIProviderId) => {
    setSettings(prev => {
      const merged = mergeAISettings(prev);
      // Only mark In use when the provider can actually serve requests.
      if (!providerIsConfigured(merged.providers[providerId])) {
        return merged;
      }
      return {
        ...merged,
        activeProvider: providerId,
      };
    });
  };

  const updateProviderConfig = (providerId: AIProviderId, updates: Partial<AIProviderConfig>) => {
    setSettings(prev => {
      const merged = mergeAISettings(prev);
      // Editing keys/models must not silently change which provider is In use.
      return normalizeAISettings({
        ...merged,
        activeProvider: merged.activeProvider,
        providers: {
          ...merged.providers,
          [providerId]: {
            ...merged.providers[providerId],
            ...updates,
          },
        },
      });
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
