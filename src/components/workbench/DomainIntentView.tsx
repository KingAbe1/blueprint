import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
} from '../../services/aiService';
import { isDesktopApp } from '../../utils/platform';
import { ProductBriefDisplay } from './ProductBriefDisplay';
import { WorkbenchPhaseHeader, WorkbenchStep } from './WorkbenchPhaseHeader';
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

const DESCRIPTION_TEXTAREA_MIN_PX = 120;
/** Keeps build questions on screen; longer briefs scroll inside the field. */
const DESCRIPTION_TEXTAREA_MAX_REM = 26;

function descriptionEditorMaxHeightPx() {
  if (typeof window === 'undefined') {
    return DESCRIPTION_TEXTAREA_MAX_REM * 16;
  }
  return Math.min(window.innerHeight * 0.45, DESCRIPTION_TEXTAREA_MAX_REM * 16);
}

function fitDescriptionTextareaHeight(element: HTMLTextAreaElement) {
  const maxHeight = descriptionEditorMaxHeightPx();
  element.style.height = '0px';
  const contentHeight = element.scrollHeight;
  const nextHeight = Math.min(Math.max(contentHeight, DESCRIPTION_TEXTAREA_MIN_PX), maxHeight);
  element.style.height = `${nextHeight}px`;
  element.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
}

