import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Layers3,
  Loader2,
  PlugZap,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import { AIProviderId } from '../../types/ai';
import { fetchProviderModels, testAIConnection, TestResult } from '../../services/aiService';
import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';
import { Dropdown } from '../common/Dropdown';
import { providerIsConfigured } from '../../services/aiSettingsStorage';

interface ProviderMeta {
  id: AIProviderId;
  name: string;
  shortName: string;
  description: string;
  placeholder: string;
  defaultBaseUrl: string;
  link?: { label: string; url: string };
  icon: React.FC<{ className?: string }>;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    shortName: 'Anthropic',
    description: 'Claude models for thoughtful architecture work.',
    placeholder: 'sk-ant-api03-…',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    link: { label: 'Create an Anthropic key', url: 'https://console.anthropic.com/settings/keys' },
    icon: Globe2,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    description: 'GPT and reasoning models.',
    placeholder: 'sk-proj-…',
    defaultBaseUrl: 'https://api.openai.com/v1',
    link: { label: 'Create an OpenAI key', url: 'https://platform.openai.com/api-keys' },
    icon: Cpu,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Google Gemini',
    description: 'Gemini models from Google AI Studio.',
    placeholder: 'AIzaSy…',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    link: { label: 'Create a Google AI key', url: 'https://aistudio.google.com/app/apikey' },
    icon: Layers3,
  },
  {
    id: 'groq',
    name: 'Groq',
    shortName: 'Groq',
    description: 'Very fast Llama and Mixtral inference.',
    placeholder: 'gsk_…',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    link: { label: 'Create a Groq key', url: 'https://console.groq.com/keys' },
    icon: Cpu,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    description: 'DeepSeek chat and reasoner models.',
    placeholder: 'sk-…',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    link: { label: 'Create a DeepSeek key', url: 'https://platform.deepseek.com/api_keys' },
    icon: Layers3,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    shortName: 'Mistral',
    description: 'Mistral Large, Small, and Codestral.',
    placeholder: '…',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    link: { label: 'Create a Mistral key', url: 'https://console.mistral.ai/api-keys' },
    icon: Globe2,
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    shortName: 'xAI',
    description: 'Grok models from xAI.',
    placeholder: 'xai-…',
    defaultBaseUrl: 'https://api.x.ai/v1',
    link: { label: 'Create an xAI key', url: 'https://console.x.ai' },
    icon: Cpu,
  },
  {
    id: 'together',
    name: 'Together AI',
    shortName: 'Together',
    description: 'Open models hosted on Together.',
    placeholder: '…',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    link: { label: 'Create a Together key', url: 'https://api.together.xyz/settings/api-keys' },
    icon: Layers3,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    description: 'One key for models from many providers.',
    placeholder: 'sk-or-v1-…',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    link: { label: 'Create an OpenRouter key', url: 'https://openrouter.ai/keys' },
    icon: Globe2,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    shortName: 'Ollama',
    description: 'Run local models without an API key.',
    placeholder: 'http://localhost:11434',
    defaultBaseUrl: 'http://localhost:11434',
    link: { label: 'Install Ollama', url: 'https://ollama.com' },
    icon: Server,
  },
  {
    id: 'custom',
    name: 'Custom endpoint',
    shortName: 'Custom',
    description: 'LM Studio, vLLM, Azure OpenAI-compatible, or any /v1 chat API.',
    placeholder: 'sk-… (optional for some local servers)',
    defaultBaseUrl: 'http://localhost:1234/v1',
    icon: PlugZap,
  },
];

