import React, { useState } from 'react';
import { 
  FileText, 
  ArrowRight, 
  CheckCircle, 
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
  HelpCircle,
  AlertCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { expandAndPolishDescription, analyzeFrameworksWithAI } from '../../services/aiService';
import { FrameworkRecommendation } from '../../types/project';

interface DomainIntentViewProps {
  onProceedToInvariants: () => void;
}

export const DomainIntentView: React.FC<DomainIntentViewProps> = ({ onProceedToInvariants }) => {
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();
  const { settings, isAiConfigured, setIsSettingsOpen } = useAI();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingStack, setIsAnalyzingStack] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  const [customFramework, setCustomFramework] = useState('');
  const [isCustomSelected, setIsCustomSelected] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<FrameworkRecommendation[] | null>(null);

  if (!activeProject) return null;

  const { spec } = activeProject;

  // Recommendations: only those generated for this project (stored in spec or state)
  const activeRecommendations: FrameworkRecommendation[] = aiRecommendations || spec.frameworkRecommendations || [];

  // Active framework selection
  const activeFrameworkId = spec.targetFramework || (activeRecommendations.length > 0 ? activeRecommendations[0].id : undefined);

  const showStatus = (text: string, type: 'success' | 'warning' | 'error' | 'info' = 'success', duration = 4500) => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg(curr => (curr?.text === text ? null : curr));
    }, duration);
  };

  const handleDescriptionChange = (desc: string) => {
    updateProjectSpec(activeProject.id, { description: desc });
  };

  const handleSelectFramework = (fw: FrameworkRecommendation) => {
    setIsCustomSelected(false);
    updateProjectSpec(activeProject.id, {
      targetFramework: fw.id,
      frameworkRecommendation: fw
    });
    showStatus(`Selected ${fw.name}`, 'success', 2500);
  };

  const handleApplyCustomFramework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFramework.trim()) return;

    const customRec: FrameworkRecommendation = {
      id: 'custom_' + Date.now(),
      name: customFramework.trim(),
      category: 'Full-Stack Web',
      description: 'Custom technology stack specified by user.',
      whyReasons: ['Custom tailored technology chosen for specific project requirements.'],
      bestFor: 'Custom architectural setups'
    };

    setIsCustomSelected(true);
    updateProjectSpec(activeProject.id, {
      targetFramework: customRec.id,
      frameworkRecommendation: customRec
    });

    showStatus(`Selected custom stack: ${customFramework.trim()}`, 'success', 2500);
  };

  const handleAutoGenerate = async () => {
    if (!spec.description?.trim() && !activeProject.name.trim()) {
      showStatus('Please enter a project name or brief description first.', 'warning', 3500);
      return;
    }

    setIsGenerating(true);
    setStatusMsg(null);

    try {
      const result = await expandAndPolishDescription(
        activeProject.name,
        spec.description || '',
        settings
      );

      // 1. Immediately apply the polished description so user sees it right away
      updateProjectSpec(activeProject.id, {
        description: result.text
      });

      // Stop section 1 loading state immediately
      setIsGenerating(false);

      if (result.error) {
        showStatus(result.error, 'warning', 6000);
      } else if (result.source === 'ai') {
        showStatus(`Description expanded & polished with ${result.providerName || 'AI'}.`, 'success', 4000);
      } else {
        showStatus('Description structured using local blueprint engine.', 'info', 4000);
      }

      // 2. Asynchronously analyze tailored tech stack for the new description with Section 2 spinner
      setIsAnalyzingStack(true);
      try {
        const stackResult = await analyzeFrameworksWithAI(activeProject.name, result.text, settings);
        const topChoice = stackResult.recommendations[0];

        setAiRecommendations(stackResult.recommendations);
        updateProjectSpec(activeProject.id, {
          description: result.text,
          frameworkRecommendations: stackResult.recommendations,
          targetFramework: topChoice?.id,
          frameworkRecommendation: topChoice
        });
      } catch (stackErr) {
        console.warn('Tech stack analysis failed during auto-generate:', stackErr);
      } finally {
        setIsAnalyzingStack(false);
      }
    } catch (err: any) {
      setIsGenerating(false);
      showStatus(err?.message || 'Failed to polish description. Check AI settings.', 'error', 5000);
    }
  };

  const handleAnalyzeStack = async () => {
    if (!spec.description?.trim()) {
      showStatus('Please enter what you are building first so AI can analyze the right stack.', 'warning', 3500);
      return;
    }

    setIsAnalyzingStack(true);
    setStatusMsg(null);

    try {
      const stackResult = await analyzeFrameworksWithAI(activeProject.name, spec.description || '', settings);
      setAiRecommendations(stackResult.recommendations);
      const topChoice = stackResult.recommendations[0];

      updateProjectSpec(activeProject.id, {
        frameworkRecommendations: stackResult.recommendations,
        targetFramework: topChoice?.id,
        frameworkRecommendation: topChoice
      });

      setIsAnalyzingStack(false);
      if (stackResult.source === 'ai') {
        showStatus(`AI generated custom stack recommendations with ${stackResult.providerName || 'AI'}.`, 'success', 4000);
      } else {
        showStatus('Tech stack analyzed for your project requirements.', 'info', 4000);
      }
    } catch (err: any) {
      setIsAnalyzingStack(false);
      showStatus(err?.message || 'Failed to analyze tech stack.', 'error', 4000);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Desktop App':
        return Server;
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
      {/* Top Header Bar */}
      <div className={`px-8 py-4 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#0E0F12]/90 border-[#23252C]' : 'bg-white/90 border-slate-200/60 shadow-2xs'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-wider">
              Step 1
            </span>
            <span className={`text-xs ${isDark ? 'text-[#5E606B]' : 'text-slate-300'}`}>/</span>
            <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Project Overview & Tech Stack
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {statusMsg && (
            <div className={`text-xs font-medium px-3 py-1 rounded-md border flex items-center space-x-1.5 animate-in fade-in ${
              statusMsg.type === 'error'
                ? isDark ? 'bg-rose-950/60 border-rose-500/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
                : statusMsg.type === 'warning'
                ? isDark ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                : statusMsg.type === 'info'
                ? isDark ? 'bg-blue-950/60 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                : isDark ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {statusMsg.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
              {statusMsg.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
              {statusMsg.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-500" />}
              {statusMsg.type === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <button
            onClick={onProceedToInvariants}
            className="btn-primary-blue px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <span>Next: Data & Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="p-8 space-y-7 w-full">
        
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

          <div className="relative">
            <textarea
              id="system-objective-input"
              rows={5}
              disabled={isGenerating}
              value={spec.description || ''}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Describe your app or idea (e.g. An e-commerce store where customers can browse items, add them to a cart, pay securely with Stripe, and receive email receipts with order tracking)..."
              className={`w-full text-xs leading-relaxed p-4 rounded-xl border outline-none resize-y transition-all font-sans ${
                isDark 
                  ? 'bg-[#101114] border-[#20222A] text-white placeholder-[#5E606B] focus:border-[#2E313D]' 
                  : 'bg-[#F8FAFC] border-slate-200/80 text-slate-900 placeholder-slate-400 focus:border-slate-300'
              } ${isGenerating ? 'opacity-25 blur-[1px]' : ''}`}
            />

            {/* In-place AI Generating / Polishing Loading Overlay */}
            {isGenerating && (
              <div className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center p-6 backdrop-blur-xs border transition-all animate-in fade-in duration-200 ${
                isDark 
                  ? 'bg-[#12141C]/85 border-blue-500/40 shadow-lg shadow-blue-500/5' 
                  : 'bg-white/85 border-blue-400 shadow-md'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="relative flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/30 animate-ping absolute" />
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                      <Sparkles className="w-4 h-4 animate-spin text-white" />
                    </div>
                  </div>
                  <div>
                    <h5 className={`text-xs font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span>Polishing & Architecting Specification...</span>
                    </h5>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-blue-300/80' : 'text-blue-700'}`}>
                      Structuring core proposition, user workflows, and reliability expectations
                    </p>
                  </div>
                </div>

                {/* Animated skeleton shimmer bars */}
                <div className="w-full max-w-md mt-4 space-y-2">
                  <div className={`h-2 rounded-full w-full animate-pulse ${isDark ? 'bg-blue-500/25' : 'bg-blue-200'}`} />
                  <div className={`h-2 rounded-full w-5/6 animate-pulse ${isDark ? 'bg-blue-500/20' : 'bg-blue-150'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`h-2 rounded-full w-3/5 animate-pulse ${isDark ? 'bg-blue-500/15' : 'bg-blue-100'}`} style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Inline alert if statusMsg is active */}
          {statusMsg && (
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 animate-in fade-in ${
              statusMsg.type === 'error'
                ? isDark ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                : statusMsg.type === 'warning'
                ? isDark ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                : statusMsg.type === 'info'
                ? isDark ? 'bg-blue-950/40 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
                : isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center space-x-2">
                {statusMsg.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                {statusMsg.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                {statusMsg.type === 'info' && <Info className="w-4 h-4 text-blue-500 shrink-0" />}
                {statusMsg.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                <span>{statusMsg.text}</span>
              </div>
              {(statusMsg.type === 'warning' || statusMsg.type === 'error') && (
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Configure AI Key
                </button>
              )}
            </div>
          )}

          {!isAiConfigured && !statusMsg && (
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
                {activeRecommendations.length > 0
                  ? 'AI-tailored recommendations based on what you are building.'
                  : 'AI analyzes what you are building above and recommends the ideal tech stack with specific reasons.'}
              </p>
            </div>

            {activeRecommendations.length > 0 && (
              <button
                onClick={handleAnalyzeStack}
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

          {/* If analyzing stack, show loading state */}
          {isAnalyzingStack && (
            <div className={`p-8 rounded-xl border border-dashed flex flex-col items-center justify-center space-y-3 ${
              isDark ? 'bg-[#121318]/50 border-blue-500/40 text-slate-300' : 'bg-blue-50/40 border-blue-200 text-slate-700'
            }`}>
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold">AI Software Architect is analyzing your requirements...</p>
                <p className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  Evaluating database needs, rendering strategies, auth, and runtime scalability.
                </p>
              </div>
            </div>
          )}

          {/* If no recommendations yet and not loading, show empty AI trigger card */}
          {!isAnalyzingStack && activeRecommendations.length === 0 && (
            <div className={`p-8 rounded-xl border border-dashed flex flex-col items-center justify-center text-center space-y-4 ${
              isDark ? 'bg-[#121318]/50 border-[#262833]' : 'bg-slate-50/70 border-slate-200'
            }`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs ${
                isDark ? 'bg-[#1A1C24] border-[#2A2E3B] text-blue-400' : 'bg-white border-slate-200 text-blue-600'
              }`}>
                <Cpu className="w-6 h-6" />
              </div>

              <div className="max-w-md space-y-1.5">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  No Tech Stack Generated Yet
                </h4>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  Describe what your app does in Section 1 above, then click below to generate an AI-tailored tech stack recommendation specifically designed for your system.
                </p>
              </div>

              <button
                onClick={handleAnalyzeStack}
                disabled={isAnalyzingStack || !spec.description?.trim()}
                className="btn-primary-blue disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-2 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Tech Stack with AI</span>
              </button>
            </div>
          )}

          {/* Framework Cards Grid */}
          {!isAnalyzingStack && activeRecommendations.length > 0 && (
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
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                            isDark ? 'bg-[#1B1D25] border-[#2C2F3C] text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                          }`}>
                            <CatIcon className="w-3 h-3 text-blue-500" />
                            <span>{fw.category}</span>
                          </span>

                          {isTopPick && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center space-x-1">
                              <Star className="w-2.5 h-2.5 fill-amber-500" />
                              <span>Top Pick</span>
                            </span>
                          )}
                        </div>

                        <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors ${
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
