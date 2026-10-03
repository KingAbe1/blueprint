import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Key, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  CheckCircle2, 
  Cpu, 
  Globe, 
  Radio, 
  ShieldCheck, 
  Server, 
  Layers, 
  ArrowRight, 
  Plus,
  RefreshCw,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import { AIProviderId } from '../../types/ai';
import { fetchProviderModels, testAIConnection, TestResult } from '../../services/aiService';

interface ProviderMeta {
  id: AIProviderId;
  name: string;
  tagline: string;
  placeholder: string;
  keyPrefix?: string;
  defaultBaseUrl: string;
  link?: { label: string; url: string };
  icon: React.FC<{ className?: string }>;
}

const PROVIDERS_META: ProviderMeta[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    tagline: 'Claude 3.7 Sonnet, Claude 3.5 Sonnet & Haiku',
    placeholder: 'sk-ant-api03-...',
    keyPrefix: 'sk-ant-',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    link: { label: 'Get API Key from Anthropic Console', url: 'https://console.anthropic.com/settings/keys' },
    icon: Globe
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-4o, GPT-4o-mini, o3-mini & o1',
    placeholder: 'sk-proj-...',
    keyPrefix: 'sk-',
    defaultBaseUrl: 'https://api.openai.com/v1',
    link: { label: 'Get API Key from OpenAI Platform', url: 'https://platform.openai.com/api-keys' },
    icon: Cpu
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Gemini 2.0 Flash & Gemini 1.5 Pro',
    placeholder: 'AIzaSy...',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    link: { label: 'Get API Key from Google AI Studio', url: 'https://aistudio.google.com/app/apikey' },
    icon: Layers
  },
  {
    id: 'ollama',
    name: 'Ollama (Local / Offline)',
    tagline: 'Local LLMs via localhost:11434 (No API Key required)',
    placeholder: 'http://localhost:11434',
    defaultBaseUrl: 'http://localhost:11434',
    link: { label: 'Download Ollama & Models', url: 'https://ollama.com' },
    icon: Server
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Unified gateway to 100+ AI models',
    placeholder: 'sk-or-v1-...',
    keyPrefix: 'sk-or-',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    link: { label: 'Get API Key from OpenRouter', url: 'https://openrouter.ai/keys' },
    icon: Globe
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    tagline: 'Any OpenAI-compatible server (Groq, Together, vLLM)',
    placeholder: 'sk-...',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    icon: Cpu
  }
];

