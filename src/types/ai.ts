export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'together'
  | 'ollama'
  | 'openrouter'
  | 'custom';

export interface AIProviderConfig {
  provider: AIProviderId;
  name: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  /** Populated only after “Find available models” (or a successful live fetch). */
  availableModels: string[];
  /** Set when a live connection test / model fetch succeeds (needed for local Ollama “Ready”). */
  connectionVerifiedAt?: string;
}

export interface AISettings {
  activeProvider: AIProviderId;
  providers: Record<AIProviderId, AIProviderConfig>;
}

/** Providers that speak the OpenAI chat-completions API shape. */
export const OPENAI_COMPATIBLE_PROVIDER_IDS: readonly AIProviderId[] = [
  'openai',
  'groq',
  'deepseek',
  'mistral',
  'xai',
  'together',
  'openrouter',
  'custom',
] as const;

export function isOpenAICompatibleProvider(provider: AIProviderId): boolean {
  return (OPENAI_COMPATIBLE_PROVIDER_IDS as readonly string[]).includes(provider);
}

export const DEFAULT_AI_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    availableModels: [],
  },
  openai: {
    provider: 'openai',
    name: 'OpenAI',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    availableModels: [],
  },
  gemini: {
    provider: 'gemini',
    name: 'Google Gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
    availableModels: [],
  },
  groq: {
    provider: 'groq',
    name: 'Groq',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    availableModels: [],
  },
  deepseek: {
    provider: 'deepseek',
    name: 'DeepSeek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    availableModels: [],
  },
  mistral: {
    provider: 'mistral',
    name: 'Mistral AI',
    apiKey: '',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-large-latest',
    availableModels: [],
  },
  xai: {
    provider: 'xai',
    name: 'xAI Grok',
    apiKey: '',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-2-latest',
    availableModels: [],
  },
  together: {
    provider: 'together',
    name: 'Together AI',
    apiKey: '',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    availableModels: [],
  },
  openrouter: {
    provider: 'openrouter',
    name: 'OpenRouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.7-sonnet',
    availableModels: [],
  },
  ollama: {
    provider: 'ollama',
    name: 'Ollama (Local)',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    availableModels: [],
  },
  custom: {
    provider: 'custom',
    name: 'Custom OpenAI-Compatible',
    apiKey: '',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    availableModels: [],
  },
};
