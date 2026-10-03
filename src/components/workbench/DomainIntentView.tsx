import React, { useState } from 'react';
import { 
  FileText, 
  ArrowRight, 
  Loader2, 
  Cpu, 
  Key, 
  Layers, 
  Check, 
  Star,
  Globe,
  Server,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Palette,
  Split,
  Combine,
  Monitor,
  Code2,
  Database,
  Bot,
  Workflow,
  Network,
  Terminal,
  Shield,
  Zap,
  Cloud,
  Lock,
  WifiOff,
  Sliders,
  Gauge
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { useNotification } from '../../context/NotificationContext';
import { expandAndPolishDescription, analyzeFrameworksWithAI } from '../../services/aiService';
import { FrameworkRecommendation, ArchitecturePreference, StylingPreference, BackendPreference } from '../../types/project';
import { SystemArchitectureDiagram } from './SystemArchitectureDiagram';

interface DomainIntentViewProps {
  onProceedToInvariants: () => void;
}

export const DomainIntentView: React.FC<DomainIntentViewProps> = ({ onProceedToInvariants }) => {
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();
  const { settings, isAiConfigured, setIsSettingsOpen } = useAI();
  const { notify } = useNotification();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingStack, setIsAnalyzingStack] = useState(false);
  const [customFramework, setCustomFramework] = useState('');
  const [isCustomSelected, setIsCustomSelected] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<FrameworkRecommendation[] | null>(null);

  if (!activeProject) return null;

  const { spec } = activeProject;

  const architecturePreference: ArchitecturePreference = spec.architecturePreference || 'auto';
  const stylingPreference: StylingPreference = spec.stylingPreference || 'auto';
  const backendPreference: BackendPreference = spec.backendPreference || 'auto';
  const targetPlatforms: string[] = spec.targetPlatforms || [];
  const nfrPreferences: string[] = spec.nfrPreferences || [];
  const customRequirements: string = spec.customRequirements || '';

  // Recommendations: only those generated for this project (stored in spec or state)
  const activeRecommendations: FrameworkRecommendation[] = aiRecommendations || spec.frameworkRecommendations || [];

  // Active framework selection
  const activeFrameworkId = spec.targetFramework || (activeRecommendations.length > 0 ? activeRecommendations[0].id : undefined);

  // Guided Wizard State (4-Step Progressive Architectural Funnel)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [isWizardMode, setIsWizardMode] = useState<boolean>(activeRecommendations.length === 0);
  const [showDiagram, setShowDiagram] = useState<boolean>(true);

  const handleDescriptionChange = (desc: string) => {
    updateProjectSpec(activeProject.id, { description: desc });
  };

  const togglePlatform = (platform: string) => {
    const next = targetPlatforms.includes(platform)
      ? targetPlatforms.filter(p => p !== platform)
      : [...targetPlatforms, platform];
    updateProjectSpec(activeProject.id, { targetPlatforms: next });
  };

  const toggleNFR = (nfr: string) => {
    const next = nfrPreferences.includes(nfr)
      ? nfrPreferences.filter(n => n !== nfr)
      : [...nfrPreferences, nfr];
    updateProjectSpec(activeProject.id, { nfrPreferences: next });
  };

  const handleSelectFramework = (fw: FrameworkRecommendation) => {
    setIsCustomSelected(false);
    updateProjectSpec(activeProject.id, {
      targetFramework: fw.id,
      frameworkRecommendation: fw
    });
    notify.success(`Selected ${fw.name}`);
  };

  const handleApplyCustomFramework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFramework.trim()) return;

    const customRec: FrameworkRecommendation = {
      id: 'custom_' + Date.now(),
      name: customFramework.trim(),
      category: 'Full-Stack Web',
      architecture: 'Integrated Full-Stack',
      description: 'Custom technology stack specified by user.',
      whyReasons: ['Custom tailored technology chosen for specific project requirements.'],
      bestFor: 'Custom architectural setups'
    };

    setIsCustomSelected(true);
    updateProjectSpec(activeProject.id, {
      targetFramework: customRec.id,
      frameworkRecommendation: customRec
    });

    notify.success(`Selected custom stack: ${customFramework.trim()}`);
  };

  const handleAutoGenerate = async () => {
    if (!spec.description?.trim() && !activeProject.name.trim()) {
      notify.warning('Please enter a project name or brief description first.');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await expandAndPolishDescription(
        activeProject.name,
        spec.description || '',
        settings
      );

      // 1. Immediately apply the polished description
      updateProjectSpec(activeProject.id, {
        description: result.text
      });

      // Stop section 1 loading state immediately
      setIsGenerating(false);
      notify.success(`Description expanded & polished with ${result.providerName || 'AI'}.`);

      // 2. Asynchronously analyze tailored tech stack
      setIsAnalyzingStack(true);
      try {
        const stackResult = await analyzeFrameworksWithAI(
          activeProject.name, 
          result.text, 
          settings,
          {
            architecturePreference,
            stylingPreference,
            backendPreference,
            targetPlatforms,
            nfrPreferences,
            customRequirements
          }
        );
        const topChoice = stackResult.recommendations[0];

        setAiRecommendations(stackResult.recommendations);
        setIsWizardMode(false);
        updateProjectSpec(activeProject.id, {
          description: result.text,
          frameworkRecommendations: stackResult.recommendations,
          targetFramework: topChoice?.id,
          frameworkRecommendation: topChoice
        });
      } catch (stackErr: any) {
        console.warn('Tech stack analysis failed during auto-generate:', stackErr);
        notify.warning(stackErr?.message || 'Tech stack analysis failed. Check AI settings.', {
          action: {
            label: 'Configure AI Key',
            onClick: () => setIsSettingsOpen(true)
          }
        });
      } finally {
        setIsAnalyzingStack(false);
      }
    } catch (err: any) {
      setIsGenerating(false);
      notify.error(err?.message || 'Failed to polish description. Check AI settings.', {
        action: {
          label: 'Configure AI Key',
          onClick: () => setIsSettingsOpen(true)
        }
      });
    }
  };

  const handleAnalyzeStack = async (
    overrideArch?: ArchitecturePreference, 
    overrideStyling?: StylingPreference,
    overrideBackend?: BackendPreference
  ) => {
    if (!spec.description?.trim()) {
      notify.warning('Please enter what you are building in Section 1 first so AI can tailor the stack.');
      return;
    }

    const targetArch = overrideArch !== undefined ? overrideArch : architecturePreference;
    const targetStyling = overrideStyling !== undefined ? overrideStyling : stylingPreference;
    const targetBackend = overrideBackend !== undefined ? overrideBackend : backendPreference;

    setIsAnalyzingStack(true);

    try {
      const stackResult = await analyzeFrameworksWithAI(
        activeProject.name, 
        spec.description || '', 
        settings,
        {
          architecturePreference: targetArch,
          stylingPreference: targetStyling,
          backendPreference: targetBackend,
          targetPlatforms,
          nfrPreferences,
          customRequirements
        }
      );
      setAiRecommendations(stackResult.recommendations);
      const topChoice = stackResult.recommendations[0];

      setIsWizardMode(false);
      updateProjectSpec(activeProject.id, {
        architecturePreference: targetArch,
        stylingPreference: targetStyling,
        backendPreference: targetBackend,
        frameworkRecommendations: stackResult.recommendations,
        targetFramework: topChoice?.id,
        frameworkRecommendation: topChoice
      });

      setIsAnalyzingStack(false);
      notify.success(`AI generated tailored stack recommendations with ${stackResult.providerName || 'AI'}.`);
    } catch (err: any) {
      setIsAnalyzingStack(false);
      notify.error(err?.message || 'Failed to analyze tech stack. Check AI settings.', {
        action: {
          label: 'Configure AI Key',
          onClick: () => setIsSettingsOpen(true)
        }
      });
    }
  };

  const handleUpdateArchitecture = (arch: ArchitecturePreference) => {
    updateProjectSpec(activeProject.id, { architecturePreference: arch });
  };

  const handleUpdateStyling = (styling: StylingPreference) => {
    updateProjectSpec(activeProject.id, { stylingPreference: styling });
  };

  const handleUpdateBackend = (backend: BackendPreference) => {
    updateProjectSpec(activeProject.id, { backendPreference: backend });
  };

  const getCategoryIcon = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('desktop') || cat.includes('tauri') || cat.includes('electron')) return Monitor;
    if (cat.includes('mobile') || cat.includes('ios') || cat.includes('android') || cat.includes('expo') || cat.includes('flutter')) return Smartphone;
    if (cat.includes('ai') || cat.includes('agent') || cat.includes('rag') || cat.includes('llm')) return Bot;
    if (cat.includes('event') || cat.includes('kafka') || cat.includes('microservice')) return Network;
    if (cat.includes('edge') || cat.includes('serverless') || cat.includes('worker') || cat.includes('cloudflare')) return Cloud;
    if (cat.includes('cli') || cat.includes('terminal') || cat.includes('tool')) return Terminal;
    if (cat.includes('api') || cat.includes('backend') || cat.includes('fastapi')) return Cpu;
    return Globe;
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto w-full">
      {/* Main Document Body */}
      <div className="p-8 space-y-7 w-full max-w-7xl mx-auto">
        
        {/* Section 1: Project Description */}
        <div className={`rounded-xl border p-6 space-y-4 transition-all focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/20 ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <label htmlFor="system-objective-input" className={`text-xs font-bold uppercase tracking-wider cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  1. What are you building?
                </label>
              </div>
              <p className={`text-xs pl-6 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                Describe what your app or website does in simple words. What problem does it solve and what should it do?
              </p>
            </div>

            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="btn-primary-blue disabled:opacity-50 px-3.5 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Polishing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Expand & Polish with AI</span>
                </>
              )}
            </button>
          </div>

          {/* If generating/polishing description, show clean loading state */}
          {isGenerating ? (
            <div className={`p-8 rounded-xl border border-dashed flex flex-col items-center justify-center space-y-3 transition-all animate-in fade-in duration-150 ${
              isDark ? 'bg-[#121318]/50 border-blue-500/40 text-slate-300' : 'bg-blue-50/40 border-blue-200 text-slate-700'
            }`}>
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold">AI Software Architect is expanding and polishing your specification...</p>
                <p className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  Structuring core value proposition, primary workflows, and reliability expectations.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <textarea
                id="system-objective-input"
                rows={5}
                value={spec.description || ''}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Describe your app or idea (e.g. An e-commerce store where customers can browse items, add them to a cart, pay securely with Stripe, and receive email receipts with order tracking)..."
                className={`w-full text-xs leading-relaxed p-4 rounded-xl border outline-none resize-y transition-all font-sans ${
                  isDark 
                    ? 'bg-[#101114] border-[#20222A] text-white placeholder-[#5E606B] focus:border-[#2E313D]' 
                    : 'bg-[#F8FAFC] border-slate-200/80 text-slate-900 placeholder-slate-400 focus:border-slate-300'
                }`}
              />
            </div>
          )}

          {!isAiConfigured && (
            <div className={`text-xs flex items-center justify-between pt-1 border-t ${
              isDark ? 'border-[#1E2028] text-[#8E8F99]' : 'border-slate-100 text-slate-500'
            }`}>
              <div className="flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Tip: Connect your own Claude, OpenAI, Gemini, or Ollama API key for deeper intelligence.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="text-blue-500 hover:underline font-semibold cursor-pointer shrink-0"
              >
                Connect AI Key
              </button>
            </div>
          )}
        </div>

        {/* Section 2: AI Recommended Tech Stack */}
        <div className={`rounded-xl border p-6 space-y-5 transition-colors ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  2. Recommended Tech Stack & Framework
                </h3>
              </div>
              <p className={`text-xs pl-6 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                {isWizardMode
                  ? 'Answer 4 quick questions to guide AI: Platform, Architecture, Styling, and Database.'
                  : 'AI-tailored recommendations based on your target platform, architectural model, and styling preferences.'}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {!isWizardMode && (
                <button
                  onClick={() => setIsWizardMode(true)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                    isDark 
                      ? 'border-[#2D303B] bg-[#161820] text-slate-300 hover:text-white hover:border-blue-500/50' 
                      : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:border-blue-400'
                  }`}
                  title="Adjust your answers in the guided questionnaire"
                >
                  <Split className="w-3.5 h-3.5 text-blue-500" />
                  <span>Adjust Preferences</span>
                </button>
              )}

              {activeRecommendations.length > 0 && !isWizardMode && (
                <button
                  onClick={() => handleAnalyzeStack()}
                  disabled={isAnalyzingStack || !spec.description?.trim()}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                    isDark 
                      ? 'border-[#2D303B] bg-[#161820] text-slate-200 hover:text-white hover:border-blue-500/50 disabled:opacity-40' 
                      : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:border-blue-400 disabled:opacity-40'
                  }`}
                  title="Re-analyze description to get updated framework recommendations"
                >
                  {isAnalyzingStack ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>Analyzing Stack...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                      <span>Re-analyze with AI</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Guided Step-by-Step Questionnaire Wizard */}
          {isWizardMode && (
            <div className={`p-6 rounded-xl border space-y-6 animate-in fade-in zoom-in-98 duration-200 ${
              isDark ? 'bg-[#111217] border-[#22242E]' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}>
              
              {/* Wizard Step Progress Header */}
              <div className="flex items-center justify-between border-b pb-4 dark:border-[#1E2028] border-slate-200/80">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      Question {wizardStep} of 4
                    </span>
                    <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {wizardStep === 1 && 'Target Deployment Platform'}
                      {wizardStep === 2 && `Application Architecture (${targetPlatforms.length > 0 ? targetPlatforms[0] : 'Auto Tailored'})`}
                      {wizardStep === 3 && 'User Interface & Styling System'}
                      {wizardStep === 4 && 'Backend Language & Database Ecosystem'}
                    </span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                    {wizardStep === 1 && 'Where will your software and users run this? Select your primary target ecosystems.'}
                    {wizardStep === 2 && 'Based on your selected platform, choose an optimal architectural topology and production guardrails.'}
                    {wizardStep === 3 && 'How would you like to build your components, layouts, and visual design?'}
                    {wizardStep === 4 && 'Select your preferred language runtime and database engine, or let AI analyze your needs.'}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-28 bg-slate-200 dark:bg-[#1D1F28] rounded-full h-1.5 overflow-hidden shrink-0">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(wizardStep / 4) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question 1: Target Deployment Platform */}
              {wizardStep === 1 && (
                <div className="space-y-6">
                  {/* Platform Archetype Cards */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        1. Primary Platform Archetype
                      </span>
                      <span className={`text-[11px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>
                        Select your platform ecosystem
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        {
                          id: 'auto',
                          title: '✨ Let AI Decide',
                          subtitle: 'Adaptive Discovery',
                          badge: 'Dynamic',
                          desc: 'AI infers target deployment targets automatically from your project description.',
                          icon: Sparkles
                        },
                        {
                          id: 'Web Browser',
                          title: '🌐 Web Browser App',
                          subtitle: 'SaaS & Web Clients',
                          badge: 'Web Standard',
                          desc: 'Modern browser web application accessible worldwide across desktop and mobile browsers.',
                          icon: Globe
                        },
                        {
                          id: 'Mobile Application',
                          title: '📱 Mobile Native',
                          subtitle: 'iOS & Android',
                          badge: 'Touch / Mobile',
                          desc: 'Touch-optimized native smartphone and tablet apps (Expo / React Native or Flutter).',
                          icon: Smartphone
                        },
                        {
                          id: 'Desktop Native Software',
                          title: '🖥️ Desktop Native',
                          subtitle: 'macOS, Windows & Linux',
                          badge: 'Offline / Filesystem',
                          desc: 'Lightweight workstation software with local filesystem access (Tauri 2.0 / Rust).',
                          icon: Monitor
                        },
                        {
                          id: 'Universal Cross-Platform',
                          title: '🌐📱 Universal App',
                          subtitle: 'Web + Mobile + Desktop',
                          badge: 'Omnichannel',
                          desc: 'Single unified architecture delivering seamless experiences across all device platforms.',
                          icon: Layers
                        },
                        {
                          id: 'Edge / Serverless Topology',
                          title: '☁️ Edge / Serverless',
                          subtitle: 'Global Low Latency',
                          badge: 'Zero Cold Start',
                          desc: 'Globally distributed edge compute workers (Cloudflare Workers, Hono, Supabase Edge).',
                          icon: Cloud
                        },
                        {
                          id: 'Backend API & Services',
                          title: '⚡ Backend / API',
                          subtitle: 'REST / GraphQL / gRPC',
                          badge: 'Headless Service',
                          desc: 'High-performance backend API service, queue consumers, and background data processors.',
                          icon: Server
                        },
                        {
                          id: 'Developer Tool & CLI',
                          title: '💻 Terminal & CLI',
                          subtitle: 'Single Native Binary',
                          badge: 'Developer Tool',
                          desc: 'Ultra-fast command-line tool or systems automation utility with zero dependencies.',
                          icon: Terminal
                        }
                      ].map((opt) => {
                        const isSelected = (opt.id === 'auto' && targetPlatforms.length === 0) || targetPlatforms.includes(opt.id);
                        const Icon = opt.icon;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              if (opt.id === 'auto') {
                                updateProjectSpec(activeProject.id, { targetPlatforms: [] });
                              } else {
                                updateProjectSpec(activeProject.id, { targetPlatforms: [opt.id] });
                              }
                            }}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 cursor-pointer transition-all ${
                              isSelected
                                ? isDark
                                  ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/30 shadow-xs'
                                  : 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-500/20 shadow-xs'
                                : isDark
                                  ? 'bg-[#15161C] border-[#22242D] hover:border-[#323644]'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : isDark ? 'bg-[#1F212B] text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.title}</div>
                                  <div className="flex items-center space-x-1.5 mt-0.5">
                                    <span className={`text-[10px] font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{opt.subtitle}</span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                      isDark ? 'bg-[#1D1F28] text-slate-400 border border-[#2B2D3A]' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                      {opt.badge}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : isDark ? 'border-[#333644]' : 'border-slate-300'}`}>
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </div>
                            </div>
                            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                              {opt.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-Platform Detailed Tags */}
                  <div className={`p-4 rounded-xl border space-y-2.5 ${
                    isDark ? 'bg-[#14151B] border-[#22242E]' : 'bg-slate-100/70 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          2. Granular Target Platforms (Toggle All That Apply)
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>
                        {targetPlatforms.length === 0 ? 'Auto / All applicable' : `${targetPlatforms.length} selected`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'Web Browser', label: '🌐 Web Browser' },
                        { id: 'iOS', label: '🍏 iOS' },
                        { id: 'Android', label: '🤖 Android' },
                        { id: 'macOS', label: '🍎 macOS' },
                        { id: 'Windows', label: '🪟 Windows' },
                        { id: 'Linux', label: '🐧 Linux' },
                        { id: 'Edge / Cloud Worker', label: '☁️ Edge / Serverless' },
                        { id: 'Terminal / CLI', label: '⌨️ Terminal / CLI' }
                      ].map((plat) => {
                        const isSelected = targetPlatforms.includes(plat.id);
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => togglePlatform(plat.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                : isDark
                                  ? 'bg-[#181A22] border-[#262834] text-slate-300 hover:border-slate-600'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span>{plat.label}</span>
                            {isSelected && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Platform write-in */}
                  <div className="flex items-center space-x-2 pt-1">
                    <span className={`text-[11px] font-mono shrink-0 ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>Or custom platform target:</span>
                    <input
                      type="text"
                      placeholder="e.g. Embedded IoT, Raspberry Pi, VisionOS, Chrome Extension, Electron..."
                      value={targetPlatforms.filter(p => !['Web Browser', 'iOS', 'Android', 'macOS', 'Windows', 'Linux', 'Edge / Cloud Worker', 'Terminal / CLI', 'Mobile Application', 'Desktop Native Software', 'Universal Cross-Platform', 'Edge / Serverless Topology', 'Backend API & Services', 'Developer Tool & CLI'].includes(p)).join(', ')}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const standard = targetPlatforms.filter(p => ['Web Browser', 'iOS', 'Android', 'macOS', 'Windows', 'Linux', 'Edge / Cloud Worker', 'Terminal / CLI', 'Mobile Application', 'Desktop Native Software', 'Universal Cross-Platform', 'Edge / Serverless Topology', 'Backend API & Services', 'Developer Tool & CLI'].includes(p));
                        if (val) {
                          updateProjectSpec(activeProject.id, { targetPlatforms: [...standard, val] });
                        } else {
                          updateProjectSpec(activeProject.id, { targetPlatforms: standard });
                        }
                      }}
                      className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                        isDark ? 'studio-input-dark' : 'studio-input-light'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Question 2: Architecture Topology & Production Guardrails */}
              {wizardStep === 2 && (() => {
                const hasMobile = targetPlatforms.some(p => p.toLowerCase().includes('mobile') || p === 'iOS' || p === 'Android');
                const hasDesktop = targetPlatforms.some(p => p.toLowerCase().includes('desktop') || p === 'macOS' || p === 'Windows' || p === 'Linux');
                const hasCLI = targetPlatforms.some(p => p.toLowerCase().includes('cli') || p.toLowerCase().includes('terminal'));
                const hasBackend = targetPlatforms.some(p => p.toLowerCase().includes('backend') || p.toLowerCase().includes('api'));
                const hasUniversal = targetPlatforms.some(p => p.toLowerCase().includes('universal'));

                let dynamicArchOptions = [
                  {
                    id: 'auto',
                    title: '✨ Let AI Decide',
                    subtitle: 'Autonomous Match',
                    badge: 'Adaptive',
                    desc: 'AI synthesizes your selected platforms & goals to recommend the optimal architecture.',
                    icon: Sparkles
                  },
                  {
                    id: 'Integrated Full-Stack',
                    title: '🌐 Integrated Full-Stack',
                    subtitle: 'Unified Monolith',
                    badge: 'Fast Shipping',
                    desc: 'Frontend & Backend in one unified codebase (Next.js, Django, SvelteKit, Nuxt). Zero API boilerplate.',
                    icon: Combine
                  },
                  {
                    id: 'Separate (Frontend + Backend API)',
                    title: '⚡ Decoupled Stack',
                    subtitle: 'SPA + Standalone API',
                    badge: 'Independent Scale',
                    desc: 'Dedicated Web Client (React/Vite/Vue) paired with an independent API (FastAPI, Go, Node.js, C#).',
                    icon: Split
                  },
                  {
                    id: 'AI Agent & RAG Pipeline',
                    title: '🤖 AI Agent & RAG Pipeline',
                    subtitle: 'Intelligent Workflows',
                    badge: 'AI Native',
                    desc: 'Vector embeddings, async worker queues (Celery/Temporal), FastAPI, streaming LLM inference.',
                    icon: Bot
                  },
                  {
                    id: 'Event-Driven & Microservices',
                    title: '🔄 Event-Driven Microservices',
                    subtitle: 'Distributed Systems',
                    badge: 'High Scale',
                    desc: 'Message brokers (Kafka, RabbitMQ, NATS), gRPC contracts, and decoupled domain bounded contexts.',
                    icon: Network
                  },
                  {
                    id: 'Edge / Serverless Topology',
                    title: '⚡ Edge / Serverless',
                    subtitle: 'Global Edge Runtimes',
                    badge: 'Zero Cold Start',
                    desc: 'Ultra-low latency edge compute (Cloudflare Workers, Hono, Supabase, Neon) with global distribution.',
                    icon: Cloud
                  }
                ];

                if (hasMobile && !hasDesktop && !hasUniversal) {
                  dynamicArchOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Mobile Optimized',
                      badge: 'Adaptive',
                      desc: 'AI determines the ideal mobile stack matching your application features and performance requirements.',
                      icon: Sparkles
                    },
                    {
                      id: 'Expo / React Native (Universal Mobile)',
                      title: '📱 Expo / React Native',
                      subtitle: 'Cross-Platform Mobile',
                      badge: 'High Velocity',
                      desc: 'Single TypeScript codebase running natively on iOS & Android with instant OTA updates and device hardware access.',
                      icon: Smartphone
                    },
                    {
                      id: 'Flutter Native Engine (Dart)',
                      title: '🎯 Flutter (Dart)',
                      subtitle: 'Custom Canvas Engine',
                      badge: '120fps Native',
                      desc: 'Pixel-perfect, high-performance compiled mobile app with rich native Cupertino and Material widgets.',
                      icon: Smartphone
                    },
                    {
                      id: 'Decoupled Mobile App + Dedicated Cloud API',
                      title: '⚡ Mobile App + Cloud API',
                      subtitle: 'Client + Independent API',
                      badge: 'Independent Scale',
                      desc: 'Native mobile client connecting to a dedicated Python/Go/Node backend with token authentication and WebSockets.',
                      icon: Split
                    },
                    {
                      id: 'Mobile App + Serverless BaaS (Supabase/Firebase)',
                      title: '🔥 Mobile + BaaS Cloud',
                      subtitle: 'Instant Auth & Sync',
                      badge: 'Zero Backend Ops',
                      desc: 'Mobile app wired directly to Supabase or Firebase with built-in user auth, storage, and real-time database.',
                      icon: Database
                    }
                  ];
                } else if (hasDesktop && !hasMobile && !hasUniversal) {
                  dynamicArchOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Desktop Optimized',
                      badge: 'Adaptive',
                      desc: 'AI selects the optimal desktop runtime based on memory footprint and local OS requirements.',
                      icon: Sparkles
                    },
                    {
                      id: 'Tauri 2.0 (Rust Core + Web Frontend)',
                      title: '🖥️ Tauri 2.0 (Rust + Web)',
                      subtitle: 'Ultra-Lightweight Desktop',
                      badge: '<30MB RAM',
                      desc: 'Modern web UI (React/Vite) paired with a high-speed, secure Rust backend for native macOS/Windows/Linux IPC.',
                      icon: Monitor
                    },
                    {
                      id: 'Electron Desktop Application',
                      title: '⚛️ Electron Desktop App',
                      subtitle: 'Chromium + Node.js',
                      badge: 'Deep Node Access',
                      desc: 'Full-featured cross-platform desktop application powered by bundled Chromium and Node.js runtime.',
                      icon: Monitor
                    },
                    {
                      id: 'Desktop Native (.NET MAUI / Swift)',
                      title: '🪟 Native OS App (.NET / Swift)',
                      subtitle: 'Compiled OS Native',
                      badge: 'Pure OS Controls',
                      desc: 'High-performance compiled desktop software utilizing native macOS (SwiftUI) or Windows (.NET) UI controls.',
                      icon: Code2
                    },
                    {
                      id: 'Offline Workstation + Embedded DB',
                      title: '📴 Offline Workstation + SQLite',
                      subtitle: 'Local-First Storage',
                      badge: 'Complete Privacy',
                      desc: 'Completely offline desktop tool saving directly to local files and embedded SQLite database.',
                      icon: Database
                    }
                  ];
                } else if (hasCLI) {
                  dynamicArchOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'CLI Optimized',
                      badge: 'Adaptive',
                      desc: 'AI chooses the ideal systems language and distribution method for your command-line tool.',
                      icon: Sparkles
                    },
                    {
                      id: 'Single Native Binary CLI (Rust / Cargo)',
                      title: '🦀 Rust Single Binary',
                      subtitle: 'Clap + Ratatui TUI',
                      badge: 'Blazing Fast',
                      desc: 'Zero-dependency native compiled binary with instant startup, tiny memory footprint, and optional terminal UI.',
                      icon: Terminal
                    },
                    {
                      id: 'High-Speed Go CLI Tool (Cobra / Bubbletea)',
                      title: '🐹 Go CLI & TUI',
                      subtitle: 'Cobra + Bubbletea',
                      badge: 'Easy Concurrency',
                      desc: 'Fast compiled cross-platform Go binary with interactive terminal widgets and concurrent task orchestration.',
                      icon: Terminal
                    },
                    {
                      id: 'Node.js CLI Package (TypeScript / Commander)',
                      title: '🟦 TypeScript / Node CLI',
                      subtitle: 'npm / npx Executable',
                      badge: 'NPM Distribution',
                      desc: 'JavaScript/TypeScript CLI tool distributed via npm with rich interactive prompts and colored formatting.',
                      icon: Terminal
                    },
                    {
                      id: 'Python Automation CLI (Typer / Rich)',
                      title: '🐍 Python CLI (Typer + Rich)',
                      subtitle: 'Data & Scripting Tool',
                      badge: 'Rich Terminal UI',
                      desc: 'Developer CLI with automatic help menus, progress bars, and rich terminal formatted output.',
                      icon: Terminal
                    }
                  ];
                } else if (hasUniversal) {
                  dynamicArchOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Universal Topology',
                      badge: 'Adaptive',
                      desc: 'AI structures a unified monorepo to maximize code reuse across Web, Mobile, and Desktop.',
                      icon: Sparkles
                    },
                    {
                      id: 'Universal Monorepo (Next.js + Expo / Tamagui)',
                      title: '🌐📱 Universal Monorepo',
                      subtitle: 'Next.js + Expo (Solito)',
                      badge: '80%+ Shared Code',
                      desc: 'Share 80%+ of UI components, routing, and business logic across Web and Mobile with Solito / Tamagui.',
                      icon: Layers
                    },
                    {
                      id: 'Decoupled Multi-Client + Shared Backend API',
                      title: '⚡ Multi-Client + Central API',
                      subtitle: 'Web, Mobile & Shared API',
                      badge: 'Modular Scale',
                      desc: 'Independent Web and Mobile frontends communicating with a single, robust centralized backend API.',
                      icon: Split
                    },
                    {
                      id: 'Tauri + Capacitor Unified Web Core',
                      title: '🖥️📱 Unified Web Core',
                      subtitle: 'Single Codebase Multi-Target',
                      badge: 'One Codebase',
                      desc: 'One React/TypeScript web codebase packaged for Desktop via Tauri and Mobile via Capacitor.',
                      icon: Monitor
                    }
                  ];
                } else if (hasBackend) {
                  dynamicArchOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Backend Tailored',
                      badge: 'Adaptive',
                      desc: 'AI architects the optimal API runtime and data pipeline.',
                      icon: Sparkles
                    },
                    {
                      id: 'High-Speed Async REST API (FastAPI / Python)',
                      title: '🐍 FastAPI Async Backend',
                      subtitle: 'Pydantic v2 + asyncpg',
                      badge: 'AI & Data Friendly',
                      desc: 'High-throughput async Python backend with automatic OpenAPI docs and native ML support.',
                      icon: Server
                    },
                    {
                      id: 'Go / Rust Microservices (Fiber / Axum / gRPC)',
                      title: '⚡ Go / Rust Microservices',
                      subtitle: 'Fiber / Axum + gRPC',
                      badge: 'Ultra High Concurrency',
                      desc: 'Sub-millisecond latency service handling tens of thousands of concurrent connections.',
                      icon: Network
                    },
                    {
                      id: 'Event-Driven Microservices (Kafka / RabbitMQ)',
                      title: '🔄 Event-Driven Architecture',
                      subtitle: 'Message Broker + Workers',
                      badge: 'Enterprise Scale',
                      desc: 'Decoupled domain services communicating asynchronously through message queues.',
                      icon: Network
                    },
                    {
                      id: 'Serverless Cloud Functions (AWS Lambda / Edge)',
                      title: '☁️ Serverless Micro-API',
                      subtitle: 'Auto-Scaling Compute',
                      badge: 'Zero Server Ops',
                      desc: 'Event-triggered serverless handlers scaling automatically from zero to millions of requests.',
                      icon: Cloud
                    }
                  ];
                }

                return (
                  <div className="space-y-6">
                    {/* Archetype Cards Grid */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            1. Select Architecture Topology Pattern
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            Tailored for: {targetPlatforms.length > 0 ? targetPlatforms.join(', ') : 'All Platforms'}
                          </span>
                        </div>
                        <span className={`text-[11px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>
                          Choose a design pattern or let AI decide
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dynamicArchOptions.map((opt) => {
                          const isSelected = architecturePreference === opt.id;
                          const Icon = opt.icon;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleUpdateArchitecture(opt.id)}
                              className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 cursor-pointer transition-all ${
                                isSelected
                                  ? isDark
                                    ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/30 shadow-xs'
                                    : 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-500/20 shadow-xs'
                                  : isDark
                                    ? 'bg-[#15161C] border-[#22242D] hover:border-[#323644]'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : isDark ? 'bg-[#1F212B] text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.title}</div>
                                    <div className="flex items-center space-x-1.5 mt-0.5">
                                      <span className={`text-[10px] font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{opt.subtitle}</span>
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                        isDark ? 'bg-[#1D1F28] text-slate-400 border border-[#2B2D3A]' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}>
                                        {opt.badge}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : isDark ? 'border-[#333644]' : 'border-slate-300'}`}>
                                  {isSelected && <Check className="w-2.5 h-2.5" />}
                                </div>
                              </div>
                              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                                {opt.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Production Non-Functional Invariants & Guardrails (NFRs) */}
                    <div className={`p-4 rounded-xl border space-y-2.5 ${
                      isDark ? 'bg-[#14151B] border-[#22242E]' : 'bg-slate-100/70 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <Shield className="w-3.5 h-3.5 text-amber-500" />
                          <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            2. Critical Production Invariants & Guardrails (NFRs)
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>
                          {nfrPreferences.length === 0 ? 'Standard baseline' : `${nfrPreferences.length} active`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          { id: 'Real-Time / Live Collaboration', label: '⚡ Real-Time / WebSockets', desc: 'Live multi-user sync & SSE' },
                          { id: 'Multi-Tenant SaaS Isolation', label: '🔒 Multi-Tenant SaaS', desc: 'Strict RLS & tenant data isolation' },
                          { id: 'Offline-First & Local DB Sync', label: '📴 Offline-First Sync', desc: 'Embedded SQLite & CRDTs' },
                          { id: 'Strict Compliance & ACID Safety', label: '🛡️ ACID Compliance', desc: 'Financial/audit-grade transactions' },
                          { id: 'Sub-10ms High Concurrency', label: '🚀 Sub-10ms Throughput', desc: 'In-memory cache & connection pool' },
                          { id: 'Zero-Trust Auth & RBAC', label: '🔑 Zero-Trust RBAC', desc: 'Granular role & permission gates' }
                        ].map((nfr) => {
                          const isSelected = nfrPreferences.includes(nfr.id);
                          return (
                            <div
                              key={nfr.id}
                              onClick={() => toggleNFR(nfr.id)}
                              className={`p-2.5 rounded-lg border flex items-start justify-between space-x-2 cursor-pointer transition-all ${
                                isSelected
                                  ? isDark
                                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-xs'
                                    : 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs'
                                  : isDark
                                    ? 'bg-[#181A22] border-[#262834] text-slate-300 hover:border-slate-600'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="text-xs font-semibold">{nfr.label}</div>
                                <div className={`text-[10px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>{nfr.desc}</div>
                              </div>
                              <div className={`w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-500 text-black'
                                  : isDark ? 'border-[#383A48]' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Architecture write-in */}
                    <div className="flex items-center space-x-2 pt-1">
                      <span className={`text-[11px] font-mono shrink-0 ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>Or custom pattern / directives:</span>
                      <input
                        type="text"
                        placeholder="e.g. Distributed actor system with Akka/Ray, WebAssembly in-browser computing, Supabase Edge..."
                        value={['auto', 'Integrated Full-Stack', 'Separate (Frontend + Backend API)', 'AI Agent & RAG Pipeline', 'Event-Driven & Microservices', 'Edge / Serverless Topology', 'Mobile Application', 'Desktop Native Software', 'Developer Tool & CLI', 'Expo / React Native (Universal Mobile)', 'Flutter Native Engine (Dart)', 'Tauri 2.0 (Rust Core + Web Frontend)', 'Single Native Binary CLI (Rust / Cargo)', 'Universal Monorepo (Next.js + Expo / Tamagui)'].includes(architecturePreference) ? '' : architecturePreference}
                        onChange={(e) => handleUpdateArchitecture(e.target.value || 'auto')}
                        className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                          isDark ? 'studio-input-dark' : 'studio-input-light'
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Question 3: Styling */}
              {wizardStep === 3 && (() => {
                const hasMobile = targetPlatforms.some(p => p.toLowerCase().includes('mobile') || p === 'iOS' || p === 'Android');
                const hasCLI = targetPlatforms.some(p => p.toLowerCase().includes('cli') || p.toLowerCase().includes('terminal'));

                let dynamicStylingOptions = [
                  {
                    id: 'auto',
                    title: '✨ Let AI Decide',
                    subtitle: 'Platform Tailored',
                    desc: 'AI chooses the standard, most productive styling solution matching your architecture.',
                    icon: Sparkles
                  },
                  {
                    id: 'Tailwind CSS v4',
                    title: '🎨 Tailwind CSS v4',
                    subtitle: 'Utility-First System',
                    desc: 'Rapid UI building with composable utility classes, responsive design, and tiny bundle size.',
                    icon: Palette
                  },
                  {
                    id: 'shadcn/ui + Tailwind CSS',
                    title: '💎 shadcn/ui + Tailwind',
                    subtitle: 'Accessible Component Primitives',
                    desc: 'Pre-styled accessible component primitives (Radix UI) copied directly into your project.',
                    icon: Palette
                  },
                  {
                    id: 'Component Library (Mantine / Chakra / MUI)',
                    title: '🧩 Component UI Kit',
                    subtitle: 'Mantine / Chakra / MUI',
                    desc: 'Comprehensive out-of-the-box component library with rich built-in theme support.',
                    icon: Palette
                  },
                  {
                    id: 'Vanilla CSS / CSS Modules',
                    title: '🖌️ Vanilla CSS / Modules',
                    subtitle: 'Pure CSS Stylesheets',
                    desc: 'Zero-runtime standard CSS / CSS modules with maximum control and clean separation.',
                    icon: Palette
                  }
                ];

                if (hasMobile) {
                  dynamicStylingOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Native Mobile Styling',
                      desc: 'AI chooses the optimal mobile styling toolkit for responsive screens and dark mode.',
                      icon: Sparkles
                    },
                    {
                      id: 'NativeWind (Tailwind for React Native)',
                      title: '🎨 NativeWind (Tailwind)',
                      subtitle: 'Tailwind for React Native',
                      desc: 'Use familiar Tailwind CSS utility classes directly inside React Native and Expo.',
                      icon: Palette
                    },
                    {
                      id: 'Tamagui / Gluestack Universal UI',
                      title: '🧩 Tamagui / Universal UI',
                      subtitle: 'Cross-Platform Primitives',
                      desc: 'High-performance shared component kit running natively on iOS, Android, and Web.',
                      icon: Palette
                    },
                    {
                      id: 'Flutter Material 3 / Cupertino Theme',
                      title: '🎯 Material 3 / Cupertino',
                      subtitle: 'Native Flutter Theming',
                      desc: 'Built-in expressive Material 3 and iOS Cupertino theme system for Flutter.',
                      icon: Palette
                    },
                    {
                      id: 'React Native StyleSheet',
                      title: '🖌️ StyleSheet Primitives',
                      subtitle: 'Pure Native StyleSheet',
                      desc: 'Standard zero-dependency React Native StyleSheet API with maximum execution speed.',
                      icon: Palette
                    }
                  ];
                } else if (hasCLI) {
                  dynamicStylingOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Terminal Format',
                      desc: 'AI formats clean output according to UNIX terminal conventions.',
                      icon: Sparkles
                    },
                    {
                      id: 'Ratatui / Bubbletea TUI Components',
                      title: '📟 Interactive TUI',
                      subtitle: 'Full-Screen Terminal App',
                      desc: 'Full-screen interactive terminal user interface with layout grids, tables, and tabs.',
                      icon: Terminal
                    },
                    {
                      id: 'Chalk / Colored ANSI Formatting',
                      title: '🎨 ANSI Colors & Highlights',
                      subtitle: 'Rich Colored Output',
                      desc: 'Formatted terminal output with syntax highlighting, badges, and colored status tags.',
                      icon: Palette
                    },
                    {
                      id: 'Rich / Inquirer Interactive Prompts',
                      title: '⌨️ Interactive Prompts & Spinners',
                      subtitle: 'Wizard Prompts & Loaders',
                      desc: 'Animated spinners, multi-select questions, and progress bars for CLI tools.',
                      icon: Sliders
                    }
                  ];
                }

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dynamicStylingOptions.map((opt) => {
                        const isSelected = stylingPreference === opt.id;
                        const Icon = opt.icon;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleUpdateStyling(opt.id)}
                            className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 cursor-pointer transition-all ${
                              isSelected
                                ? isDark
                                  ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/30 shadow-xs'
                                  : 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-500/20 shadow-xs'
                                : isDark
                                  ? 'bg-[#15161C] border-[#22242D] hover:border-[#323644]'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : isDark ? 'bg-[#1F212B] text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.title}</div>
                                  <div className={`text-[10px] font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{opt.subtitle}</div>
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : isDark ? 'border-[#333644]' : 'border-slate-300'}`}>
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </div>
                            </div>
                            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                              {opt.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Styling write-in */}
                    <div className="flex items-center space-x-2 pt-1">
                      <span className={`text-[11px] font-mono shrink-0 ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>Or custom styling:</span>
                      <input
                        type="text"
                        placeholder="e.g. NativeWind, Tamagui, Flutter Theme, Styled Components, Emotion..."
                        value={['auto', 'Tailwind CSS v4', 'shadcn/ui + Tailwind CSS', 'Component Library (Mantine / Chakra / MUI)', 'Vanilla CSS / CSS Modules', 'NativeWind (Tailwind for React Native)', 'Tamagui / Gluestack Universal UI', 'Flutter Material 3 / Cupertino Theme', 'React Native StyleSheet'].includes(stylingPreference) ? '' : stylingPreference}
                        onChange={(e) => handleUpdateStyling(e.target.value || 'auto')}
                        className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                          isDark ? 'studio-input-dark' : 'studio-input-light'
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Question 4: Backend & Database */}
              {wizardStep === 4 && (() => {
                const hasMobile = targetPlatforms.some(p => p.toLowerCase().includes('mobile') || p === 'iOS' || p === 'Android');
                const hasDesktop = targetPlatforms.some(p => p.toLowerCase().includes('desktop') || p === 'macOS' || p === 'Windows' || p === 'Linux');
                const hasCLI = targetPlatforms.some(p => p.toLowerCase().includes('cli') || p.toLowerCase().includes('terminal'));

                let dynamicBackendOptions = [
                  {
                    id: 'auto',
                    title: '✨ Let AI Decide',
                    subtitle: 'Optimal Fit',
                    desc: 'AI determines database schemas, ORM choices, and backend runtime based on data expectations.',
                    icon: Sparkles
                  },
                  {
                    id: 'Python (FastAPI / Django + PostgreSQL)',
                    title: '🐍 Python Ecosystem',
                    subtitle: 'FastAPI / Django + SQL',
                    desc: 'Ideal for machine learning, async APIs (Pydantic / SQLAlchemy), and Python AI pipelines.',
                    icon: Code2
                  },
                  {
                    id: 'TypeScript / Node.js (Hono / Next.js / Prisma)',
                    title: '🟦 TypeScript & Node.js',
                    subtitle: 'Hono / Next.js / Prisma',
                    desc: 'End-to-end type safety between client and server with sub-millisecond cold starts.',
                    icon: Code2
                  },
                  {
                    id: 'Go or Rust (Fiber / Axum / High Throughput)',
                    title: '⚡ Go / Rust Microservices',
                    subtitle: 'Ultra High-Throughput',
                    desc: 'Extreme performance, memory efficiency, and rock-solid reliability for intensive workloads.',
                    icon: Cpu
                  },
                  {
                    id: 'Elixir (Phoenix LiveView) or Ruby on Rails',
                    title: '🚀 Elixir / Ruby / C# .NET',
                    subtitle: 'High-Productivity Ecosystems',
                    desc: 'Real-time WebSocket concurrency (Elixir/Phoenix), mature enterprise (.NET 9), or Rails velocity.',
                    icon: Database
                  }
                ];

                if (hasMobile) {
                  dynamicBackendOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Mobile Backend Match',
                      desc: 'AI recommends the ideal cloud backend or BaaS for mobile authentication and push sync.',
                      icon: Sparkles
                    },
                    {
                      id: 'Supabase PostgreSQL (BaaS + Auth + Real-Time)',
                      title: '⚡ Supabase PostgreSQL',
                      subtitle: 'Instant BaaS + Auth',
                      desc: 'Complete mobile backend with user auth, row-level security, push notifications, and Postgres.',
                      icon: Database
                    },
                    {
                      id: 'Python (FastAPI / asyncpg + PostgreSQL)',
                      title: '🐍 FastAPI (Python) API',
                      subtitle: 'High-Speed Async API',
                      desc: 'Dedicated Python REST API with token auth, Pydantic validation, and background workers.',
                      icon: Code2
                    },
                    {
                      id: 'TypeScript / Node.js (Hono / Prisma + PostgreSQL)',
                      title: '🟦 TypeScript (Hono / Node)',
                      subtitle: 'End-to-End Type Safety',
                      desc: 'Lightweight Node.js or edge API with Prisma ORM and instant JSON serialization.',
                      icon: Code2
                    },
                    {
                      id: 'Go (Fiber) or Rust (Axum) High-Speed API',
                      title: '⚡ Go / Rust Mobile API',
                      subtitle: 'Sub-Millisecond Speed',
                      desc: 'High-concurrency backend API handling millions of active mobile device pings.',
                      icon: Cpu
                    }
                  ];
                } else if (hasDesktop) {
                  dynamicBackendOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'Desktop DB Match',
                      desc: 'AI chooses between local embedded storage and cloud database sync.',
                      icon: Sparkles
                    },
                    {
                      id: 'Embedded SQLite / SurrealDB (Local Desktop DB)',
                      title: '📴 Embedded SQLite / SurrealDB',
                      subtitle: 'Zero-Cloud Local Storage',
                      desc: 'Embedded local database stored directly on the user’s computer with zero network latency.',
                      icon: Database
                    },
                    {
                      id: 'TypeScript (Prisma ORM + SQLite Local File)',
                      title: '🟦 Prisma + SQLite File',
                      subtitle: 'Type-Safe Local Data',
                      desc: 'Prisma Client interacting with a local SQLite file inside the application directory.',
                      icon: Code2
                    },
                    {
                      id: 'Rust Core (Native IPC + Local SQLite)',
                      title: '🦀 Rust + SQLite Native IPC',
                      subtitle: 'Tauri Native Storage',
                      desc: 'High-speed Rust database operations accessed via secure IPC from the desktop UI.',
                      icon: Cpu
                    },
                    {
                      id: 'Cloud Sync API (PostgreSQL + Supabase)',
                      title: '☁️ Cloud Sync (PostgreSQL)',
                      subtitle: 'Desktop + Cloud Backup',
                      desc: 'Local workstation cache that syncs seamlessly to a cloud PostgreSQL database.',
                      icon: Database
                    }
                  ];
                } else if (hasCLI) {
                  dynamicBackendOptions = [
                    {
                      id: 'auto',
                      title: '✨ Let AI Decide',
                      subtitle: 'CLI Storage Match',
                      desc: 'AI determines whether the tool needs embedded storage, configuration files, or a remote API.',
                      icon: Sparkles
                    },
                    {
                      id: 'Rust (Clap + SQLite / redb Embedded)',
                      title: '🦀 Rust + Embedded DB (redb / SQLite)',
                      subtitle: 'Single Native Binary',
                      desc: 'Embed high-speed key-value or SQL storage directly inside the compiled binary.',
                      icon: Cpu
                    },
                    {
                      id: 'Go (Cobra + BoltDB / SQLite)',
                      title: '🐹 Go + BoltDB / SQLite',
                      subtitle: 'Fast Local Storage',
                      desc: 'Pure Go embedded database with zero CGO dependencies for instant cross-compilation.',
                      icon: Code2
                    },
                    {
                      id: 'TypeScript (lowdb / conf / SQLite)',
                      title: '🟦 Node.js JSON / SQLite Config',
                      subtitle: 'File-Based Config Store',
                      desc: 'Standard developer configuration storage in user home directory (~/.config).',
                      icon: Code2
                    }
                  ];
                }

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dynamicBackendOptions.map((opt) => {
                        const isSelected = backendPreference === opt.id;
                        const Icon = opt.icon;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleUpdateBackend(opt.id)}
                            className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 cursor-pointer transition-all ${
                              isSelected
                                ? isDark
                                  ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/30 shadow-xs'
                                  : 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-500/20 shadow-xs'
                                : isDark
                                  ? 'bg-[#15161C] border-[#22242D] hover:border-[#323644]'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : isDark ? 'bg-[#1F212B] text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.title}</div>
                                  <div className={`text-[10px] font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{opt.subtitle}</div>
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : isDark ? 'border-[#333644]' : 'border-slate-300'}`}>
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </div>
                            </div>
                            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                              {opt.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Language & Database write-in */}
                    <div className="flex items-center space-x-2 pt-1">
                      <span className={`text-[11px] font-mono shrink-0 ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>Or custom language / DB:</span>
                      <input
                        type="text"
                        placeholder="e.g. Elixir + Phoenix LiveView + Postgres, C# .NET 9 + SQL Server, Rust + Axum + SurrealDB..."
                        value={['auto', 'Python (FastAPI / Django + PostgreSQL)', 'TypeScript / Node.js (Hono / Next.js / Prisma)', 'Go or Rust (Fiber / Axum / High Throughput)', 'Elixir (Phoenix LiveView) or Ruby on Rails', 'Supabase PostgreSQL (BaaS + Auth + Real-Time)', 'Python (FastAPI / asyncpg + PostgreSQL)', 'TypeScript / Node.js (Hono / Prisma + PostgreSQL)', 'Go (Fiber) or Rust (Axum) High-Speed API', 'Embedded SQLite / SurrealDB (Local Desktop DB)', 'TypeScript (Prisma ORM + SQLite Local File)', 'Rust Core (Native IPC + Local SQLite)', 'Cloud Sync API (PostgreSQL + Supabase)', 'Rust (Clap + SQLite / redb Embedded)', 'Go (Cobra + BoltDB / SQLite)', 'TypeScript (lowdb / conf / SQLite)'].includes(backendPreference) ? '' : backendPreference}
                        onChange={(e) => handleUpdateBackend(e.target.value || 'auto')}
                        className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                          isDark ? 'studio-input-dark' : 'studio-input-light'
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Wizard Bottom Controls */}
              <div className="flex items-center justify-between pt-4 border-t dark:border-[#1E2028] border-slate-200/80">
                <div className="flex items-center space-x-2">
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4)}
                      className={`text-xs px-3 py-2 rounded-lg border font-semibold transition-colors cursor-pointer ${
                        isDark ? 'border-[#2D303B] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Back
                    </button>
                  )}

                  {activeRecommendations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsWizardMode(false)}
                      className={`text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      View Current Recommendations
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep < 4) {
                        setWizardStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
                      } else {
                        handleAnalyzeStack();
                      }
                    }}
                    disabled={wizardStep === 4 && (isAnalyzingStack || !spec.description?.trim())}
                    className="btn-primary-blue disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
                  >
                    {isAnalyzingStack ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Tech Stacks...</span>
                      </>
                    ) : wizardStep < 4 ? (
                      <>
                        <span>Next Question</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Tailored Tech Stacks</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* If analyzing stack, show loading state */}
          {isAnalyzingStack && (
            <div className={`p-8 rounded-xl border border-dashed flex flex-col items-center justify-center space-y-3 ${
              isDark ? 'bg-[#121318]/50 border-blue-500/40 text-slate-300' : 'bg-blue-50/40 border-blue-200 text-slate-700'
            }`}>
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold">AI Software Architect is synthesizing your answers...</p>
                <p className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  Matching your architecture, styling, and backend preferences with the optimal framework ecosystem.
                </p>
              </div>
            </div>
          )}

          {/* Active Summary Pill Bar when Wizard is Closed */}
          {!isWizardMode && !isAnalyzingStack && activeRecommendations.length > 0 && (
            <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              isDark ? 'bg-[#101115] border-[#22242D]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center flex-wrap gap-2">
                <span className={`font-mono text-[10px] uppercase font-bold ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>Active Criteria:</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-medium border border-blue-500/20">
                  Arch: {architecturePreference === 'auto' ? 'AI Choice' : architecturePreference}
                </span>
                {targetPlatforms.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20">
                    Platforms: {targetPlatforms.length}
                  </span>
                )}
                {nfrPreferences.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                    Guardrails: {nfrPreferences.length}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">
                  Styling: {stylingPreference === 'auto' ? 'AI Choice' : stylingPreference}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                  Backend: {backendPreference === 'auto' ? 'AI Choice' : backendPreference}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDiagram(!showDiagram)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
                    showDiagram
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : isDark
                        ? 'border-[#2D303B] text-slate-400 hover:text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Network className="w-3.5 h-3.5 text-blue-500" />
                  <span>{showDiagram ? 'Hide Topology Diagram' : 'View Topology Diagram'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsWizardMode(true)}
                  className="text-xs text-blue-500 hover:underline font-semibold cursor-pointer"
                >
                  Change Answers
                </button>
              </div>
            </div>
          )}

          {/* Framework Cards Grid */}
          {!isWizardMode && !isAnalyzingStack && activeRecommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeRecommendations.map((fw, idx) => {
                const isSelected = !isCustomSelected && activeFrameworkId === fw.id;
                const isTopPick = idx === 0;
                const CatIcon = getCategoryIcon(fw.category);

                return (
                  <div
                    key={fw.id}
                    onClick={() => handleSelectFramework(fw)}
                    className={`relative rounded-xl border p-5 flex flex-col justify-between space-y-4 transition-all cursor-pointer ${
                      isSelected
                        ? isDark 
                          ? 'bg-[#151720] border-blue-500 ring-1 ring-blue-500/30 shadow-md' 
                          : 'bg-blue-50/60 border-blue-600 ring-1 ring-blue-500/20 shadow-sm'
                        : isDark
                          ? 'bg-[#101115] border-[#22242E] hover:border-[#323644]'
                          : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Badge & Category */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                            isDark ? 'bg-[#1B1D25] border-[#2C2F3C] text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                          }`}>
                            <CatIcon className="w-3 h-3 text-blue-500" />
                            <span>{fw.architecture || fw.category}</span>
                          </span>

                          {isTopPick && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center space-x-1">
                              <Star className="w-2.5 h-2.5 fill-amber-500" />
                              <span>Top Pick</span>
                            </span>
                          )}
                        </div>

                        <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : isDark ? 'border-[#333644]' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>

                      <div>
                        <h4 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {fw.name}
                        </h4>
                        <p className={`text-[11px] leading-relaxed mt-1 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                          {fw.description}
                        </p>
                      </div>

                      {/* Decomposed Stack Pills (Frontend, Backend, Styling, Database) */}
                      {(fw.frontendStack || fw.backendStack || fw.stylingStack || fw.databaseStack) && (
                        <div className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 mt-2 ${
                          isDark ? 'bg-[#0E0F14] border-[#1E2028]' : 'bg-white border-slate-200/70 shadow-2xs'
                        }`}>
                          {fw.frontendStack && (
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>Frontend:</span>
                              <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{fw.frontendStack}</span>
                            </div>
                          )}
                          {fw.backendStack && (
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>Backend:</span>
                              <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{fw.backendStack}</span>
                            </div>
                          )}
                          {fw.stylingStack && (
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>Styling:</span>
                              <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{fw.stylingStack}</span>
                            </div>
                          )}
                          {fw.databaseStack && (
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>Database:</span>
                              <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{fw.databaseStack}</span>
                            </div>
                          )}
                          {fw.deploymentTarget && (
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>Deploy:</span>
                              <span className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{fw.deploymentTarget}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Why this Framework Section */}
                    {fw.whyReasons && fw.whyReasons.length > 0 && (
                      <div className={`pt-3 border-t space-y-2 ${isDark ? 'border-[#1E2028]' : 'border-slate-200/80'}`}>
                        <div className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${
                          isDark ? 'text-blue-400' : 'text-blue-700'
                        }`}>
                          Why this is ideal for your app:
                        </div>

                        <ul className="space-y-1.5">
                          {fw.whyReasons.map((reason, rIdx) => (
                            <li key={rIdx} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Best For Tag */}
                    {fw.bestFor && (
                      <div className={`text-[10px] pt-2 border-t font-mono ${isDark ? 'border-[#1E2028] text-[#71727D]' : 'border-slate-200/80 text-slate-500'}`}>
                        Best for: {fw.bestFor}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Live System Architecture Diagram */}
          {!isWizardMode && !isAnalyzingStack && activeRecommendations.length > 0 && showDiagram && (() => {
            const activeRec = activeRecommendations.find(f => f.id === activeFrameworkId) || activeRecommendations[0];
            if (!activeRec) return null;
            return (
              <div className="pt-2">
                <SystemArchitectureDiagram
                  recommendation={activeRec}
                  isDark={isDark}
                  projectName={activeProject.name}
                />
              </div>
            );
          })()}

          {/* Custom Framework Option */}
          <div className={`pt-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isDark ? 'border-[#1E2028]' : 'border-slate-100'
          }`}>
            <div className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Prefer a different technology stack? Enter your preferred framework:
            </div>

            <form onSubmit={handleApplyCustomFramework} className="flex items-center space-x-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="e.g. SvelteKit, Django, Ruby on Rails, Go"
                value={customFramework}
                onChange={(e) => setCustomFramework(e.target.value)}
                className={`text-xs p-2 rounded-lg outline-none w-full sm:w-64 ${
                  isDark ? 'studio-input-dark' : 'studio-input-light'
                }`}
              />
              <button
                type="submit"
                disabled={!customFramework.trim()}
                className={`text-xs px-3 py-2 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
                  isDark 
                    ? 'border-[#2D303B] text-slate-300 hover:bg-white/[0.06] disabled:opacity-30' 
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30'
                }`}
              >
                Use Custom
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Synthesis Action Footer */}
        <div className={`p-5 rounded-xl border flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#141519] border-[#23252C]' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="space-y-0.5">
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Ready for the next step?
            </div>
            <div className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              {isCustomSelected && customFramework ? (
                <>Selected custom stack: <span className="font-semibold text-blue-500">{customFramework}</span>.</>
              ) : activeFrameworkId && activeRecommendations.find(f => f.id === activeFrameworkId) ? (
                <>Selected stack: <span className="font-semibold text-blue-500">{activeRecommendations.find(f => f.id === activeFrameworkId)?.name}</span>.</>
              ) : (
                <>Generate an AI-recommended tech stack above or choose a custom framework.</>
              )}{' '}
              Move to Step 2 to set up required data rules.
            </div>
          </div>

          <button
            onClick={onProceedToInvariants}
            className="btn-primary-blue px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <span>Continue to Step 2: Data & Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