const CATEGORY_LABELS: Record<ArchitectureQuestion['category'], string> = {
  product: 'Product scope',
  users: 'Users & workflows',
  platform: 'Target platform',
  approach: 'Decision defaults',
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
  const [descriptionViewMode, setDescriptionViewMode] = useState<'edit' | 'preview'>('edit');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const bindDescriptionRef = useCallback((node: HTMLTextAreaElement | null) => {
    descriptionRef.current = node;
    if (node) fitDescriptionTextareaHeight(node);
  }, []);

  const descriptionDraft = activeProject?.spec.description ?? '';
  const interviewCompleted = activeProject?.spec.interview?.status === 'completed';
  const descriptionWordCountEarly = descriptionDraft.trim().split(/\s+/).filter(Boolean).length;
  const descriptionReadyEarly = descriptionWordCountEarly >= 5;
  const showDescriptionTextarea =
    !interviewCompleted && (descriptionViewMode === 'edit' || !descriptionReadyEarly);

  useEffect(() => {
    const draft = activeProject?.spec.description ?? '';
    const words = draft.trim().split(/\s+/).filter(Boolean).length;
    const looksLikeBrief = words >= 5 && (draft.includes('\n') || words >= 40);
    setDescriptionViewMode(looksLikeBrief ? 'preview' : 'edit');
  }, [activeProject?.id]);

  useLayoutEffect(() => {
    if (!showDescriptionTextarea) return;
    const node = descriptionRef.current;
    if (!node) return;
    fitDescriptionTextareaHeight(node);
  }, [descriptionDraft, showDescriptionTextarea, isPolishing]);

  useEffect(() => {
    if (!showDescriptionTextarea) return;
    const onResize = () => {
      const node = descriptionRef.current;
      if (node) fitDescriptionTextareaHeight(node);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showDescriptionTextarea, descriptionDraft, isPolishing]);

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
      setDescriptionViewMode('preview');
      notify.success(`Product brief updated with ${result.providerName}.`);
    } catch (error: any) {
      notify.error(error?.message || 'Could not polish the description.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleEditProduct = () => {
    const shouldReset = window.confirm('Editing the product description will reset your build questions and answers so the blueprint stays consistent. Continue?');
    if (!shouldReset) return;
    setInterviewBeforeEdit(null);
    updateSpec({
      interview: undefined,
      frameworkRecommendations: [],
      targetFramework: undefined,
      frameworkRecommendation: undefined,
      customRequirements: undefined,
    });
  };

  const startInterview = async () => {
    if (!spec.description?.trim()) {
      notify.warning('Describe the product before designing its architecture.');
      return;
    }

    if (!isAiConfigured) {
      setIsSettingsOpen(true);
      return;
    }

    const completedInterview = interview?.status === 'completed' ? interview : null;
    setInterviewBeforeEdit(completedInterview);
    setIsGeneratingInterview(true);
    try {
      const result = await generateArchitectureInterview(activeProject.name, spec.description, settings);

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
      notify.error(error?.message || 'Could not generate build questions.');
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
          customRequirements: `Build question answers:\n${answerBrief}`,
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

  const descriptionReady = wordCount >= 5;

  const interviewStatus = !interview
    ? descriptionReady
      ? 'Brief ready · start build questions'
      : 'Add your product brief'
    : interview.status === 'in_progress'
      ? `Question ${interview.currentQuestionIndex + 1} of ${interview.questions.length}`
      : selectedFramework
        ? 'Decisions saved'
        : 'Saving your answers…';
  const showArchitectureSection = descriptionReady || Boolean(interview);
  const foundationStep = descriptionReady ? 2 : 1;
  const pinBuildQuestionsBesideBrief =
    showArchitectureSection && descriptionReady && !interview;

  const phaseDescription = useMemo(() => {
    if (!showArchitectureSection) {
      return 'Start with a plain-language description of the product.';
    }
    if (interview?.status === 'completed') {
      return 'Your brief and build choices are saved. Edit below or open the architecture map when you’re ready.';
    }
    if (interview?.status === 'in_progress') {
      return 'Answer each build question—one choice per step. Blueprint uses these to recommend a stack.';
    }
    if (pinBuildQuestionsBesideBrief) {
      return 'Your brief is ready. Start build questions when you’re happy with it.';
    }
    return 'Add your brief, then work through build questions to shape the architecture.';
  }, [showArchitectureSection, interview?.status, pinBuildQuestionsBesideBrief]);

  const foundationSteps = useMemo((): WorkbenchStep[] => {
    const briefState: WorkbenchStep['state'] = descriptionReady
      ? 'complete'
      : 'current';
    let questionsState: WorkbenchStep['state'] = 'pending';
    if (interview?.status === 'completed') {
      questionsState = 'complete';
    } else if (descriptionReady) {
      questionsState = 'current';
    }
    return [
      { id: 'brief', label: 'Product brief', state: briefState },
      { id: 'questions', label: 'Build questions', state: questionsState },
    ];
  }, [descriptionReady, interview?.status]);

  const scrollToArchitecture = () => {
    document.getElementById('architecture-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  const desktop = isDesktopApp();
  const showBriefPreview = !showDescriptionTextarea && interview?.status !== 'completed';
  const briefLooksPolished = descriptionReady && (descriptionWordCountEarly >= 40 || spec.description.includes('\n'));
  const cardRadius = desktop ? 'rounded-lg' : 'rounded-2xl';
  const pagePadding = desktop
    ? 'w-full px-6 py-7 lg:px-8 xl:px-10'
    : 'w-full px-5 py-7 sm:px-6 lg:px-10 lg:py-8 xl:px-12';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={pagePadding}>
        <WorkbenchPhaseHeader
          eyebrow={`${activeProject.name} · Step ${foundationStep} of 2 · ${interviewStatus}`}
          title="Product blueprint"
          description={phaseDescription}
          steps={foundationSteps}
        />

        <div
          className={
            pinBuildQuestionsBesideBrief
              ? 'grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,20rem)] lg:items-start xl:gap-6'
              : 'flex max-w-none flex-col gap-5 xl:gap-6'
          }
        >
        <section id="product-section" className={`scroll-mt-6 border p-5 sm:p-6 ${cardRadius} ${surface}`}>
          <div
            className={`mb-5 flex items-center justify-between gap-4 ${
              interview?.status === 'completed'
                ? `border-b pb-4 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`
                : ''
            }`}
          >
            {interview?.status === 'completed' ? (
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Product brief</p>
            ) : (
              <div className="flex gap-3">
                <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${
                  isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {showBriefPreview ? 'Product brief' : 'What are you building?'}
                  </h2>
                  {showBriefPreview ? null : (
                    <p className={`mt-1 text-xs leading-5 ${muted}`}>
                      Who it is for, what they can do, and what success looks like.
                    </p>
                  )}
                </div>
              </div>
            )}
            {interview?.status === 'completed' ? (
              <button
                type="button"
                onClick={handleEditProduct}
                className="btn-secondary-accent flex shrink-0 items-center gap-2 px-3 py-2 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit product
              </button>
            ) : showBriefPreview ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDescriptionViewMode('edit')}
                  className="btn-secondary-accent flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handlePolish}
                  disabled={isPolishing}
                  className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50"
                >
                  {isPolishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                  {isPolishing ? 'Refining…' : isAiConfigured ? (briefLooksPolished ? 'Refine with AI' : 'Polish with AI') : 'Connect AI'}
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {descriptionReady && (
                  <button
                    type="button"
                    onClick={() => setDescriptionViewMode('preview')}
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    Preview
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePolish}
                  disabled={isPolishing}
                  className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50"
                >
                  {isPolishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                  {isPolishing ? 'Polishing…' : isAiConfigured ? 'Polish with AI' : 'Connect AI'}
                </button>
              </div>
            )}
          </div>

          {interview?.status === 'completed' || showBriefPreview ? (
            <ProductBriefDisplay text={spec.description || ''} wordCount={wordCount} />
          ) : (
            <textarea
              ref={bindDescriptionRef}
              value={spec.description || ''}
              onChange={event => {
                updateSpec({ description: event.target.value });
                fitDescriptionTextareaHeight(event.target);
              }}
              rows={1}
              placeholder={`What should ${activeProject.name} do? Example: A workspace where teams plan work, assign tasks, and keep a searchable history of decisions.`}
              className={`box-border w-full min-h-[7.5rem] resize-none rounded-xl border p-4 text-sm leading-6 outline-none transition-colors ${input}`}
            />
          )}

          <div className="mt-3 flex items-center justify-end gap-3">
            <div className="flex shrink-0 items-center gap-3">
              {interview?.status !== 'completed' && showDescriptionTextarea && (
                <span className={`text-xs ${muted}`}>
                  {wordCount} words{!descriptionReady ? ' · 5+ to continue' : ''}
                </span>
              )}
              {descriptionReady && !interview && !pinBuildQuestionsBesideBrief && (
                <button
                  type="button"
                  onClick={scrollToArchitecture}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {!showArchitectureSection && (
          <p className={`mt-4 text-center text-xs ${muted}`}>
            Write at least a few words about the product to unlock build questions.
          </p>
        )}

        {showArchitectureSection && (
        <section
          id="architecture-section"
          className={`scroll-mt-6 border p-5 sm:p-6 ${cardRadius} ${surface} ${
            pinBuildQuestionsBesideBrief ? 'lg:sticky lg:top-4 lg:self-start' : ''
          }`}
        >
          <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${pinBuildQuestionsBesideBrief && !interview ? 'sm:flex-col' : ''}`}>
            <div className="flex gap-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {interview?.status === 'completed'
                      ? 'Design decisions'
                      : pinBuildQuestionsBesideBrief
                        ? 'Next step'
                        : 'Build questions'}
                  </h2>
                  {interview?.status === 'completed' && (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                      Complete · {decisionItems.length} answers
                    </span>
                  )}
                </div>
                {!(pinBuildQuestionsBesideBrief && !interview) && (
                  <p className={`mt-1 text-xs leading-5 ${muted}`}>
                    {interview?.status === 'completed'
                      ? 'Your question-and-answer choices, used to pick stack and structure.'
                      : 'Pick one answer per question—Blueprint generates only what this project needs.'}
                  </p>
                )}
              </div>
            </div>
            {interview?.status === 'completed' && (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button type="button" onClick={editInterview} className="btn-secondary-accent flex items-center gap-1.5 px-3 py-2 text-xs">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit answers
                </button>
                <button
                  type="button"
                  onClick={() => startInterview()}
                  disabled={isGeneratingInterview}
                  className="btn-secondary-accent flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
                >
                  {isGeneratingInterview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  New question set
                </button>
              </div>
            )}
          </div>

          {!interview && (
            pinBuildQuestionsBesideBrief ? (
              <div className="mt-5 space-y-4">
                <p className={`text-xs leading-5 ${muted}`}>One choice per question, tailored to this brief.</p>
                <button
                  type="button"
                  onClick={() => startInterview()}
                  disabled={isGeneratingInterview || !descriptionReady}
                  className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary-blue px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingInterview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGeneratingInterview ? 'Preparing…' : isAiConfigured ? 'Start questions' : 'Connect AI to start'}
                </button>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={`max-w-lg text-sm leading-6 ${muted}`}>
                  Blueprint turns your answers into stack choices and constraints for the coding agent.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startInterview()}
                    disabled={isGeneratingInterview || !descriptionReady}
                    className="flex items-center justify-center gap-2 rounded-lg btn-primary-blue px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isGeneratingInterview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isGeneratingInterview ? 'Preparing…' : isAiConfigured ? 'Start questions' : 'Connect AI to start'}
                  </button>
                </div>
              </div>
            )
          )}

          {interview?.status === 'in_progress' && currentQuestion && (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className={`text-[11px] ${muted}`}>Questions from {interview.providerName || 'Blueprint'}</span>
                <button type="button" onClick={exitInterview} className={`text-[11px] font-medium transition-colors ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                  {interviewBeforeEdit ? 'Cancel editing' : 'Exit questions'}
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
                  className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs disabled:invisible"
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
                  <button type="button" onClick={() => generateStackRecommendations(interview)} className="btn-secondary mt-3 px-3 py-2 text-xs">
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
                  {(interview.inferredFacts || []).length > 0 && (
                    <div className={`overflow-hidden rounded-xl border lg:col-span-2 ${isDark ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-emerald-100 bg-emerald-50/40'}`}>
                      <div className={`border-b px-4 py-3 ${isDark ? 'border-emerald-500/10' : 'border-emerald-100'}`}>
                        <h4 className={`text-xs font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}>From your brief</h4>
                        <p className={`mt-0.5 text-[10px] ${muted}`}>Blueprint treated these as already decided—no question asked.</p>
                      </div>
                      <ul className={`divide-y ${isDark ? 'divide-emerald-500/10' : 'divide-emerald-100'}`}>
                        {(interview.inferredFacts || []).map(fact => (
                          <li key={`${fact.category}-${fact.value}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5">
                            <span className={`text-[9px] font-semibold uppercase tracking-[0.11em] ${muted}`}>{CATEGORY_LABELS[fact.category]}</span>
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{fact.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {DECISION_GROUPS.map(group => {
                    const groupQuestions = interview.questions.filter(question =>
                      group.categories.includes(question.category),
                    );
                    if (groupQuestions.length === 0) return null;

                    return (
                      <div key={group.title} className={`overflow-hidden rounded-xl border ${isDark ? 'border-white/[0.07] bg-[#141518]' : 'border-slate-200 bg-white'}`}>
                        <div className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                          <div>
                            <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{group.title}</h4>
                            <p className={`mt-0.5 text-[10px] ${muted}`}>{group.description}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>{groupQuestions.length}</span>
                        </div>
                        <div className={`divide-y ${isDark ? 'divide-white/[0.05]' : 'divide-slate-200'}`}>
                          {groupQuestions.map(question => {
                            const answer = interview.answers.find(item => item.questionId === question.id);
                            return (
                              <div key={question.id} className="px-4 py-3">
                                <p className={`text-[9px] font-semibold uppercase tracking-[0.11em] ${muted}`}>{CATEGORY_LABELS[question.category]}</p>
                                <p className={`mt-1 text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{question.question}</p>
                                <p className={`mt-2 text-xs font-semibold leading-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {answer?.label || 'No preference'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </section>
        )}
        </div>
      </div>
    </div>
  );
};
