import React, { useEffect, useState } from 'react';
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
    id: 'custom',
    name: 'Custom endpoint',
    shortName: 'Custom',
    description: 'Any OpenAI-compatible endpoint.',
    placeholder: 'sk-…',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    icon: PlugZap,
  },
];

export const AISettingsModal: React.FC = () => {
  const {
    settings,
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
  }, [isSettingsOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSettingsOpen) setIsSettingsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  const config = settings.providers[selectedProvider];
  const provider = PROVIDERS.find(item => item.id === selectedProvider) || PROVIDERS[0];
  const isActive = settings.activeProvider === selectedProvider;
  const isLocal = selectedProvider === 'ollama';
  const isConfigured = isLocal ? Boolean(config.baseUrl?.trim()) : Boolean(config.apiKey?.trim());

  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const muted = isDark ? 'text-[#8F9199]' : 'text-slate-500';
  const input = isDark
    ? 'border-white/[0.09] bg-[#0E0F11] text-white placeholder:text-[#55575E] focus:border-blue-500/70'
    : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white';
  const secondaryButton = isDark
    ? 'border-white/[0.09] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900';

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
        return;
      }

      updateProviderConfig(selectedProvider, {
        availableModels: models,
        model: models.includes(config.model) ? config.model : models[0],
      });
      setFetchResult({ type: 'success', text: `${models.length} models found.` });
    } catch (error: any) {
      setFetchResult({ type: 'error', text: error?.message || 'Could not load models.' });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAIConnection(config));
    } catch (error: any) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setIsSettingsOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        className={`flex max-h-[calc(100vh-32px)] min-h-[620px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? 'border-white/[0.1] bg-[#121315] text-white shadow-black/70' : 'border-slate-200 bg-white text-slate-900 shadow-slate-900/15'
        }`}
      >
        <header className={`flex h-[72px] shrink-0 items-center justify-between border-b px-6 ${border}`}>
          <div>
            <h2 id="ai-settings-title" className="text-base font-semibold tracking-tight">AI connections</h2>
            <p className={`mt-1 text-xs ${muted}`}>Choose the provider Blueprint uses for analysis and generation.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className={`rounded-lg p-2 transition-colors ${isDark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className={`shrink-0 border-b px-6 py-3 text-xs leading-5 ${border} ${isDark ? 'bg-emerald-500/[0.06] text-slate-300' : 'bg-emerald-50/90 text-slate-600'}`}>
          <p>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">No Blueprint cloud for your code.</span>
            {' '}
            One connection for every project in Blueprint Studio. Scans and project data stay on this device. If you use AI features, only the text you send goes to the provider you configure here—or to Ollama on your machine. API keys are stored locally on this device.
          </p>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className={`w-56 shrink-0 overflow-y-auto border-r p-3 ${border} ${isDark ? 'bg-[#0E0F11]' : 'bg-slate-50/70'}`}>
            <div className={`mb-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${muted}`}>Providers</div>
            <div className="space-y-1">
              {PROVIDERS.map(item => {
                const ItemIcon = item.icon;
                const itemConfig = settings.providers[item.id];
                const itemConfigured = item.id === 'ollama' ? Boolean(itemConfig.baseUrl?.trim()) : Boolean(itemConfig.apiKey?.trim());
                const itemActive = settings.activeProvider === item.id;
                const selected = selectedProvider === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProvider(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                      selected
                        ? isDark ? 'bg-white/[0.07] text-white' : 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                        : isDark ? 'text-[#92949C] hover:bg-white/[0.04] hover:text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <ItemIcon className={`h-4 w-4 shrink-0 ${selected ? 'text-blue-500' : ''}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.shortName}</div>
                      <div className={`mt-0.5 text-[10px] ${itemActive ? 'text-emerald-500' : muted}`}>
                        {itemActive ? 'Active' : itemConfigured ? 'Configured' : item.id === 'ollama' ? 'Local' : 'Not connected'}
                      </div>
                    </div>
                    {itemActive ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    ) : itemConfigured ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className={`flex items-start justify-between gap-4 border-b px-6 py-5 ${border}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{provider.name}</h3>
                  {isActive && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                    }`}>Active</span>
                  )}
                </div>
                <p className={`mt-1 text-xs ${muted}`}>{provider.description}</p>
              </div>
              {!isActive && (
                <button
                  type="button"
                  onClick={() => setActiveProvider(selectedProvider)}
                  className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  Use this provider
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-xl space-y-5">
                {!isLocal && (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <label htmlFor="provider-api-key" className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        <KeyRound className="h-3.5 w-3.5 text-blue-500" />
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
                        className={`w-full rounded-lg border px-3 py-3 pr-10 font-mono text-xs outline-none transition-colors ${input}`}
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
                    <p className={`mt-2 text-[11px] leading-5 ${muted}`}>Stored in Blueprint on this device and used only for requests to this provider.</p>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label htmlFor="provider-model" className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      <Cpu className="h-3.5 w-3.5 text-blue-500" />
                      Model
                    </label>
                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={isFetchingModels || !isConfigured}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {isFetchingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      {isFetchingModels ? 'Loading…' : 'Find available models'}
                    </button>
                  </div>
                  <input
                    id="provider-model"
                    type="text"
                    list="provider-model-options"
                    value={config.model || ''}
                    onChange={event => updateProviderConfig(selectedProvider, { model: event.target.value })}
                    placeholder="Enter a model ID"
                    spellCheck={false}
                    className={`w-full rounded-lg border px-3 py-3 font-mono text-xs outline-none transition-colors ${input}`}
                  />
                  <datalist id="provider-model-options">
                    {(config.availableModels || []).map(model => <option key={model} value={model} />)}
                  </datalist>
                  <div className={`mt-2 flex min-h-5 items-center text-[11px] ${muted}`}>
                    {fetchResult ? (
                      <span className={`flex items-center gap-1.5 ${fetchResult.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {fetchResult.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        {fetchResult.text}
                      </span>
                    ) : (
                      <span>{(config.availableModels || []).length} saved model options</span>
                    )}
                  </div>
                </div>

                <div className={`overflow-hidden rounded-xl border ${border}`}>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(value => !value)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium transition-colors ${
                      isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>Advanced settings</span>
                    {showAdvanced ? <ChevronUp className={`h-3.5 w-3.5 ${muted}`} /> : <ChevronDown className={`h-3.5 w-3.5 ${muted}`} />}
                  </button>
                  {showAdvanced && (
                    <div className={`border-t px-4 py-4 ${border} ${isDark ? 'bg-black/10' : 'bg-slate-50/60'}`}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <label htmlFor="provider-base-url" className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <Server className="h-3.5 w-3.5 text-blue-500" />
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
                        onChange={event => updateProviderConfig(selectedProvider, { baseUrl: event.target.value })}
                        placeholder={provider.defaultBaseUrl}
                        spellCheck={false}
                        className={`w-full rounded-lg border px-3 py-3 font-mono text-xs outline-none transition-colors ${input}`}
                      />
                      <p className={`mt-2 text-[11px] leading-5 ${muted}`}>Change this only when using a proxy, local server, or compatible custom endpoint.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className={`flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-3 border-t px-6 py-3 ${border}`}>
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !isConfigured}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${secondaryButton}`}
                >
                  {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                  {isTesting ? 'Testing…' : 'Test connection'}
                </button>
                {testResult && (
                  <span className={`flex min-w-0 items-center gap-1.5 truncate text-xs ${testResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{testResult.success ? `Connected in ${testResult.latencyMs}ms` : testResult.message}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`hidden items-center gap-1.5 text-[11px] sm:flex ${muted}`}>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Keys stored on this device
                </span>
                <button
                  type="button"
                  onClick={handleDone}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  {isConfigured && !isActive ? `Use ${provider.shortName}` : 'Done'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
};