export const AISettingsModal: React.FC = () => {
  const {
    settings,
    isAiConfigured,
    isSettingsOpen,
    setIsSettingsOpen,
    setActiveProvider,
    updateProviderConfig,
  } = useAI();
  const { isDark } = useTheme();

  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(settings.activeProvider || 'anthropic');
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      setSelectedProvider(settings.activeProvider);
      setShowKey(false);
      setShowAdvanced(false);
      setFetchResult(null);
      setTestResult(null);
    }
  }, [isSettingsOpen, settings.activeProvider]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSettingsOpen) setIsSettingsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSettingsOpen, setIsSettingsOpen]);

  const config = settings.providers[selectedProvider] || settings.providers.anthropic;
  const fetchedModels = config.availableModels || [];
  const modelOptions = useMemo(
    () => fetchedModels.map(model => ({ value: model, label: model })),
    [fetchedModels],
  );

  if (!isSettingsOpen) return null;

  const provider = PROVIDERS.find(item => item.id === selectedProvider) || PROVIDERS[0];
  const isActive = settings.activeProvider === selectedProvider;
  const isLocal = selectedProvider === 'ollama';
  const isConfigured = providerIsConfigured(config);

  const border = overviewBorderClass(isDark);
  const panel = overviewPanelClass(isDark);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const input = isDark
    ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400';
  const secondaryButton = isDark
    ? 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-white/[0.12] hover:bg-white/[0.06]'
    : 'border-slate-200/90 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50';
  const primaryButton = isDark
    ? 'border border-blue-500/35 bg-blue-500/[0.12] text-blue-100 hover:border-blue-500/45 hover:bg-blue-500/20'
    : 'border border-blue-600/15 bg-blue-600 text-white hover:bg-blue-700 shadow-[0_1px_2px_rgba(37,99,235,0.2)]';

  const isProviderConfigured = (providerId: AIProviderId) => providerIsConfigured(settings.providers[providerId]);

  const selectProvider = (providerId: AIProviderId) => {
    setSelectedProvider(providerId);
    setShowKey(false);
    setShowAdvanced(false);
    setFetchResult(null);
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchResult(null);
    try {
      const models = await fetchProviderModels(config);
      if (!models.length) {
        setFetchResult({ type: 'error', text: 'No models were returned by this endpoint.' });
        if (isLocal) {
          updateProviderConfig(selectedProvider, { connectionVerifiedAt: undefined });
        }
        return;
      }

      updateProviderConfig(selectedProvider, {
        availableModels: models,
        model: models.includes(config.model) ? config.model : models[0],
        connectionVerifiedAt: new Date().toISOString(),
      });
      setFetchResult({ type: 'success', text: `${models.length} models found.` });
    } catch (error: any) {
      if (isLocal) {
        updateProviderConfig(selectedProvider, { connectionVerifiedAt: undefined });
      }
      setFetchResult({ type: 'error', text: error?.message || 'Could not load models.' });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testAIConnection(config);
      setTestResult(result);
      if (isLocal) {
        updateProviderConfig(selectedProvider, {
          connectionVerifiedAt: result.success ? new Date().toISOString() : undefined,
        });
      }
    } catch (error: any) {
      if (isLocal) {
        updateProviderConfig(selectedProvider, { connectionVerifiedAt: undefined });
      }
      setTestResult({ success: false, message: error?.message || 'Could not connect to the provider.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDone = () => {
    if (isConfigured && !isActive) {
      setActiveProvider(selectedProvider);
    }
    setIsSettingsOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setIsSettingsOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        className={`flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel}`}
      >
        <header className={`shrink-0 border-b px-5 py-4 sm:px-6 ${border}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="ai-settings-title" className={`text-[15px] font-medium ${titleText}`}>
                  AI connection
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isAiConfigured
                      ? isDark
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-emerald-50 text-emerald-800'
                      : isDark
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isAiConfigured ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    aria-hidden
                  />
                  {isAiConfigured ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <p className={`mt-1 max-w-xl text-[13px] leading-relaxed ${muted}`}>
                Pick a provider and model for AI review and generation. Keys stay on this device; only prompts you send leave
                for the provider you choose.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className={`shrink-0 rounded-lg p-2 transition-colors ${isDark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside
            className={`flex min-h-0 shrink-0 flex-col border-b sm:w-52 sm:self-stretch sm:border-b-0 sm:border-r ${border} ${
              isDark ? 'bg-black/15' : 'bg-slate-50/80'
            }`}
          >
            <p className={`shrink-0 px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide ${muted}`}>Providers</p>
            <div className="flex gap-1 overflow-x-auto px-3 pb-6 sm:min-h-0 sm:flex-1 sm:block sm:space-y-0.5 sm:overflow-y-auto sm:overscroll-contain sm:px-2 sm:pb-10">
              {PROVIDERS.map(item => {
                const ItemIcon = item.icon;
                const itemConfigured = isProviderConfigured(item.id);
                const itemActive = settings.activeProvider === item.id;
                const selected = selectedProvider === item.id;
                const statusDot = !itemConfigured
                  ? 'bg-rose-500'
                  : itemActive
                    ? 'bg-emerald-500'
                    : isDark
                      ? 'bg-emerald-500/50'
                      : 'bg-emerald-400';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProvider(item.id)}
                    className={`flex min-w-[9.5rem] shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors sm:min-w-0 sm:w-full ${
                      selected
                        ? isDark
                          ? 'bg-white/[0.06] text-slate-100 ring-1 ring-inset ring-white/[0.08]'
                          : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90'
                        : isDark
                          ? 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                          : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                    }`}
                  >
                    <ItemIcon className={`h-4 w-4 shrink-0 ${selected ? (isDark ? 'text-blue-400' : 'text-blue-600') : ''}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.shortName}</div>
                      <div className={`mt-0.5 text-[10px] ${muted}`}>
                        {itemActive
                          ? itemConfigured
                            ? 'In use'
                            : 'In use · not connected'
                          : itemConfigured
                            ? 'Ready'
                            : item.id === 'ollama'
                              ? 'Not connected'
                              : 'Setup needed'}
                      </div>
                    </div>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} aria-hidden />
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className={`text-[13px] font-medium ${titleText}`}>{provider.name}</h3>
                  <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{provider.description}</p>
                </div>
                {!isActive && isConfigured ? (
                  <button
                    type="button"
                    onClick={() => setActiveProvider(selectedProvider)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${secondaryButton}`}
                  >
                    Use {provider.shortName}
                  </button>
                ) : isActive ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    In use
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mx-auto max-w-lg space-y-5">
                {!isLocal && (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <label htmlFor="provider-api-key" className={`flex items-center gap-2 text-xs font-medium ${titleText}`}>
                        <KeyRound className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                        API key
                      </label>
                      {provider.link && (
                        <a
                          href={provider.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400"
                        >
                          {provider.link.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="provider-api-key"
                        type={showKey ? 'text' : 'password'}
                        value={config.apiKey || ''}
                        onChange={event => updateProviderConfig(selectedProvider, { apiKey: event.target.value })}
                        placeholder={provider.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        className={`w-full rounded-lg border px-3 py-2.5 pr-10 font-mono text-xs outline-none transition-colors ${input}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(value => !value)}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                        title={showKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className={`mt-2 text-[11px] leading-relaxed ${muted}`}>Saved locally on this device only.</p>
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span className={`flex items-center gap-2 text-xs font-medium ${titleText}`}>
                      <Cpu className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      Model
                    </span>
                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={isFetchingModels || (!isLocal && !isConfigured)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${secondaryButton}`}
                    >
                      {isFetchingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      {isFetchingModels ? 'Loading…' : 'Find available models'}
                    </button>
                  </div>

                  {modelOptions.length > 0 ? (
                    <div className="space-y-3">
                      <div>
                        <label className={`mb-1.5 block text-[11px] font-medium ${muted}`}>
                          Choose from provider list
                        </label>
                        <Dropdown
                          options={modelOptions}
                          value={config.model || undefined}
                          onChange={model => updateProviderConfig(selectedProvider, { model })}
                          placeholder="Select a model"
                          searchable
                          searchPlaceholder="Search models…"
                          size="sm"
                          fullWidth
                          triggerClassName="font-mono"
                        />
                        <p className={`mt-1.5 text-[10px] leading-relaxed ${muted}`}>
                          {modelOptions.length} model{modelOptions.length === 1 ? '' : 's'} loaded from {provider.shortName}.
                        </p>
                      </div>
                      <div>
                        <label
                          htmlFor="provider-model-custom"
                          className={`mb-1.5 block text-[11px] font-medium ${muted}`}
                        >
                          Or enter a model name
                        </label>
                        <input
                          id="provider-model-custom"
                          type="text"
                          value={config.model || ''}
                          onChange={event => updateProviderConfig(selectedProvider, { model: event.target.value })}
                          placeholder="e.g. gpt-4o, llama-3.3-70b-versatile"
                          spellCheck={false}
                          className={`w-full rounded-lg border px-3 py-2 font-mono text-[11px] outline-none transition-colors ${input}`}
                        />
                        <p className={`mt-1.5 text-[10px] leading-relaxed ${muted}`}>
                          Use this if the model isn’t in the list above. Matches the dropdown when you pick one.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="provider-model" className={`mb-1.5 block text-[11px] font-medium ${muted}`}>
                        Model name
                      </label>
                      <input
                        id="provider-model"
                        type="text"
                        value={config.model || ''}
                        onChange={event => updateProviderConfig(selectedProvider, { model: event.target.value })}
                        placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                        spellCheck={false}
                        className={`w-full rounded-lg border px-3 py-2.5 font-mono text-xs outline-none transition-colors ${input}`}
                      />
                      <p className={`mt-1.5 text-[10px] leading-relaxed ${muted}`}>
                        Type a model name, or use <span className={titleText}>Find available models</span> to load a selectable list.
                      </p>
                    </div>
                  )}

                  {fetchResult && (
                    <div className={`mt-2 min-h-5 text-[11px]`}>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 ${
                          fetchResult.type === 'success'
                            ? isDark
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-emerald-50 text-emerald-800'
                            : isDark
                              ? 'bg-rose-500/10 text-rose-300'
                              : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {fetchResult.type === 'success' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {fetchResult.text}
                      </span>
                    </div>
                  )}
                </div>

                <div className={`overflow-hidden rounded-xl border ${border}`}>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(value => !value)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium transition-colors ${titleText} ${
                      isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>Endpoint (advanced)</span>
                    {showAdvanced ? <ChevronUp className={`h-3.5 w-3.5 ${muted}`} /> : <ChevronDown className={`h-3.5 w-3.5 ${muted}`} />}
                  </button>
                  {showAdvanced && (
                    <div className={`border-t px-4 py-4 ${border} ${isDark ? 'bg-black/10' : 'bg-slate-50/60'}`}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <label htmlFor="provider-base-url" className={`flex items-center gap-2 text-xs font-medium ${titleText}`}>
                          <Server className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                          Base URL
                        </label>
                        {isLocal && provider.link && (
                          <a href={provider.link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-medium text-blue-500">
                            {provider.link.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <input
                        id="provider-base-url"
                        type="text"
                        value={config.baseUrl || ''}
                        onChange={event =>
                          updateProviderConfig(selectedProvider, {
                            baseUrl: event.target.value,
                            ...(isLocal ? { connectionVerifiedAt: undefined } : {}),
                          })
                        }
                        placeholder={provider.defaultBaseUrl}
                        spellCheck={false}
                        className={`w-full rounded-lg border px-3 py-2.5 font-mono text-xs outline-none transition-colors ${input}`}
                      />
                      <p className={`mt-2 text-[11px] leading-relaxed ${muted}`}>For proxies, Ollama, or other OpenAI-compatible hosts.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className={`shrink-0 border-t px-5 py-4 sm:px-6 ${border} ${isDark ? 'bg-black/10' : 'bg-slate-50/50'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !isConfigured}
                    className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${secondaryButton}`}
                  >
                    {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                    {isTesting ? 'Testing…' : 'Test connection'}
                  </button>
                  {testResult ? (
                    <span
                      className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                        testResult.success
                          ? isDark
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : isDark
                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">
                        {testResult.success ? `OK · ${testResult.latencyMs}ms` : testResult.message}
                      </span>
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] ${muted}`}>
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      Local storage only
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDone}
                  className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors sm:w-auto ${primaryButton}`}
                >
                  {isConfigured && !isActive ? `Save & use ${provider.shortName}` : 'Done'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
};
