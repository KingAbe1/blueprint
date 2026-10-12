import { AIProviderId, AISettings, AIProviderConfig, DEFAULT_AI_PROVIDERS } from '../types/ai';

const LOCAL_STORAGE_KEY = 'blueprint_ai_settings';

export function mergeAISettings(parsed: Partial<AISettings> | null | undefined): AISettings {
  const providers = {} as Record<AIProviderId, AIProviderConfig>;
  for (const id of Object.keys(DEFAULT_AI_PROVIDERS) as AIProviderId[]) {
    providers[id] = {
      ...DEFAULT_AI_PROVIDERS[id],
      ...(parsed?.providers?.[id] || {}),
    };
  }
  return {
    activeProvider: parsed?.activeProvider && providers[parsed.activeProvider]
      ? parsed.activeProvider
      : 'anthropic',
    providers,
  };
}

export function providerIsConfigured(config: AIProviderConfig): boolean {
  return config.provider === 'ollama'
    ? Boolean(config.baseUrl?.trim())
    : Boolean(config.apiKey?.trim());
}

/** Prefer the selected provider when configured; otherwise the first provider with credentials. */
export function resolveActiveProvider(settings: AISettings): AIProviderId {
  const active = settings.providers[settings.activeProvider];
  if (active && providerIsConfigured(active)) return settings.activeProvider;
  for (const id of Object.keys(settings.providers) as AIProviderId[]) {
    if (providerIsConfigured(settings.providers[id])) return id;
  }
  return settings.activeProvider;
}

export function normalizeAISettings(raw: Partial<AISettings> | null | undefined): AISettings {
  const merged = mergeAISettings(raw);
  const activeProvider = resolveActiveProvider(merged);
  return { ...merged, activeProvider };
}

export function readAISettingsFromLocalStorage(): AISettings | null {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return null;
    return normalizeAISettings(JSON.parse(saved) as Partial<AISettings>);
  } catch {
    return null;
  }
}

export async function loadAISettings(): Promise<{ settings: AISettings }> {
  const local = readAISettingsFromLocalStorage();
  if (local) {
    return { settings: local };
  }
  return { settings: normalizeAISettings(null) };
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  const normalized = normalizeAISettings(settings);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.error('Failed to save AI settings to localStorage', error);
  }
}
