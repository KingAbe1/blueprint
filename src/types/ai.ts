export type AIProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter' | 'custom';

export interface AIProviderConfig {
  provider: AIProviderId;
  name: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  availableModels: string[];
}

export interface AISettings {
  activeProvider: AIProviderId;
  providers: Record<AIProviderId, AIProviderConfig>;
}

export const DEFAULT_AI_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: '',
    model: 'claude-3-7-sonnet-20250219',
    availableModels: [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ]
  },
  openai: {
    provider: 'openai',
    name: 'OpenAI',
    apiKey: '',
    model: 'gpt-4o',
    availableModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'o1',
      'gpt-4-turbo'
    ]
  },
  gemini: {
    provider: 'gemini',
    name: 'Google Gemini',
    apiKey: '',
    model: 'gemini-2.0-flash',
    availableModels: [
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
  },
  ollama: {
    provider: 'ollama',
    name: 'Ollama (Local)',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    availableModels: [
      'llama3.2',
      'deepseek-r1:latest',
      'qwen2.5-coder:latest',
      'mistral:latest',
      'codellama:latest'
    ]
  },
  openrouter: {
    provider: 'openrouter',
    name: 'OpenRouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.7-sonnet',
    availableModels: [
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-4o',
      'deepseek/deepseek-r1',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct'
    ]
  },
  custom: {
    provider: 'custom',
    name: 'Custom OpenAI-Compatible',
    apiKey: '',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    availableModels: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-Coder-32B-Instruct'
    ]
  }
};
