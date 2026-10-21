import { AIProviderId, AISettings, AIProviderConfig, DEFAULT_AI_PROVIDERS } from '../types/ai';

const LOCAL_STORAGE_KEY = 'blueprint_ai_settings';

export function mergeAISettings(parsed: Partial<AISettings> | null | undefined): AISettings {
  const providers = {} as Record<AIProviderId, AIProviderConfig>;
  for (const id of Object.keys(DEFAULT_AI_PROVIDERS) as AIProviderId[]) {
    const saved = parsed?.providers?.[id];
    providers[id] = {
      ...DEFAULT_AI_PROVIDERS[id],
      ...saved,
      // Keep model lists only after a live fetch (connectionVerifiedAt). Drop old seeded catalogs.
      availableModels:
        saved?.connectionVerifiedAt && Array.isArray(saved.availableModels) ? saved.availableModels : [],
    };
  }
  const activeProvider =
    parsed?.activeProvider && providers[parsed.activeProvider] ? parsed.activeProvider : 'anthropic';
  return {
    activeProvider,
    providers,
  };
}

export function providerIsConfigured(config: AIProviderConfig): boolean {
  if (config.provider === 'ollama') {
    // Default localhost URL is always present — that does not mean Ollama is running.
    // Require a successful Test connection / Fetch models before treating it as Ready.
    return Boolean(config.baseUrl?.trim() && config.connectionVerifiedAt);
  }
  return Boolean(config.apiKey?.trim());
}

/**
 * Provider marked "In use" — never silently switches to another backend.
 * Callers must check `providerIsConfigured` (or use `requireActiveProviderConfig`).
 */
export function resolveActiveProvider(settings: AISettings): AIProviderId {
  return settings.activeProvider && settings.providers[settings.activeProvider]
    ? settings.activeProvider
    : 'anthropic';
}

/** Active provider config for requests; throws if the In-use provider is not configured. */
export function requireActiveProviderConfig(settings: AISettings): AIProviderConfig {
  const providerId = resolveActiveProvider(settings);
  const activeConfig = settings.providers[providerId];
  if (!activeConfig || !providerIsConfigured(activeConfig)) {
    throw new Error(
      `API key is required for ${activeConfig?.name || 'the selected AI provider'}. Open AI settings and configure the provider marked In use, or choose another provider.`,
    );
  }
  return activeConfig;
}

/** Merge defaults only — does not rewrite the user's activeProvider choice. */
export function normalizeAISettings(raw: Partial<AISettings> | null | undefined): AISettings {
  return mergeAISettings(raw);
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
