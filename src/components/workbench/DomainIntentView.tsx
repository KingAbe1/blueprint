import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
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
import { ProductBriefRichEditor } from './ProductBriefRichEditor';
import { WorkbenchPhaseHeader, WorkbenchStep } from './WorkbenchPhaseHeader';
import { workbenchCanvasClass, workbenchPagePadding, workbenchTheme } from './workbenchUi';
import {
  CATEGORY_LABELS,
  isExclusivePreferenceLabel,
  parseStoredOptionIds,
} from './architectureInterviewLabels';
import { DesignDecisionsPanel } from './DesignDecisionsPanel';
import { InterviewReviewPanel } from './InterviewReviewPanel';
import { useConfirm } from '../../context/ConfirmContext';
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
  const { confirm } = useConfirm();

  const [isPolishing, setIsPolishing] = useState(false);
  const [prePolishDescription, setPrePolishDescription] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ArchitecturalInterview | null>(null);
  const [seedBannerDismissed, setSeedBannerDismissed] = useState(false);
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [interviewBeforeEdit, setInterviewBeforeEdit] = useState<ArchitecturalInterview | null>(null);
  const [descriptionViewMode, setDescriptionViewMode] = useState<'edit' | 'preview'>('edit');
  const scrollToQuestionsAfterGenerate = useRef(false);

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

  useEffect(() => {
    if (!activeProject?.id) return;
    setSeedBannerDismissed(localStorage.getItem(`blueprint_brief_seed_ack_${activeProject.id}`) === '1');
    setReviewDraft(null);
    setPrePolishDescription(null);
    setInterviewBeforeEdit(null);
    setSelectedOptionId('');
    setSelectedOptionIds([]);
    setCustomAnswer('');
    setIsGeneratingInterview(false);
    scrollToQuestionsAfterGenerate.current = false;
  }, [activeProject?.id]);

  useLayoutEffect(() => {
    if (!scrollToQuestionsAfterGenerate.current) return;
    if (activeProject?.spec.interview?.status !== 'in_progress') return;
    scrollToQuestionsAfterGenerate.current = false;
    document.getElementById('architecture-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [
    activeProject?.id,
    activeProject?.spec.interview?.status,
    activeProject?.spec.interview?.questions?.length,
  ]);

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
    if (!currentQuestion) return;
    const storedOptionId = currentAnswer?.optionId || '';
    if (currentQuestion.allowMultiple) {
      setSelectedOptionIds(parseStoredOptionIds(storedOptionId));
      setSelectedOptionId('');
    } else {
      setSelectedOptionIds([]);
      setSelectedOptionId(storedOptionId);
    }
    setCustomAnswer(storedOptionId ? '' : currentAnswer?.value || '');
  }, [currentQuestion?.id, currentQuestion?.allowMultiple, currentAnswer?.optionId, currentAnswer?.value]);

  const { border, panel, muted, title: titleText, input, inner } = workbenchTheme(isDark);

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

    setPrePolishDescription(spec.description);
    setIsPolishing(true);
    try {
      const result = await expandAndPolishDescription(activeProject.name, spec.description, settings);
      updateSpec({ description: result.text, descriptionHtml: undefined });
      setDescriptionViewMode('preview');
      notify.success(`Product brief updated with ${result.providerName}.`);
    } catch (error: any) {
      notify.error(error?.message || 'Could not polish the description.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleEditProduct = async () => {
    const shouldReset = await confirm({
      title: 'Edit product brief?',
      description:
        'Editing the description will reset build questions, answers, and architecture so the blueprint stays consistent.',
      confirmLabel: 'Edit brief',
      tone: 'danger',
    });
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

    if (interview?.status === 'in_progress' || interview?.status === 'completed') {
      const replace = await confirm({
        title: 'Generate new AI questions?',
        description:
          'This replaces the current build questions and clears answers. Your product brief stays the same.',
        confirmLabel: 'Generate new set',
        tone: 'danger',
      });
      if (!replace) return;
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

      scrollToQuestionsAfterGenerate.current = true;
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

    const typedAnswer = customAnswer.trim();
    let answer: ArchitectureAnswer;

    if (currentQuestion.allowMultiple) {
      const chosen = currentQuestion.options.filter(item => selectedOptionIds.includes(item.id));
      if (chosen.length === 0 && !typedAnswer) {
        notify.warning('Choose at least one option or enter your own answer.');
        return;
      }
      answer = {
        questionId: currentQuestion.id,
        optionId: chosen.map(item => item.id).join(','),
        value: chosen.map(item => item.id).join(',') || typedAnswer,
        label: chosen.map(item => item.label).join(' · ') || typedAnswer,
      };
    } else {
      const option = currentQuestion.options.find(item => item.id === selectedOptionId);
      if (!option && !typedAnswer) {
        notify.warning('Choose an option or enter your own answer.');
        return;
      }
      answer = {
        questionId: currentQuestion.id,
        optionId: option?.id,
        value: option?.id || typedAnswer,
        label: option?.label || typedAnswer,
      };
    }
    const answers = [
      ...interview.answers.filter(item => item.questionId !== currentQuestion.id),
      answer,
    ];
    const isLastQuestion = interview.currentQuestionIndex >= interview.questions.length - 1;

    if (isLastQuestion) {
      setReviewDraft({
        ...interview,
        answers,
      });
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

  const confirmReviewAndBuild = async () => {
    if (!reviewDraft) return;
    const completedInterview: ArchitecturalInterview = {
      ...reviewDraft,
      status: 'completed',
      summaryInsights: reviewDraft.questions.map(question => {
        const savedAnswer = reviewDraft.answers.find(item => item.questionId === question.id);
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
    setReviewDraft(null);
    await generateStackRecommendations(completedInterview);
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
  const showSeedBanner = Boolean(
    spec.initialOneLineIdea?.trim()
    && !seedBannerDismissed
    && descriptionReady
    && !interviewCompleted,
  );

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
      return 'Describe the product in plain language.';
    }
    if (interview?.status === 'completed') {
      return 'Brief and answers saved—edit here or open the architecture map.';
    }
    if (interview?.status === 'in_progress') {
      return 'One choice per question; Blueprint recommends a stack from your answers.';
    }
    if (pinBuildQuestionsBesideBrief) {
      return 'Brief ready—start build questions when you are.';
    }
    return 'Add a brief, then answer build questions.';
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
  return (
    <div className={`flex-1 overflow-y-auto ${workbenchCanvasClass(isDark)}`}>
      <div className={workbenchPagePadding(desktop)}>
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
        <section id="product-section" className={`scroll-mt-6 overflow-hidden rounded-2xl border ${panel}`}>
          <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
          <div className="flex items-center justify-between gap-4">
            {interview?.status === 'completed' ? (
              <div>
                <p className={`text-xs ${muted}`}>Captured from your idea</p>
                <p className={`mt-0.5 text-[13px] ${titleText}`}>Product brief</p>
                <p className={`mt-1 max-w-xl text-xs leading-5 ${muted}`}>
                  Used for build questions and the architecture map.
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border ${border} ${
                  isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-500'
                }`}>
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className={`text-[13px] ${titleText}`}>
                    {showBriefPreview ? 'Product brief' : 'What are you building?'}
                  </h2>
                  <p className={`mt-1 max-w-xl text-xs leading-5 ${muted}`}>
                    {showBriefPreview
                      ? 'Review below before build questions.'
                      : 'Who it’s for and what it should do.'}
                  </p>
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
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
          {showSeedBanner ? (
            <div className={`mb-5 rounded-xl border px-4 py-3 ${border} ${inner}`}>
              <p className={`text-xs ${titleText}`}>Seeded from your one-line idea</p>
              <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
                &ldquo;{spec.initialOneLineIdea}&rdquo; — expand it below or polish with AI when you&apos;re ready.
              </p>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(`blueprint_brief_seed_ack_${activeProject.id}`, '1');
                  setSeedBannerDismissed(true);
                }}
                className={`mt-2 text-[11px] font-medium ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
              >
                Got it
              </button>
            </div>
          ) : null}
          {prePolishDescription ? (
            <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${border} ${inner}`}>
              <p className={`text-[11px] ${muted}`}>You can restore the brief from before AI polish.</p>
              <button
                type="button"
                onClick={() => {
                  updateSpec({ description: prePolishDescription, descriptionHtml: undefined });
                  setPrePolishDescription(null);
                  notify.success('Previous brief restored.');
                }}
                className="btn-secondary-accent px-2.5 py-1.5 text-[10px] font-medium"
              >
                Undo polish
              </button>
            </div>
          ) : null}
          {interview?.status === 'completed' || showBriefPreview ? (
            <ProductBriefRichEditor
              readOnly
              text={spec.description || ''}
              html={spec.descriptionHtml}
              inputClassName={input}
            />
          ) : (
            <ProductBriefRichEditor
              text={spec.description || ''}
              html={spec.descriptionHtml}
              onChange={(plain, nextHtml) => updateSpec({ description: plain, descriptionHtml: nextHtml })}
              inputClassName={input}
              placeholder={`What should ${activeProject.name} do? Use bullet lists for features and headings for sections like Summary or Who it's for.`}
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
                  className="btn-primary-blue flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium text-white"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
          className={`scroll-mt-6 overflow-hidden rounded-2xl border ${panel} ${
            pinBuildQuestionsBesideBrief ? 'lg:sticky lg:top-4 lg:self-start' : ''
          }`}
        >
          <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
          <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${pinBuildQuestionsBesideBrief && !interview ? 'sm:flex-col' : ''}`}>
            <div className="flex gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${
                isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-500'
              }`}>
                <Layers className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`text-[13px] ${titleText}`}>
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
                <p className={`mt-1 max-w-xl text-xs leading-5 ${muted}`}>
                  {interview?.status === 'completed'
                    ? 'Drives stack and structure choices.'
                    : pinBuildQuestionsBesideBrief && !interview
                      ? 'AI-generated from your brief when you start.'
                      : 'One answer per question for this project.'}
                </p>
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
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
          {reviewDraft ? (
            <InterviewReviewPanel
              interview={reviewDraft}
              onBack={() => {
                updateSpec({
                  interview: {
                    ...reviewDraft,
                    status: 'in_progress',
                    currentQuestionIndex: reviewDraft.questions.length - 1,
                  },
                });
                setReviewDraft(null);
              }}
              onConfirm={() => void confirmReviewAndBuild()}
              isSubmitting={isAnalyzing}
            />
          ) : null}

          {!reviewDraft && !interview && (
            pinBuildQuestionsBesideBrief ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => startInterview()}
                  disabled={isGeneratingInterview || !descriptionReady}
                  className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary-blue px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingInterview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isGeneratingInterview ? 'Preparing…' : isAiConfigured ? 'Start build questions' : 'Connect AI to start'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={`max-w-lg text-sm leading-6 ${muted}`}>
                  Blueprint turns your answers into stack choices and constraints for the coding agent.
                </p>
                <button
                  type="button"
                  onClick={() => startInterview()}
                  disabled={isGeneratingInterview || !descriptionReady}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg btn-primary-blue px-4 py-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingInterview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  {isGeneratingInterview ? 'Preparing…' : isAiConfigured ? 'Start build questions' : 'Connect AI'}
                </button>
              </div>
            )
          )}

          {!reviewDraft && interview?.status === 'in_progress' && currentQuestion && (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className={`text-[11px] ${muted}`}>
                    {`Build questions · tailored to “${activeProject.name}”`}
                  </span>
                  {interview.providerName ? (
                    <span className={`mt-0.5 block text-[10px] ${muted}`}>via {interview.providerName}</span>
                  ) : null}
                </div>
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
                {currentQuestion.allowMultiple ? (
                  <p className={`mt-2 text-xs font-medium ${isDark ? 'text-blue-300/90' : 'text-blue-700'}`}>
                    Select all that apply.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {currentQuestion.options.map(option => {
                  const selected = currentQuestion.allowMultiple
                    ? selectedOptionIds.includes(option.id)
                    : selectedOptionId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (currentQuestion.allowMultiple) {
                          setCustomAnswer('');
                          if (isExclusivePreferenceLabel(option.label)) {
                            setSelectedOptionIds([option.id]);
                            return;
                          }
                          setSelectedOptionIds(previous => {
                            const withoutExclusive = previous.filter(id => {
                              const match = currentQuestion.options.find(item => item.id === id);
                              return match ? !isExclusivePreferenceLabel(match.label) : true;
                            });
                            return withoutExclusive.includes(option.id)
                              ? withoutExclusive.filter(id => id !== option.id)
                              : [...withoutExclusive, option.id];
                          });
                          return;
                        }
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
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
                          currentQuestion.allowMultiple ? 'rounded-md' : 'rounded-full'
                        } ${
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
                    if (event.target.value) {
                      setSelectedOptionId('');
                      setSelectedOptionIds([]);
                    }
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
                  disabled={
                    currentQuestion.allowMultiple
                      ? selectedOptionIds.length === 0 && !customAnswer.trim()
                      : !selectedOptionId && !customAnswer.trim()
                  }
                  className="btn-primary-blue flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {interview.currentQuestionIndex === interview.questions.length - 1 ? 'Review answers' : 'Continue'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {interview?.status === 'completed' && (
            <div className="space-y-5">
              {isAnalyzing && !selectedFramework ? (
                <div className={`rounded-xl border border-dashed px-5 py-9 text-center ${border} ${inner}`}>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-500" />
                  <p className={`mt-3 text-[13px] ${muted}`}>Turning your decisions into one implementation-ready architecture…</p>
                </div>
              ) : selectedFramework ? (
                <div className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${inner}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${border} ${isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-500'}`}>
                      <Layers className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs ${muted}`}>Architecture map ready</p>
                      <h3 className={`mt-0.5 text-[13px] ${titleText}`}>{selectedFramework.name}</h3>
                      <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
                        Open the interactive system map to see how components connect.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenArchitectureMap}
                    disabled={!onOpenArchitectureMap}
                    className="btn-primary-blue flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Open architecture map
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className={`rounded-xl border border-dashed px-5 py-7 text-center ${border} ${inner}`}>
                  <p className={`text-[13px] ${muted}`}>The final architecture could not be prepared.</p>
                  <button type="button" onClick={() => generateStackRecommendations(interview)} className="btn-secondary mt-3 px-3 py-2 text-xs">
                    Try again
                  </button>
                </div>
              )}

              <DesignDecisionsPanel interview={interview} defaultExpanded={false} />
            </div>
          )}
          </div>
        </section>
        )}
        </div>
      </div>
    </div>
  );
};
