import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { useNotification } from '../../context/NotificationContext';
import {
  analyzeFrameworksWithAI,
  expandAndPolishDescription,
  generateArchitectureInterview,
  inferArchitectureFactsFromDescription,
} from '../../services/aiService';
import { recommendFrameworkFromText } from '../../services/frameworkRecommender';
import {
  ArchitectureAnswer,
  ArchitectureQuestion,
  ArchitectureTopology,
  ArchitecturalInterview,
  FrameworkRecommendation,
} from '../../types/project';

interface DomainIntentViewProps {
  onOpenArchitectureMap?: () => void;
}

const STARTER_IDEAS = [
  {
    label: 'SaaS product',
    text: 'A multi-tenant SaaS workspace with subscriptions, team roles, notifications, and an audit history.',
  },
  {
    label: 'Online store',
    text: 'An online store with product discovery, secure checkout, inventory tracking, and live order updates.',
  },
  {
    label: 'AI assistant',
    text: 'An AI assistant with streaming responses, document retrieval, tool use, and persistent conversation history.',
  },
];

const CATEGORY_LABELS: Record<ArchitectureQuestion['category'], string> = {
  product: 'Product scope',
  users: 'Users & workflows',
  platform: 'Target platform',
  approach: 'How choices are made',
  ui: 'User experience',
  access: 'Sign-in & access',
  frontend: 'App screens',
  topology: 'System shape',
  backend: 'Behind the scenes',
  api: 'Connections',
  data: 'Data & storage',
  realtime: 'Realtime & offline',
  integrations: 'Integrations',
  security: 'Security & privacy',
  compliance: 'Compliance',
  scale: 'Expected usage',
  reliability: 'Backups & recovery',
  deployment: 'Hosting & deployment',
  delivery: 'Releasing updates',
  testing: 'Quality checks',
  observability: 'Monitoring & alerts',
  operations: 'Team ownership',
  budget: 'Cost constraints',
};

const DECISION_GROUPS: Array<{
  title: string;
  description: string;
  categories: ArchitectureQuestion['category'][];
}> = [
  {
    title: 'Foundation',
    description: 'Scope, users, platform, and decision principles',
    categories: ['product', 'users', 'platform', 'approach'],
  },
  {
    title: 'Experience & access',
    description: 'Interface, identity, and client technology',
    categories: ['ui', 'access', 'frontend'],
  },
  {
    title: 'Services & data',
    description: 'Backend, APIs, storage, sync, and integrations',
    categories: ['topology', 'backend', 'api', 'data', 'realtime', 'integrations'],
  },
  {
    title: 'Trust & scale',
    description: 'Security, compliance, performance, and recovery',
    categories: ['security', 'compliance', 'scale', 'reliability'],
  },
  {
    title: 'Delivery & operations',
    description: 'Hosting, releases, quality, monitoring, and cost',
    categories: ['deployment', 'delivery', 'testing', 'observability', 'operations', 'budget'],
  },
];

function compactDecisionValues(values: string[]): string[] {
  return values.reduce<string[]>((result, value) => {
    const normalized = value.trim().toLowerCase();
    const overlappingIndex = result.findIndex(existing => {
      const existingNormalized = existing.trim().toLowerCase();
      return existingNormalized.includes(normalized) || normalized.includes(existingNormalized);
    });

    if (overlappingIndex === -1) return [...result, value];
    if (value.length > result[overlappingIndex].length) {
      return result.map((existing, index) => index === overlappingIndex ? value : existing);
    }
    return result;
  }, []);
}

const TOPOLOGY_LABELS: Record<ArchitectureTopology, string> = {
  modular_monolith: 'Modular monolith',
  microservices: 'Independent microservices',
  serverless: 'Managed serverless functions',
  event_driven: 'Event-driven system',
  hybrid: 'Hybrid core and services',
};

function topologyFromText(value?: string): ArchitectureTopology | undefined {
  const normalized = (value || '').toLowerCase();
  if (/independent_areas|microservice|separate services|independent services/.test(normalized)) return 'microservices';
  if (/uneven_bursts|serverless|functions on demand/.test(normalized)) return 'serverless';
  if (/background_work|event[- ]driven|asynchronous events/.test(normalized)) return 'event_driven';
  if (/mixed|hybrid|simple core/.test(normalized)) return 'hybrid';
  if (/one_team|modular monolith|single deployable|release them together/.test(normalized)) return 'modular_monolith';
  return undefined;
}

function inferSystemModules(description: string): string[] {
  const text = description.toLowerCase();
  if (/store|commerce|checkout|payment|order|inventory|catalog/.test(text)) {
    return ['Accounts & access', 'Catalog', 'Cart & checkout', 'Orders & inventory', 'Payments', 'Notifications'];
  }
  if (/saas|workspace|subscription|team|organization/.test(text)) {
    return ['Accounts & access', 'Workspaces', 'Membership & roles', 'Billing', 'Notifications', 'Administration'];
  }
  if (/\bai\b|assistant|llm|retrieval|chat/.test(text)) {
    return ['Accounts & access', 'Conversations', 'Knowledge & retrieval', 'Model gateway', 'Usage & limits', 'Administration'];
  }
  return ['Accounts & access', 'Core product', 'Notifications', 'Administration'];
}

function applyInterviewTopology(
  recommendation: FrameworkRecommendation,
  completedInterview: ArchitecturalInterview,
  description: string,
): FrameworkRecommendation {
  const topologyQuestion = completedInterview.questions.find(question => question.category === 'topology');
  const topologyAnswer = topologyQuestion
    ? completedInterview.answers.find(answer => answer.questionId === topologyQuestion.id)
    : undefined;
  const topologyFact = completedInterview.inferredFacts?.find(fact => fact.category === 'topology');
  const topology = topologyFromText(`${topologyAnswer?.optionId || ''} ${topologyAnswer?.label || ''} ${topologyFact?.value || ''}`)
    || recommendation.topology
    || topologyFromText(`${recommendation.architecture || ''} ${recommendation.category || ''}`)
    || 'modular_monolith';
  const rationale: Record<ArchitectureTopology, string> = {
    modular_monolith: 'One deployable application with clear internal modules keeps delivery fast while preserving clean boundaries for future growth.',
    microservices: 'Independent services allow separately owned areas to be released, scaled, and recovered without moving the whole system together.',
    serverless: 'Managed functions reduce operational work and scale individual workloads automatically when demand changes.',
    event_driven: 'Events keep long-running and background workflows resilient without making users wait for every step to finish.',
    hybrid: 'A simple core keeps most development coordinated while selected high-risk or high-scale capabilities remain independent.',
  };

  return {
    ...recommendation,
    topology,
    architecture: TOPOLOGY_LABELS[topology],
    topologyRationale: recommendation.topologyRationale || rationale[topology],
    systemModules: recommendation.systemModules?.length
      ? recommendation.systemModules.slice(0, 8)
      : inferSystemModules(description),
  };
}