export const AISettingsModal: React.FC = () => {
  const { 
    settings, 
    activeConfig, 
    isSettingsOpen, 
    setIsSettingsOpen, 
    setActiveProvider, 
    updateProviderConfig 
  } = useAI();
  
  const { isDark } = useTheme();

  const [selectedTab, setSelectedTab] = useState<AIProviderId>(settings.activeProvider || 'anthropic');
  const [showKey, setShowKey] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Clear transient status when switching tabs
  const handleSelectTab = (provId: AIProviderId) => {
    setSelectedTab(provId);
    setFetchMessage(null);
    setTestResult(null);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  const currentProviderConfig = settings.providers[selectedTab];
  const meta = PROVIDERS_META.find(p => p.id === selectedTab) || PROVIDERS_META[0];
  const isActive = settings.activeProvider === selectedTab;
  const hasKey = selectedTab === 'ollama' ? Boolean(currentProviderConfig.baseUrl) : Boolean(currentProviderConfig.apiKey?.trim());

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchMessage(null);
    try {
      const models = await fetchProviderModels(currentProviderConfig);
      if (models.length > 0) {
        const hasCurrent = models.includes(currentProviderConfig.model);
        const nextModel = hasCurrent ? currentProviderConfig.model : models[0];
        updateProviderConfig(selectedTab, {
          availableModels: models,
          model: nextModel
        });
        setFetchMessage({ type: 'success', text: `Discovered ${models.length} live models from ${meta.name}!` });
      } else {
        setFetchMessage({ type: 'error', text: 'No models found for this endpoint.' });
      }
    } catch (err: any) {
      setFetchMessage({ type: 'error', text: err?.message || 'Failed to fetch models from server.' });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(currentProviderConfig);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Network error while testing connection.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddModel = (modelName: string) => {
    const trimmed = modelName.trim();
    if (!trimmed) return;
    const currentList = currentProviderConfig.availableModels || [];
    if (!currentList.includes(trimmed)) {
      updateProviderConfig(selectedTab, {
        model: trimmed,
        availableModels: [trimmed, ...currentList]
      });
    } else {
      updateProviderConfig(selectedTab, { model: trimmed });
    }
  };

  const handleRemoveModel = (modelToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = currentProviderConfig.availableModels || [];
    const updatedList = currentList.filter(m => m !== modelToRemove);
    const nextModel = currentProviderConfig.model === modelToRemove
      ? (updatedList[0] || '')
      : currentProviderConfig.model;
    
    updateProviderConfig(selectedTab, {
      model: nextModel,
      availableModels: updatedList
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div 
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all animate-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-[#111216] border-[#242630] text-white shadow-black/80' 
            : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-300/40'
        }`}
      >
        {/* Top Header */}
        <div className={`px-6 py-4.5 border-b flex items-center justify-between ${
          isDark ? 'border-[#22242D] bg-[#14161C]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
            }`}>
              <Cpu className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">AI Provider & API Keys</h2>
              <p className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                Connect your private API key to power code generation and domain analysis
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? 'border-transparent text-[#71727D] hover:text-white hover:bg-white/[0.06]' : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Selection Grid / Pills */}
        <div className={`p-4 ${isDark ? 'bg-[#0E0F13]' : 'bg-slate-50/30'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {PROVIDERS_META.map((prov) => {
              const isSelected = selectedTab === prov.id;
              const isCurrentActive = settings.activeProvider === prov.id;
              const provConfig = settings.providers[prov.id];
              const provHasKey = prov.id === 'ollama' ? Boolean(provConfig.baseUrl) : Boolean(provConfig.apiKey?.trim());
              const ProvIcon = prov.icon;

              return (
                <button
                  key={prov.id}
                  onClick={() => handleSelectTab(prov.id)}
                  className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? isDark
                        ? 'bg-blue-600/10 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/20'
                        : 'bg-blue-50/80 border-blue-600 text-blue-900 shadow-sm ring-1 ring-blue-500/20'
                      : isDark
                        ? 'bg-[#15161C] border-[#22242E] text-slate-400 hover:text-white hover:border-[#303340]'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <ProvIcon className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                    <div className="flex items-center space-x-1">
                      {isCurrentActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Currently Active Provider" />
                      )}
                      {provHasKey && !isCurrentActive && (
                        <span title="Key Configured">
                          <Check className="w-3 h-3 text-emerald-500" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold truncate">{prov.name.split(' ')[0]}</div>
                    <div className={`text-[10px] font-mono truncate ${isSelected ? (isDark ? 'text-blue-400' : 'text-blue-700') : (isDark ? 'text-[#71727D]' : 'text-slate-400')}`}>
                      {prov.id === 'ollama' ? 'Local' : provHasKey ? 'Ready' : 'Not set'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Provider Configuration View */}
        <div className="p-6 pb-16 space-y-5 overflow-y-auto max-h-[60vh]">
          
          {/* Active Banner & Quick Actions */}
          <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
            isActive
              ? isDark 
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
              : isDark 
                ? 'bg-[#15161C] border-[#23252E]' 
                : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isActive
                  ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  : isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {isActive ? <CheckCircle2 className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-bold flex items-center space-x-2">
                  <span>{meta.name}</span>
                  {isActive && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                      Active Provider
                    </span>
                  )}
                </div>
                <div className={`text-[11px] ${isActive ? (isDark ? 'text-emerald-400/80' : 'text-emerald-700') : (isDark ? 'text-[#8E8F99]' : 'text-slate-500')}`}>
                  {meta.tagline}
                </div>
              </div>
            </div>

            {!isActive && (
              <button
                type="button"
                onClick={() => setActiveProvider(selectedTab)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isDark 
                    ? 'bg-[#1C1E26] border-[#303342] text-white hover:bg-[#252834] hover:border-blue-500/50 shadow-xs' 
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-blue-400 shadow-xs'
                }`}
              >
                <span>Set as Active</span>
                <ArrowRight className="w-3 h-3 text-blue-500" />
              </button>
            )}
          </div>

          {/* Configuration Form Inputs */}
          <div className="space-y-4">
            
            {/* API Key Input (if not Ollama) */}
            {selectedTab !== 'ollama' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-semibold flex items-center space-x-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <Key className="w-3.5 h-3.5 text-blue-500" />
                    <span>{meta.name} API Key</span>
                  </label>

                  {meta.link && (
                    <a 
                      href={meta.link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] text-blue-500 hover:underline flex items-center space-x-1 font-medium cursor-pointer"
                    >
                      <span>{meta.link.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder={meta.placeholder}
                    value={currentProviderConfig.apiKey || ''}
                    onChange={(e) => updateProviderConfig(selectedTab, { apiKey: e.target.value })}
                    className={`w-full text-xs p-2.5 pr-10 rounded-xl outline-none font-mono tracking-wide transition-colors ${
                      isDark 
                        ? 'bg-[#15161C] border border-[#262833] text-white placeholder-[#5E606B] focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20' 
                        : 'bg-[#F8FAFC] border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(prev => !prev)}
                    className={`absolute right-3 p-1 rounded-md transition-colors cursor-pointer ${
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'
                    }`}
                    title={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Server Endpoint / Base URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-semibold flex items-center space-x-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Server className="w-3.5 h-3.5 text-blue-500" />
                  <span>Server Endpoint / Base URL</span>
                </label>

                {meta.link && selectedTab === 'ollama' && (
                  <a 
                    href={meta.link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[11px] text-blue-500 hover:underline flex items-center space-x-1 font-medium cursor-pointer"
                  >
                    <span>{meta.link.label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <input
                type="text"
                placeholder={meta.defaultBaseUrl || 'https://api.openai.com/v1'}
                value={currentProviderConfig.baseUrl || ''}
                onChange={(e) => updateProviderConfig(selectedTab, { baseUrl: e.target.value })}
                className={`w-full text-xs p-2.5 rounded-xl outline-none font-mono transition-colors ${
                  isDark 
                    ? 'bg-[#15161C] border border-[#262833] text-white placeholder-[#5E606B] focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20' 
                    : 'bg-[#F8FAFC] border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
                }`}
              />
            </div>

            {/* Preferred Model Input & Live Model Discovery */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-semibold flex items-center space-x-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span>Preferred Model ID</span>
                </label>

                {/* Dynamic Live Model Fetch Button */}
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels || (!hasKey && selectedTab !== 'ollama')}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isFetchingModels
                      ? 'opacity-60 cursor-wait'
                      : isDark
                        ? 'bg-[#1C1E26] border-[#303342] text-blue-400 hover:bg-[#252834] hover:text-white'
                        : 'bg-white border-slate-300 text-blue-600 hover:bg-slate-50 hover:text-blue-800 shadow-xs'
                  }`}
                  title="Query the provider's /models API live to discover valid models for your account"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                  <span>{isFetchingModels ? 'Fetching...' : 'Fetch Live Models'}</span>
                </button>
              </div>

              {/* Status Message for Model Fetching */}
              {fetchMessage && (
                <div
                  className={`text-[11px] px-3 py-1.5 rounded-lg flex items-center space-x-1.5 ${
                    fetchMessage.type === 'success'
                      ? isDark ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : isDark ? 'bg-rose-950/40 border border-rose-800/50 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {fetchMessage.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  )}
                  <span className="truncate">{fetchMessage.text}</span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    list="fetched-provider-models"
                    placeholder="e.g. gpt-4o-mini, claude-3-7-sonnet, llama3.3, gemini-2.0-flash..."
                    value={currentProviderConfig.model || ''}
                    onChange={(e) => updateProviderConfig(selectedTab, { model: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddModel(currentProviderConfig.model);
                      }
                    }}
                    className={`w-full text-xs p-2.5 rounded-xl outline-none font-mono transition-colors ${
                      isDark 
                        ? 'bg-[#15161C] border border-[#262833] text-white placeholder-[#5E606B] focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20' 
                        : 'bg-[#F8FAFC] border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
                    }`}
                  />

                  {/* Auto-suggest datalist populated with fetched live models */}
                  <datalist id="fetched-provider-models">
                    {(currentProviderConfig.availableModels || []).map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>

                {currentProviderConfig.model?.trim() && !currentProviderConfig.availableModels.includes(currentProviderConfig.model.trim()) && (
                  <button
                    type="button"
                    onClick={() => handleAddModel(currentProviderConfig.model)}
                    className="btn-primary-blue text-xs px-3 py-2.5 rounded-xl font-semibold text-white flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-xs"
                    title="Save this model to your list for future use"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save Model</span>
                  </button>
                )}
              </div>

              {/* Saved & Live Discovered Models Chips */}
              {currentProviderConfig.availableModels && currentProviderConfig.availableModels.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-[#7A7C88]' : 'text-slate-400'}`}>
                    Available Models ({currentProviderConfig.availableModels.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {currentProviderConfig.availableModels.map((m) => {
                      const isSelected = currentProviderConfig.model === m;
                      return (
                        <div
                          key={m}
                          onClick={() => updateProviderConfig(selectedTab, { model: m })}
                          className={`group text-xs font-mono px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 cursor-pointer transition-all ${
                            isSelected
                              ? isDark 
                                ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-xs' 
                                : 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                              : isDark
                                ? 'bg-[#15161C] border-[#252833] text-slate-400 hover:text-white hover:border-[#353948]'
                                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate max-w-[200px]">{m}</span>
                          {isSelected && <Check className="w-3 h-3 text-blue-500 shrink-0" />}
                          <button
                            type="button"
                            onClick={(e) => handleRemoveModel(m, e)}
                            className={`opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity ${
                              isSelected ? 'text-blue-400' : 'text-slate-500'
                            }`}
                            title="Remove from list"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Modal Footer with Test Connection */}
        <div className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-[#22242D] bg-[#14161C]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || (!hasKey && selectedTab !== 'ollama')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                isTesting
                  ? 'opacity-60 cursor-wait'
                  : isDark
                    ? 'bg-[#1C1E26] border-[#303342] text-slate-200 hover:text-white hover:border-slate-500 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
              }`}
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            {/* Test result readout */}
            {testResult && (
              <div className={`text-xs flex items-center space-x-1.5 font-medium ${
                testResult.success 
                  ? 'text-emerald-500' 
                  : isDark ? 'text-rose-400' : 'text-rose-600'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate max-w-[280px]" title={testResult.message}>
                  {testResult.success 
                    ? `Connected! (${testResult.latencyMs}ms)` 
                    : testResult.message
                  }
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 text-[11px] text-slate-400 dark:text-[#71727D]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Keys stored locally</span>
            </div>

            <button
              onClick={() => setIsSettingsOpen(false)}
              className="btn-primary-blue px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow-sm"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
