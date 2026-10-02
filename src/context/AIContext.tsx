import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AIProviderId, AIProviderConfig, AISettings, DEFAULT_AI_PROVIDERS } from '../types/ai';

interface AIContextType {
  settings: AISettings;
  activeConfig: AIProviderConfig;
  isAiConfigured: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setActiveProvider: (providerId: AIProviderId) => void;
  updateProviderConfig: (providerId: AIProviderId, updates: Partial<AIProviderConfig>) => void;
}

const AI_STORAGE_KEY = 'blueprint_ai_settings';

const defaultSettings: AISettings = {
  activeProvider: 'anthropic',
  providers: DEFAULT_AI_PROVIDERS
};

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const saved = localStorage.getItem(AI_STORAGE_KEY);
      if (saved) {
        const parsed: Partial<AISettings> = JSON.parse(saved);
        return {
          activeProvider: parsed.activeProvider || 'anthropic',
          providers: {
            ...DEFAULT_AI_PROVIDERS,
            ...(parsed.providers || {})
          }
        };
      }
    } catch (e) {
      console.error('Failed to load AI settings from localStorage', e);
    }
    return defaultSettings;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save AI settings to localStorage', e);
    }
  }, [settings]);

  const activeConfig = settings.providers[settings.activeProvider] || DEFAULT_AI_PROVIDERS.anthropic;
  
  const isAiConfigured = activeConfig.provider === 'ollama' 
    ? Boolean(activeConfig.baseUrl) 
    : Boolean(activeConfig.apiKey && activeConfig.apiKey.trim().length > 0);

  const setActiveProvider = (providerId: AIProviderId) => {
    setSettings(prev => ({
      ...prev,
      activeProvider: providerId
    }));
  };

  const updateProviderConfig = (providerId: AIProviderId, updates: Partial<AIProviderConfig>) => {
    setSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          ...updates
        }
      }
    }));
  };

  return (
    <AIContext.Provider
      value={{
        settings,
        activeConfig,
        isAiConfigured,
        isSettingsOpen,
        setIsSettingsOpen,
        setActiveProvider,
        updateProviderConfig
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