export const DomainIntentView: React.FC<DomainIntentViewProps> = ({ onOpenArchitectureMap }) => {
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();
  const { settings, isAiConfigured, setIsSettingsOpen } = useAI();
  const { notify } = useNotification();

  const [isPolishing, setIsPolishing] = useState(false);
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [interviewBeforeEdit, setInterviewBeforeEdit] = useState<ArchitecturalInterview | null>(null);
  const [isProductBriefExpanded, setIsProductBriefExpanded] = useState(false);

  if (!activeProject) return null;

  const { spec } = activeProject;
  const interview = spec.interview;
  const selectedFramework = spec.frameworkRecommendation || spec.frameworkRecommendations?.[0];
  const currentQuestion = interview?.status === 'in_progress'
    ? interview.questions[interview.currentQuestionIndex]
    : undefined;
  const currentAnswer = currentQuestion
    ? interview?.answers.find(answer => answer.questionId === currentQuestion.id)
    : undefined;

  const wordCount = useMemo(
    () => (spec.description || '').trim().split(/\s+/).filter(Boolean).length,
    [spec.description],
  );

  useEffect(() => {
    setSelectedOptionId(currentAnswer?.optionId || '');
    setCustomAnswer(currentAnswer?.optionId ? '' : currentAnswer?.value || '');
  }, [currentQuestion?.id, currentAnswer?.optionId, currentAnswer?.value]);

  const surface = isDark ? 'bg-[#141518] border-white/[0.08]' : 'bg-white border-slate-200';
  const muted = isDark ? 'text-[#92949C]' : 'text-slate-500';
  const subtleButton = isDark
    ? 'border-white/[0.09] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900';
  const input = isDark
    ? 'bg-[#0F1012] border-white/[0.09] text-white placeholder:text-[#5F6169] focus:border-blue-500/70'
    : 'bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500';

  const updateSpec = (updates: Parameters<typeof updateProjectSpec>[1]) => {
    updateProjectSpec(activeProject.id, updates);
  };

  const handlePolish = async () => {
    if (!spec.description?.trim()) {
      notify.warning('Add a short description first.');
      return;
    }
    if (!isAiConfigured) {
      setIsSettingsOpen(true);
      return;
    }

    setIsPolishing(true);
    try {
      const result = await expandAndPolishDescription(activeProject.name, spec.description, settings);
      updateSpec({ description: result.text });
      notify.success(`Polished with ${result.providerName}.`);
    } catch (error: any) {
      notify.error(error?.message || 'Could not polish the description.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleEditProduct = () => {
    const shouldReset = window.confirm('Editing the product description will reset the current architecture interview so the blueprint stays consistent. Continue?');
    if (!shouldReset) return;
    setIsProductBriefExpanded(false);
    setInterviewBeforeEdit(null);
    updateSpec({
      interview: undefined,
      frameworkRecommendations: [],
      targetFramework: undefined,
      frameworkRecommendation: undefined,
      customRequirements: undefined,
    });
  };

  const startInterview = async (useStarterQuestions = false) => {
    if (!spec.description?.trim()) {
      notify.warning('Describe the product before designing its architecture.');
      return;
    }

    if (!isAiConfigured && !useStarterQuestions) {
      setIsSettingsOpen(true);
      return;
    }

    const completedInterview = interview?.status === 'completed' ? interview : null;
    setInterviewBeforeEdit(completedInterview);
    setIsGeneratingInterview(true);
    try {
      const result = useStarterQuestions
        ? { ...buildStarterQuestions(spec.description), providerName: 'Blueprint starter interview' }
        : await generateArchitectureInterview(activeProject.name, spec.description, settings);

      const nextInterview: ArchitecturalInterview = {
        status: 'in_progress',
        currentQuestionIndex: 0,
        totalEstimatedQuestions: result.questions.length,
        questions: result.questions,
        answers: [],
        inferredFacts: result.inferredFacts,
        providerName: result.providerName,
      };

      updateSpec({
        interview: nextInterview,
      });
    } catch (error: any) {
      setInterviewBeforeEdit(null);
      notify.error(error?.message || 'Could not generate the architecture interview.');
    } finally {
      setIsGeneratingInterview(false);
    }
  };

  const buildAnswerBrief = (completedInterview: ArchitecturalInterview) => {
    const facts = (completedInterview.inferredFacts || []).map(fact =>
      `${CATEGORY_LABELS[fact.category]} — Already specified in description\nDecision: ${fact.value}`
    );
    const answers = completedInterview.questions.map(question => {
      const answer = completedInterview.answers.find(item => item.questionId === question.id);
      return `${CATEGORY_LABELS[question.category]} — ${question.question}\nAnswer: ${answer?.label || 'No preference'}`;
    });
    return [...facts, ...answers].join('\n\n');
  };

  const generateStackRecommendations = async (completedInterview: ArchitecturalInterview) => {
    setIsAnalyzing(true);
    try {
      const answerBrief = buildAnswerBrief(completedInterview);
      let nextRecommendations: FrameworkRecommendation[];
      let providerName = 'Blueprint guidance';

      if (isAiConfigured) {
        const result = await analyzeFrameworksWithAI(activeProject.name, spec.description, settings, {
          customRequirements: `Architecture interview decisions:\n${answerBrief}`,
        });
        nextRecommendations = result.recommendations;
        providerName = result.providerName;
      } else {
        nextRecommendations = recommendFrameworkFromText(activeProject.name, `${spec.description}\n${answerBrief}`);
      }

      const recommendation = nextRecommendations[0];
      if (!recommendation) throw new Error('Blueprint could not create a final architecture from these answers.');
      const first = applyInterviewTopology(recommendation, completedInterview, spec.description);
      updateSpec({
        frameworkRecommendations: [first],
        targetFramework: first.id,
        frameworkRecommendation: first,
        customRequirements: answerBrief,
      });
      notify.success(`Final architecture prepared with ${providerName}.`);
    } catch (error: any) {
      notify.error(error?.message || 'Could not generate stack recommendations.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveCurrentAnswer = async () => {
    if (!interview || !currentQuestion) return;

    const option = currentQuestion.options.find(item => item.id === selectedOptionId);
    const typedAnswer = customAnswer.trim();
    if (!option && !typedAnswer) {
      notify.warning('Choose an option or enter your own answer.');
      return;
    }

    const answer: ArchitectureAnswer = {
      questionId: currentQuestion.id,
      optionId: option?.id,
      value: option?.id || typedAnswer,
      label: option?.label || typedAnswer,
    };
    const answers = [
      ...interview.answers.filter(item => item.questionId !== currentQuestion.id),
      answer,
    ];
    const isLastQuestion = interview.currentQuestionIndex >= interview.questions.length - 1;

    if (isLastQuestion) {
      const completedInterview: ArchitecturalInterview = {
        ...interview,
        status: 'completed',
        answers,
        summaryInsights: interview.questions.map(question => {
          const savedAnswer = answers.find(item => item.questionId === question.id);
          return `${CATEGORY_LABELS[question.category]}: ${savedAnswer?.label || 'No preference'}`;
        }),
      };
      updateSpec({
        interview: completedInterview,
        frameworkRecommendations: [],
        targetFramework: undefined,
        frameworkRecommendation: undefined,
      });
      setInterviewBeforeEdit(null);
      await generateStackRecommendations(completedInterview);
      return;
    }

    updateSpec({
      interview: {
        ...interview,
        answers,
        currentQuestionIndex: interview.currentQuestionIndex + 1,
      },
    });
  };

  const goBack = () => {
    if (!interview || interview.currentQuestionIndex === 0) return;
    updateSpec({
      interview: {
        ...interview,
        currentQuestionIndex: interview.currentQuestionIndex - 1,
      },
    });
  };

  const editInterview = () => {
    if (!interview) return;
    setInterviewBeforeEdit(interview);
    updateSpec({
      interview: {
        ...interview,
        status: 'in_progress',
        currentQuestionIndex: 0,
      },
    });
  };

  const exitInterview = () => {
    if (interviewBeforeEdit) {
      updateSpec({ interview: interviewBeforeEdit });
      setInterviewBeforeEdit(null);
    } else if (interview && selectedFramework && interview.answers.length === interview.questions.length) {
      updateSpec({ interview: { ...interview, status: 'completed' } });
    } else {
      updateSpec({ interview: undefined });
    }
    setSelectedOptionId('');
    setCustomAnswer('');
  };

  const interviewStatus = !interview
    ? 'Architecture not started'
    : interview.status === 'in_progress'
      ? `Architecture ${interview.currentQuestionIndex + 1}/${interview.questions.length}`
      : 'Finalizing architecture';

  const decisionItems = interview?.status === 'completed'
    ? [
        ...(interview.inferredFacts || []).map(fact => ({
          key: `fact-${fact.category}-${fact.value}`,
          category: fact.category,
          value: fact.value,
          fromDescription: true,
        })),
        ...interview.questions.map(question => {
          const answer = interview.answers.find(item => item.questionId === question.id);
          return {
            key: question.id,
            category: question.category,
            value: answer?.label || 'No preference',
            fromDescription: false,
          };
        }),
      ]
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-5 py-7 sm:px-6 lg:px-10 lg:py-8 xl:px-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className={`mb-2 text-xs font-medium ${muted}`}>Project foundation</div>
            <h1 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
              Define your product blueprint
            </h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>
              Describe the idea and make its key design decisions. Explore the finished system in the Architecture map.
            </p>
          </div>
          {!selectedFramework && (
            <div className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              {interviewStatus}
            </div>
          )}
        </div>

        <section id="product-section" className={`scroll-mt-6 rounded-2xl border p-5 sm:p-6 ${surface}`}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${
                isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {interview?.status === 'completed' ? '1. Product brief' : '1. What are you building?'}
                </h2>
                <p className={`mt-1 text-xs leading-5 ${muted}`}>
                  {interview?.status === 'completed'
                    ? 'The product context used to create this architecture.'
                    : 'Describe the goal, users, and core capabilities.'}
                </p>
              </div>
            </div>
            {interview?.status === 'completed' ? (
              <button
                type="button"
                onClick={handleEditProduct}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${subtleButton}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit product
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePolish}
                disabled={isPolishing}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${subtleButton}`}
              >
                {isPolishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isAiConfigured ? 'Polish with AI' : 'Connect AI to polish'}</span>
                <span className="sm:hidden">Polish</span>
              </button>
            )}
          </div>

          {interview?.status === 'completed' ? (
            <div className={`overflow-hidden rounded-xl ${isDark ? 'bg-white/[0.025]' : 'bg-slate-50/70'}`}>
              <div className="relative">
                <div
                  className={`whitespace-pre-wrap px-4 py-4 text-sm leading-7 ${isDark ? 'text-slate-200' : 'text-slate-700'} ${
                    isProductBriefExpanded ? '' : 'max-h-56 overflow-hidden'
                  }`}
                >
                  {spec.description}
                </div>
                {!isProductBriefExpanded && wordCount > 90 && (
                  <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t ${
                    isDark ? 'from-[#101113] to-transparent' : 'from-slate-50 to-transparent'
                  }`} />
                )}
              </div>
              <div className={`flex items-center justify-between gap-3 border-t px-4 py-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
                <span className={`text-xs ${muted}`}>{wordCount} words</span>
                {wordCount > 90 && (
                  <button
                    type="button"
                    onClick={() => setIsProductBriefExpanded(value => !value)}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
                    }`}
                  >
                    {isProductBriefExpanded ? 'Show less' : 'Show full brief'}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isProductBriefExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <textarea
              value={spec.description || ''}
              onChange={event => updateSpec({ description: event.target.value })}
              rows={7}
              placeholder="For example: A workspace where small teams plan projects, assign tasks, and keep a searchable record of decisions."
              className={`w-full resize-y rounded-xl border p-4 text-sm leading-6 outline-none transition-colors ${input}`}
            />
          )}

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {interview?.status !== 'completed' && (
              <div className="flex flex-wrap gap-2">
                {STARTER_IDEAS.map(idea => (
                  <button
                    key={idea.label}
                    type="button"
                    onClick={() => updateSpec({ description: idea.text })}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${subtleButton}`}
                  >
                    {idea.label}
                  </button>
                ))}
              </div>
            )}
            {interview?.status !== 'completed' && (
              <span className={`shrink-0 text-xs ${muted}`}>{wordCount} words</span>
            )}
          </div>
        </section>

        <section id="architecture-section" className={`mt-5 scroll-mt-6 rounded-2xl border p-5 sm:p-6 ${surface}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${
                isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600'
              }`}>
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>2. Design the architecture</h2>
                  {interview?.status === 'completed' && (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                      Complete · {decisionItems.length} decisions
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-xs leading-5 ${muted}`}>Make the decisions that will guide the implementation agent.</p>
              </div>
            </div>
            {interview?.status === 'completed' && (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button type="button" onClick={editInterview} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${subtleButton}`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit answers
                </button>
                <button
                  type="button"
                  onClick={() => startInterview(!isAiConfigured)}
                  disabled={isGeneratingInterview}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${subtleButton}`}
                >
                  {isGeneratingInterview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Rebuild interview
                </button>
              </div>
            )}
          </div>

          {!interview && (
            <div className={`mt-5 rounded-xl border p-5 ${isDark ? 'border-white/[0.07] bg-black/10' : 'border-slate-200 bg-slate-50/60'}`}>
              <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Build a complete implementation blueprint</h3>
                  <p className={`mt-2 max-w-2xl text-xs leading-5 ${muted}`}>
                    Answer in plain language about how the product should work. Blueprint translates those choices into the technical architecture and constraints for the coding agent.
                  </p>
                  <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${muted}`}>
                    <span>Skips known answers</span>
                    <span>No architecture knowledge required</span>
                    <span>Full lifecycle coverage</span>
                    <span>One final architecture</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => startInterview(false)}
                    disabled={isGeneratingInterview || !spec.description?.trim()}
                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isGeneratingInterview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isGeneratingInterview ? 'Preparing questions…' : isAiConfigured ? 'Generate tailored interview' : 'Connect AI to generate'}
                  </button>
                  {!isAiConfigured && (
                    <button
                      type="button"
                      onClick={() => startInterview(true)}
                      disabled={isGeneratingInterview || !spec.description?.trim()}
                      className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${subtleButton}`}
                    >
                      Preview starter interview
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {interview?.status === 'in_progress' && currentQuestion && (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className={`text-[11px] ${muted}`}>Questions from {interview.providerName || 'Blueprint'}</span>
                <button type="button" onClick={exitInterview} className={`text-[11px] font-medium transition-colors ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                  {interviewBeforeEdit ? 'Cancel editing' : 'Exit interview'}
                </button>
              </div>
              {(interview.inferredFacts || []).length > 0 && (
                <div className={`mb-5 rounded-xl border px-4 py-3 ${isDark ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-emerald-100 bg-emerald-50/60'}`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Already understood from your description</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(interview.inferredFacts || []).map(fact => (
                      <span key={`${fact.category}-${fact.value}`} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white text-emerald-800'}`}>
                        {CATEGORY_LABELS[fact.category]}: {fact.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className={`mb-5 h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`}>
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                  style={{ width: `${((interview.currentQuestionIndex + 1) / interview.questions.length) * 100}%` }}
                />
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                      <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {CATEGORY_LABELS[currentQuestion.category]}
                  </span>
                  <span className={`text-[10px] ${muted}`}>Question {interview.currentQuestionIndex + 1} of {interview.questions.length}</span>
                </div>
                <h3 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>{currentQuestion.question}</h3>
                {currentQuestion.context && <p className={`mt-2 text-sm leading-6 ${muted}`}>{currentQuestion.context}</p>}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {currentQuestion.options.map(option => {
                  const selected = selectedOptionId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedOptionId(option.id);
                        setCustomAnswer('');
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selected
                          ? isDark ? 'border-blue-500/70 bg-blue-500/[0.08]' : 'border-blue-400 bg-blue-50/70'
                          : isDark ? 'border-white/[0.08] hover:border-white/[0.16]' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-blue-500 bg-blue-500 text-white' : isDark ? 'border-white/20' : 'border-slate-300'
                        }`}>
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{option.label}</span>
                            {option.recommended && (
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                              }`}>Recommended</span>
                            )}
                          </div>
                          {option.description && <p className={`mt-1 text-xs leading-5 ${muted}`}>{option.description}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentQuestion.allowCustom !== false && (
                <input
                  value={customAnswer}
                  onChange={event => {
                    setCustomAnswer(event.target.value);
                    if (event.target.value) setSelectedOptionId('');
                  }}
                  placeholder="Or enter a different preference"
                  className={`mt-3 w-full rounded-lg border px-3 py-2.5 text-xs outline-none ${input}`}
                />
              )}

              <div className="mt-5 flex items-center justify-between border-t pt-4 dark:border-white/[0.07] border-slate-200">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={interview.currentQuestionIndex === 0}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:invisible ${subtleButton}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={saveCurrentAnswer}
                  disabled={!selectedOptionId && !customAnswer.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {interview.currentQuestionIndex === interview.questions.length - 1 ? 'Build final architecture' : 'Continue'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {interview?.status === 'completed' && (
            <div className="mt-5">
              {isAnalyzing && !selectedFramework ? (
                <div className={`mt-5 rounded-2xl border border-dashed px-5 py-9 text-center ${isDark ? 'border-white/[0.1]' : 'border-slate-200'}`}>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-500" />
                  <p className={`mt-3 text-xs ${muted}`}>Turning your decisions into one implementation-ready architecture…</p>
                </div>
              ) : selectedFramework ? (
                <div className={`mt-5 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Architecture map ready</p>
                      <h3 className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>{selectedFramework.name}</h3>
                      <p className={`mt-1 text-xs leading-5 ${muted}`}>Explore the interactive system map, deployment path, and how the product components connect.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenArchitectureMap}
                    disabled={!onOpenArchitectureMap}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    Open architecture map
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className={`mt-5 rounded-xl border border-dashed px-5 py-7 text-center ${isDark ? 'border-white/[0.1]' : 'border-slate-200'}`}>
                  <p className={`text-xs ${muted}`}>The final architecture could not be prepared.</p>
                  <button type="button" onClick={() => generateStackRecommendations(interview)} className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${subtleButton}`}>
                    Try again
                  </button>
                </div>
              )}

              <details className={`group mt-5 overflow-hidden rounded-xl border ${isDark ? 'border-white/[0.07] bg-black/10' : 'border-slate-200 bg-slate-50/50'}`}>
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100/70'}`}>
                  <div>
                    <h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Decision details</h3>
                    <p className={`mt-0.5 text-[10px] ${muted}`}>Review the choices and constraints behind this architecture.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-[10px] font-medium ${muted}`}>{decisionItems.length} decisions</span>
                    <ChevronDown className={`h-4 w-4 transition-transform group-open:rotate-180 ${muted}`} />
                  </div>
                </summary>

                <div className={`grid gap-3 border-t p-3 lg:grid-cols-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  {DECISION_GROUPS.map(group => {
                    const rows = group.categories.map(category => {
                      const matches = decisionItems.filter(item => item.category === category);
                      return {
                        category,
                        values: compactDecisionValues(matches.map(item => item.value)),
                        fromDescription: matches.some(item => item.fromDescription),
                      };
                    }).filter(row => row.values.length > 0);

                    if (rows.length === 0) return null;

                    return (
                      <div key={group.title} className={`overflow-hidden rounded-xl border ${isDark ? 'border-white/[0.07] bg-[#141518]' : 'border-slate-200 bg-white'}`}>
                        <div className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                          <div>
                            <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{group.title}</h4>
                            <p className={`mt-0.5 text-[10px] ${muted}`}>{group.description}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>{rows.length}</span>
                        </div>
                        <div className={`divide-y ${isDark ? 'divide-white/[0.05]' : 'divide-slate-200'}`}>
                          {rows.map(row => (
                            <div key={row.category} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
                              <div className="flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.fromDescription ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                <span className={`text-[9px] font-semibold uppercase tracking-[0.11em] ${muted}`}>{CATEGORY_LABELS[row.category]}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-medium leading-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.values.join(' · ')}</span>
                                {row.fromDescription && (
                                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>From description</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </section>

        {!(interview?.status === 'completed' && selectedFramework) && <div className={`mt-7 flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
          interview?.status === 'completed' && selectedFramework
            ? isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50/60'
            : isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200 bg-white'
        }`}>
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {interview?.status === 'completed' && selectedFramework ? 'Blueprint complete' : 'Complete the architecture interview'}
            </p>
            <p className={`mt-1 text-xs leading-5 ${muted}`}>
              {interview?.status === 'completed' && selectedFramework
                ? 'Your product brief and architecture decisions are complete. Explore the system map next, then prepare the build handoff.'
                : 'Your architecture map will be ready once the important product decisions are complete.'}
          </p>
        </div>
        </div>}
      </div>
    </div>
  );
};

function buildStarterQuestions(description: string): { questions: ArchitectureQuestion[]; inferredFacts: ReturnType<typeof inferArchitectureFactsFromDescription> } {
  const text = description.toLowerCase();
  const mobileFirst = /mobile|ios|android|phone|tablet/.test(text);
  const desktopFirst = /desktop|macos|windows|workstation|offline/.test(text);
  const realtime = /real.?time|chat|live|collaborat|notification/.test(text);
  const commerce = /store|commerce|checkout|payment|order|inventory|product catalog/.test(text);
  const sensitiveData = /health|medical|finance|bank|payment|children|student|government|identity/.test(text);
  const inferredFacts = inferArchitectureFactsFromDescription(description);
  const knownCategories = new Set(inferredFacts.map(fact => fact.category));

  const questions: ArchitectureQuestion[] = [
    {
      id: 'product_release_scope',
      category: 'product',
      question: 'What should the first production release optimize for?',
      context: 'A clear release boundary prevents the initial build from carrying every future requirement at once.',
      allowCustom: true,
      options: [
        { id: 'focused_mvp', label: 'Focused MVP', description: 'Ship only the smallest complete user journey and validate it quickly.', recommended: true },
        { id: 'market_ready', label: 'Market-ready launch', description: 'Include polished onboarding, support, analytics, and operational tooling.' },
        { id: 'enterprise_ready', label: 'Enterprise-ready launch', description: 'Include advanced controls, auditability, and administrative workflows from day one.' },
        { id: 'prototype', label: 'Prototype first', description: 'Prove the experience before investing in production infrastructure.' },
      ],
    },
    {
      id: 'primary_users_roles',
      category: 'users',
      question: 'Which user and operator roles must the first release support?',
      context: 'Roles determine navigation, permissions, administration, and the workflows that need end-to-end coverage.',
      allowCustom: true,
      options: [
        { id: 'customers_admins', label: commerce ? 'Customers and store administrators' : 'End users and administrators', description: 'Separate the customer experience from protected operational controls.', recommended: true },
        { id: 'single_role', label: 'One user role initially', description: 'Keep authorization and interface complexity low for the first release.' },
        { id: 'multi_role', label: 'Several business roles', description: 'Model role-specific workflows and permissions from the beginning.' },
        { id: 'organizations', label: 'Organizations and teams', description: 'Support tenant membership, owners, managers, and collaborators.' },
      ],
    },
    {
      id: 'platform',
      category: 'platform',
      question: 'Where should people use this product?',
      context: 'The target platform determines whether the implementation should use browser, native, or cross-platform tooling.',
      allowCustom: true,
      options: [
        { id: 'web', label: 'Web application', description: 'Runs in a browser and is straightforward to deploy broadly.', recommended: !mobileFirst && !desktopFirst },
        { id: 'mobile', label: 'iOS and Android', description: 'A touch-first app distributed through mobile app stores.', recommended: mobileFirst },
        { id: 'desktop', label: 'Desktop application', description: 'A native-feeling install for macOS, Windows, or Linux.', recommended: desktopFirst },
        { id: 'web_mobile', label: 'Web and mobile', description: 'Shared product capabilities across browser and mobile clients.' },
      ],
    },
    {
      id: 'approach',
      category: 'approach',
      question: 'How should the technology stack be chosen?',
      context: 'Blueprint can choose the best fit, or use tools your team already knows.',
      allowCustom: true,
      options: [
        { id: 'ai_decides', label: 'Let Blueprint choose the best fit', description: 'Choose tools from the product’s needs without assuming technical knowledge.', recommended: true },
        { id: 'familiar', label: 'Use familiar, popular tools', description: 'Favor tools that are easier to learn, hire for, and find help with.' },
        { id: 'single_language', label: 'Keep the codebase consistent', description: 'Prefer one main programming language across the product.' },
        { id: 'maximum_control', label: 'Prioritize speed and control', description: 'Accept more complexity when the product needs stronger performance.' },
      ],
    },
    {
      id: 'ui',
      category: 'ui',
      question: 'How should the product feel to people using it?',
      context: 'Choose the experience that matters most; Blueprint will select the appropriate interface tools.',
      allowCustom: true,
      options: [
        { id: 'design_system', label: 'Familiar, clean, and accessible', description: 'Use established patterns so people can learn the product quickly.', recommended: !mobileFirst },
        { id: 'native', label: 'Feels natural on each device', description: 'Follow the controls and behavior people expect on iPhone and Android.', recommended: mobileFirst },
        { id: 'cross_platform', label: 'Consistent across every platform', description: 'Keep the experience and features closely matched everywhere.' },
        { id: 'custom', label: 'Distinctive branded experience', description: 'Prioritize a unique visual identity over familiar defaults.' },
      ],
    },
    {
      id: 'identity_access',
      category: 'access',
      question: 'How should users sign in and gain access?',
      context: 'Identity choices affect onboarding, account recovery, authorization, and security controls.',
      allowCustom: true,
      options: [
        { id: 'email_social', label: 'Email plus social sign-in', description: 'Offer familiar consumer onboarding with account recovery.', recommended: !sensitiveData },
        { id: 'passwordless', label: 'Passwordless sign-in', description: 'Use magic links or one-time codes to reduce password friction.', recommended: sensitiveData },
        { id: 'enterprise_sso', label: 'Company-managed sign-in', description: 'Let a customer’s workplace control who can sign in and remove access.' },
        { id: 'guest_accounts', label: 'Guest-first with optional account', description: 'Allow limited use before asking the user to register.' },
        { id: 'ai_access', label: 'Let AI design access', description: 'Choose the safest low-friction model for the described users.' },
      ],
    },
    {
      id: 'frontend',
      category: 'frontend',
      question: 'Do you want to choose the technology used to build the app screens?',
      context: 'You can name something your team knows, or let Blueprint choose from the product and platform requirements.',
      allowCustom: true,
      options: [
        { id: 'ai_frontend', label: 'Let Blueprint decide', description: 'Choose the best screen technology after considering all your answers.', recommended: true },
        { id: 'react', label: mobileFirst ? 'Use React Native / Expo' : 'Use React / Next.js', description: 'Choose this if your team already works comfortably with JavaScript or TypeScript.' },
        { id: 'vue', label: 'Use Vue / Nuxt', description: 'Choose this if your team already prefers the Vue ecosystem.' },
        { id: 'native_frontend', label: 'Build separately for each device', description: 'Use Apple and Android’s own tools for the deepest device integration.' },
      ],
    },
    {
      id: 'backend',
      category: 'backend',
      question: 'Do you want to choose the technology that runs behind the scenes?',
      context: 'This powers business rules, scheduled work, payments, notifications, and connections to other services.',
      allowCustom: true,
      options: [
        { id: 'ai_backend', label: 'Let Blueprint decide', description: 'Choose the best server technology from the workflows, scale, and team size.', recommended: true },
        { id: 'typescript', label: 'Use TypeScript / Node.js', description: 'A familiar option when the team also uses JavaScript for the app screens.' },
        { id: 'python', label: 'Use Python', description: 'A practical choice for artificial intelligence and data-heavy features.' },
        { id: 'managed', label: 'Use a managed backend', description: 'Let a provider handle common server features and reduce maintenance.' },
        { id: 'systems', label: 'Prioritize maximum performance', description: 'Use a faster systems language when heavy traffic truly requires it.' },
      ],
    },
    {
      id: 'system_topology',
      category: 'topology',
      question: 'How independently should different parts of the product change and operate?',
      context: 'Blueprint will translate this into one well-organized application, independent services, managed functions, or a mixed design.',
      allowCustom: true,
      options: [
        { id: 'one_team', label: 'Keep it simple for one product team', description: 'Release one application with clear internal modules. This is usually the safest starting point.', recommended: true },
        { id: 'independent_areas', label: 'Let separate product areas evolve independently', description: 'Allow different teams to release and scale areas without coordinating every change.' },
        { id: 'uneven_bursts', label: 'Minimize operations and handle uneven demand', description: 'Use managed functions that run independently when work arrives.' },
        { id: 'background_work', label: 'Prioritize resilient background workflows', description: 'Let longer-running work continue through events without making users wait.' },
        { id: 'mixed', label: 'Keep a simple core and isolate critical parts', description: 'Use one main system with only selected high-risk or high-scale capabilities separated.' },
      ],
    },
    {
      id: 'api_contract',
      category: 'api',
      question: 'Who else needs to connect to this product?',
      context: 'Blueprint will use this answer to design the right connection method and keep future integrations manageable.',
      allowCustom: true,
      options: [
        { id: 'first_party', label: 'Only our own app', description: 'Keep the connection private and optimized for the product’s own screens.', recommended: true },
        { id: 'trusted_partners', label: 'A few trusted partners', description: 'Provide stable, documented access for selected outside systems.' },
        { id: 'public_developers', label: 'Outside developers', description: 'Create a public, versioned connection with keys, limits, and documentation.' },
        { id: 'many_live_systems', label: 'Many systems with live updates', description: 'Support frequent two-way updates and work that continues in the background.' },
        { id: 'ai_api', label: 'Let Blueprint decide', description: 'Infer the connection design from the product’s workflows.', recommended: false },
      ],
    },
    {
      id: 'data',
      category: 'data',
      question: 'What kind of information will the product depend on most?',
      context: 'Blueprint will translate the answer into a safe storage design for searching, reporting, and future changes.',
      allowCustom: true,
      options: [
        { id: 'postgres', label: commerce ? 'Accounts, products, orders, and payments' : 'Connected business records', description: 'Prioritize accuracy when information is related and changes together.', recommended: true },
        { id: 'document', label: 'Flexible content and documents', description: 'Prioritize changing content shapes over complex relationships.' },
        { id: 'local_first', label: 'Information stored on each device', description: 'Keep the product useful without a connection and synchronize later.' },
        { id: 'managed_platform', label: 'A managed all-in-one data service', description: 'Reduce setup by bundling storage, sign-in, files, and live updates.' },
        { id: 'ai_data', label: 'Let Blueprint decide', description: 'Choose storage from the product’s accuracy, search, and reporting needs.' },
      ],
    },
    {
      id: 'realtime_offline',
      category: 'realtime',
      question: 'What behavior is required when data changes or connectivity is poor?',
      context: 'Tell Blueprint what people should experience; it will design the live-update and offline behavior.',
      allowCustom: true,
      options: [
        { id: 'online_refresh', label: 'Online with normal refresh', description: 'Keep the architecture simple and refresh data on demand.', recommended: !realtime },
        { id: 'live_updates', label: 'Live server updates', description: 'Push important changes to connected clients quickly.', recommended: realtime },
        { id: 'offline_read', label: 'Offline reading', description: 'Cache important content but require connectivity for changes.' },
        { id: 'offline_write', label: 'Full offline operation', description: 'Allow changes without a connection and safely combine them later.' },
      ],
    },
    {
      id: 'external_integrations',
      category: 'integrations',
      question: 'Which external integrations must be production-ready at launch?',
      context: commerce
        ? 'Payments, notifications, shipping, tax, and analytics have different failure and reconciliation needs.'
        : 'Every external dependency adds credentials, failure handling, testing, and operational ownership.',
      allowCustom: true,
      options: commerce ? [
        { id: 'payments_notifications', label: 'Payments and notifications', description: 'Launch the purchase flow with receipts and order-status messaging.', recommended: true },
        { id: 'commerce_suite', label: 'Full commerce suite', description: 'Add payments, tax, shipping, inventory, email, push, and analytics integrations.' },
        { id: 'payments_only', label: 'Payments only', description: 'Keep launch dependencies minimal and add other services later.' },
        { id: 'integration_plan', label: 'Let AI create an integration plan', description: 'Prioritize required services from the described workflows.' },
      ] : [
        { id: 'essential_only', label: 'Only launch-critical integrations', description: 'Keep the first release dependable with fewer external dependencies.', recommended: true },
        { id: 'notifications_analytics', label: 'Notifications and analytics', description: 'Include communications plus product and operational measurement.' },
        { id: 'business_systems', label: 'Existing business systems', description: 'Connect CRM, billing, identity, or internal systems at launch.' },
        { id: 'integration_plan', label: 'Let AI create an integration plan', description: 'Identify and prioritize integrations from the workflows.' },
      ],
    },
    {
      id: 'security_privacy',
      category: 'security',
      question: 'What security and privacy baseline should the system enforce?',
      context: 'This turns “secure” into concrete controls for credentials, sensitive data, auditing, and abuse prevention.',
      allowCustom: true,
      options: [
        { id: 'production_baseline', label: 'Strong standard protection', description: 'Protect private data, credentials, administrative actions, and abusive traffic.', recommended: !sensitiveData },
        { id: 'sensitive_data', label: 'Extra protection for sensitive data', description: 'Add stricter access checks, detailed history, retention rules, and monitoring.', recommended: sensitiveData },
        { id: 'high_assurance', label: 'Protection for a high-risk product', description: 'Use formal security reviews and stronger isolation before every release.' },
        { id: 'ai_security', label: 'Let Blueprint define protection', description: 'Choose safeguards from the data, users, and workflows.' },
      ],
    },
    {
      id: 'compliance_requirements',
      category: 'compliance',
      question: 'Which legal or industry obligations must shape the first release?',
      context: 'Compliance changes data collection, consent, retention, hosting, vendors, and audit evidence.',
      allowCustom: true,
      options: [
        { id: 'privacy_baseline', label: 'General privacy baseline', description: 'Provide consent, deletion, export, and privacy-safe defaults.', recommended: !sensitiveData },
        { id: 'gdpr_ccpa', label: 'Consumer privacy laws', description: 'Support privacy rights required in regions such as Europe and California.' },
        { id: 'regulated', label: 'Payments, health, or enterprise rules', description: 'Prepare for the stricter evidence and controls required by the relevant industry.', recommended: sensitiveData },
        { id: 'none_known', label: 'No special regime identified', description: 'Use a strong baseline and document assumptions for later review.' },
      ],
    },
    {
      id: 'scale_performance',
      category: 'scale',
      question: 'How many people do you expect to use the product at first?',
      context: 'A rough expectation is enough. Blueprint will turn it into concrete speed and capacity targets.',
      allowCustom: true,
      options: [
        { id: 'early_stage', label: 'Hundreds to a few thousand', description: 'Keep early costs low while leaving a straightforward path to grow.', recommended: true },
        { id: 'growth', label: 'Tens of thousands', description: 'Prepare for steady growth and predictable busy periods.' },
        { id: 'large_scale', label: 'Hundreds of thousands or more', description: 'Prepare for many people using the product at the same time.' },
        { id: 'explicit_slo', label: 'Set exact speed targets', description: 'Define how quickly important screens and actions must respond under load.' },
      ],
    },
    {
      id: 'reliability_recovery',
      category: 'reliability',
      question: 'How much downtime or data loss can the product tolerate?',
      context: 'Recovery objectives determine backup frequency, redundancy, failover, and operational cost.',
      allowCustom: true,
      options: [
        { id: 'standard', label: 'Standard managed reliability', description: 'Automated daily backups and provider-level availability are sufficient.', recommended: true },
        { id: 'business_critical', label: 'Business-critical recovery', description: 'Use frequent backups, tested restores, health checks, and rapid recovery.' },
        { id: 'high_availability', label: 'High availability', description: 'Use multi-zone redundancy and strict recovery objectives.' },
        { id: 'custom_rto_rpo', label: 'Set exact recovery targets', description: 'State the longest acceptable outage and how much recent data could be lost.' },
      ],
    },
    {
      id: 'deployment_hosting',
      category: 'deployment',
      question: 'How much hosting infrastructure does your team want to manage?',
      context: 'Blueprint will choose a hosting setup that balances control, maintenance, location needs, and cost.',
      allowCustom: true,
      options: [
        { id: 'managed_cloud', label: 'As little as possible', description: 'Use managed hosting and databases so the team can focus on the product.', recommended: true },
        { id: 'major_cloud', label: 'Some control through a major cloud', description: 'Use Amazon, Microsoft, or Google cloud services with more configuration freedom.' },
        { id: 'portable_containers', label: 'Keep it easy to move later', description: 'Package the system so it can run with different hosting providers.' },
        { id: 'self_hosted', label: 'Manage our own servers', description: 'Keep full infrastructure control and accept the maintenance responsibility.' },
        { id: 'ai_hosting', label: 'Let Blueprint decide', description: 'Choose hosting from the scale, region, budget, and team answers.' },
      ],
    },
    {
      id: 'delivery_workflow',
      category: 'delivery',
      question: 'How carefully should updates be checked before users receive them?',
      context: 'This determines the preview, approval, automatic checking, and rollback process for each release.',
      allowCustom: true,
      options: [
        { id: 'three_env_ci', label: 'Standard safe release process', description: 'Check changes automatically, test them in staging, and support quick rollback.', recommended: true },
        { id: 'preview_envs', label: 'A private preview for every change', description: 'Let the team review each feature in isolation before merging it.' },
        { id: 'simple_pipeline', label: 'Simple releases for a small team', description: 'Use fewer environments and controls for an early, lower-risk product.' },
        { id: 'regulated_delivery', label: 'Formal approval before release', description: 'Require evidence, named approval, and a complete change history.' },
      ],
    },
    {
      id: 'testing_quality',
      category: 'testing',
      question: 'What quality gates must pass before a release?',
      context: 'The testing strategy should protect the highest-risk workflows without slowing every change equally.',
      allowCustom: true,
      options: [
        { id: 'risk_based', label: 'Balanced automated testing', description: 'Test small pieces plus the most important complete user journeys.', recommended: true },
        { id: 'e2e_heavy', label: 'Test real user journeys heavily', description: 'Prioritize realistic flows across the app, server, and outside services.' },
        { id: 'strict_coverage', label: 'Very strict automated checks', description: 'Require broad tests, security scanning, and speed checks before release.' },
        { id: 'lean_manual', label: 'Core automation plus human review', description: 'Automate repeatable high-risk paths and review the rest manually.' },
      ],
    },
    {
      id: 'monitoring_alerts',
      category: 'observability',
      question: 'How should the team learn that something is going wrong?',
      context: 'The answer determines what is tracked, when alerts are sent, and how quickly a problem can be understood.',
      allowCustom: true,
      options: [
        { id: 'managed_observability', label: 'Detailed dashboards and useful alerts', description: 'Track errors, speed, system health, and important business events together.', recommended: true },
        { id: 'essential_monitoring', label: 'Only essential alerts', description: 'Notify the team when the product is down or a critical journey fails.' },
        { id: 'full_slo', label: 'Formal reliability targets', description: 'Track agreed goals for availability and speed over time.' },
        { id: 'ai_observability', label: 'Let Blueprint decide what to track', description: 'Derive dashboards and alerts from the most important workflows.' },
      ],
    },
    {
      id: 'operational_ownership',
      category: 'operations',
      question: 'Who will operate the product after launch?',
      context: 'Team capacity determines whether the system should favor managed services, automation, or deeper infrastructure control.',
      allowCustom: true,
      options: [
        { id: 'small_team', label: 'Small product team', description: 'Favor managed services, simple runbooks, and low maintenance.', recommended: true },
        { id: 'dedicated_ops', label: 'Dedicated platform or DevOps owner', description: 'Support custom infrastructure and more advanced operational controls.' },
        { id: 'external_partner', label: 'External operations partner', description: 'Design clear handoffs, access boundaries, and support procedures.' },
        { id: 'unknown_ops', label: 'Not decided yet', description: 'Use conservative managed defaults and document ownership gaps.' },
      ],
    },
    {
      id: 'cost_constraints',
      category: 'budget',
      question: 'What infrastructure-cost posture should guide the architecture?',
      context: 'Cost constraints influence managed services, redundancy, data transfer, and scaling choices.',
      allowCustom: true,
      options: [
        { id: 'lean', label: 'Keep early costs minimal', description: 'Prefer usage-based managed services and scale only when demand appears.', recommended: true },
        { id: 'balanced', label: 'Balance cost and resilience', description: 'Pay for dependable production safeguards without enterprise overhead.' },
        { id: 'reliability_first', label: 'Reliability over cost', description: 'Fund redundancy, stronger recovery, and deeper monitoring from launch.' },
        { id: 'fixed_budget', label: 'Work within a fixed monthly budget', description: 'Provide a concrete budget so the architecture can enforce it.' },
      ],
    },
  ];

  return {
    questions: questions.filter(question => !knownCategories.has(question.category)),
    inferredFacts,
  };
}
