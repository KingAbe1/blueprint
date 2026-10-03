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
  Database
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { useNotification } from '../../context/NotificationContext';
import { expandAndPolishDescription, analyzeFrameworksWithAI } from '../../services/aiService';
import { FrameworkRecommendation, ArchitecturePreference, StylingPreference, BackendPreference } from '../../types/project';

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

  // Recommendations: only those generated for this project (stored in spec or state)
  const activeRecommendations: FrameworkRecommendation[] = aiRecommendations || spec.frameworkRecommendations || [];

  // Active framework selection
  const activeFrameworkId = spec.targetFramework || (activeRecommendations.length > 0 ? activeRecommendations[0].id : undefined);

  // Guided Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [isWizardMode, setIsWizardMode] = useState<boolean>(activeRecommendations.length === 0);

  const handleDescriptionChange = (desc: string) => {
    updateProjectSpec(activeProject.id, { description: desc });
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
            backendPreference
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
          backendPreference: targetBackend
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
    switch (category) {
      case 'Desktop App':
        return Monitor;
      case 'Mobile App':
        return Smartphone;
      case 'Backend API':
        return Cpu;
      default:
        return Globe;
    }
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
                  ? 'Answer 3 quick questions to guide AI toward your preferred architecture, styling, and database.'
                  : 'AI-tailored recommendations based on your architectural model, styling preferences, and description.'}
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
                      Question {wizardStep} of 3
                    </span>
                    <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {wizardStep === 1 && 'Application Architecture & Platform'}
                      {wizardStep === 2 && 'User Interface & Styling System'}
                      {wizardStep === 3 && 'Backend Language & Database Ecosystem'}
                    </span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                    {wizardStep === 1 && 'Do you prefer an all-in-one full-stack framework or a decoupled frontend + dedicated backend API?'}
                    {wizardStep === 2 && 'How would you like to build your components, layouts, and design styles?'}
                    {wizardStep === 3 && 'Select your preferred language runtime or database model, or let AI analyze your needs.'}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-28 bg-slate-200 dark:bg-[#1D1F28] rounded-full h-1.5 overflow-hidden shrink-0">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(wizardStep / 3) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question 1: Architecture */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'auto',
                        title: '✨ Let AI Decide',
                        subtitle: 'Optimal Recommendation',
                        desc: 'AI examines your description and determines whether Full-Stack, Decoupled, Mobile, or Desktop is ideal.',
                        icon: Sparkles
                      },
                      {
                        id: 'Integrated Full-Stack',
                        title: '🌐 Integrated Full-Stack',
                        subtitle: 'Unified Monolith',
                        desc: 'Frontend & Backend in one codebase (Next.js, Django, SvelteKit, Nuxt). Fast shipping & unified types.',
                        icon: Combine
                      },
                      {
                        id: 'Separate (Frontend + Backend API)',
                        title: '⚡ Decoupled Stack',
                        subtitle: 'SPA Client + Standalone API',
                        desc: 'Dedicated Web Client (React/Vite/Vue) paired with an independent API (FastAPI, Go, Node.js, C#).',
                        icon: Split
                      },
                      {
                        id: 'Mobile Application',
                        title: '📱 Mobile Application',
                        subtitle: 'Cross-Platform iOS/Android',
                        desc: 'Native mobile app built with Expo / React Native or Flutter with full hardware access.',
                        icon: Smartphone
                      },
                      {
                        id: 'Desktop Native Software',
                        title: '🖥️ Native Desktop Software',
                        subtitle: 'macOS, Windows & Linux',
                        desc: 'High-performance local desktop app with tiny memory footprint (Tauri 2.0 / Rust / Electron).',
                        icon: Monitor
                      }
                    ].map((opt) => {
                      const isSelected = architecturePreference === opt.id;
                      const Icon = opt.icon;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleUpdateArchitecture(opt.id)}
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

                  {/* Custom Architecture write-in */}
                  <div className="flex items-center space-x-2 pt-1">
                    <span className={`text-[11px] font-mono shrink-0 ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>Or custom pattern:</span>
                    <input
                      type="text"
                      placeholder="e.g. Event-Driven Microservices with Kafka, Serverless Edge Workers, CLI Tool..."
                      value={['auto', 'Integrated Full-Stack', 'Separate (Frontend + Backend API)', 'Mobile Application', 'Desktop Native Software'].includes(architecturePreference) ? '' : architecturePreference}
                      onChange={(e) => handleUpdateArchitecture(e.target.value || 'auto')}
                      className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                        isDark ? 'studio-input-dark' : 'studio-input-light'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Question 2: Styling */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
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
                    ].map((opt) => {
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
                      placeholder="e.g. Styled Components, Emotion, Svelte Scoped CSS, Flutter Theme..."
                      value={['auto', 'Tailwind CSS v4', 'shadcn/ui + Tailwind CSS', 'Component Library (Mantine / Chakra / MUI)', 'Vanilla CSS / CSS Modules'].includes(stylingPreference) ? '' : stylingPreference}
                      onChange={(e) => handleUpdateStyling(e.target.value || 'auto')}
                      className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                        isDark ? 'studio-input-dark' : 'studio-input-light'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Question 3: Backend & Database */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
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
                    ].map((opt) => {
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
                      value={['auto', 'Python (FastAPI / Django + PostgreSQL)', 'TypeScript / Node.js (Hono / Next.js / Prisma)', 'Go or Rust (Fiber / Axum / High Throughput)', 'Elixir (Phoenix LiveView) or Ruby on Rails'].includes(backendPreference) ? '' : backendPreference}
                      onChange={(e) => handleUpdateBackend(e.target.value || 'auto')}
                      className={`text-xs p-2 rounded-lg outline-none flex-1 ${
                        isDark ? 'studio-input-dark' : 'studio-input-light'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Wizard Bottom Controls */}
              <div className="flex items-center justify-between pt-4 border-t dark:border-[#1E2028] border-slate-200/80">
                <div className="flex items-center space-x-2">
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3)}
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
                    onClick={() => handleAnalyzeStack()}
                    disabled={isAnalyzingStack || !spec.description?.trim()}
                    className="btn-primary-blue disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
                  >
                    {isAnalyzingStack ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Tech Stacks...</span>
                      </>
                    ) : wizardStep < 3 ? (
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

                  {wizardStep < 3 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep((prev) => Math.min(3, prev + 1) as 1 | 2 | 3)}
                      className={`text-xs px-3 py-2 rounded-lg border font-semibold transition-colors cursor-pointer ${
                        isDark ? 'border-[#2D303B] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Next
                    </button>
                  )}
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
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">
                  Styling: {stylingPreference === 'auto' ? 'AI Choice' : stylingPreference}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                  Backend: {backendPreference === 'auto' ? 'AI Choice' : backendPreference}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsWizardMode(true)}
                className="text-xs text-blue-500 hover:underline font-semibold cursor-pointer"
              >
                Change Answers
              </button>
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
