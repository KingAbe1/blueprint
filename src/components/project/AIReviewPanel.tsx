import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, FileCheck2, FileStack, Loader2, Search } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getAllFindingLinkedReviewPaths,
  getSuggestedAIReviewPaths,
  runQualityAIReview,
  type AIReviewCodeSnippet,
  type AIReviewFinding,
  type AIReviewResult,
} from '../../services/aiQualityReviewService';
import { getQualityReviewCandidatePaths, readQualityReviewSources } from '../../services/qualityReviewSourceService';
import type { QualityReviewSourceFile } from '../../services/qualityReviewSourceService';
import type { CodebaseAnalysis } from '../../types/codebase';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewPanelClass,
  overviewRowEmphasis,
  overviewSeverityLabel,
  type OverviewEmphasis,
} from './overviewUi';

interface AIReviewPanelProps {
  analysis: CodebaseAnalysis;
  focusPaths?: string[];
  focusNote?: string;
  onFocusHandled?: () => void;
}

const AI_REVIEW_FILE_LIST_PAGE = 100;

function aiReviewRunButtonClass(isDark: boolean): string {
  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
  return `${base} ${
    isDark
      ? 'border-blue-500/35 bg-blue-500/[0.12] text-blue-100 hover:border-blue-500/45 hover:bg-blue-500/20'
      : 'border-blue-600/15 bg-blue-600 text-white hover:bg-blue-700 shadow-[0_1px_2px_rgba(37,99,235,0.2)]'
  }`;
}

function aiSeverityEmphasis(severity: AIReviewFinding['severity']): OverviewEmphasis {
  if (severity === 'high') return 'critical';
  if (severity === 'medium') return 'warning';
  return 'info';
}

function staticAssessmentLabel(assessment: 'agree' | 'nuance' | 'disagree'): OverviewEmphasis {
  if (assessment === 'disagree') return 'critical';
  if (assessment === 'nuance') return 'warning';
  return 'info';
}

export const AIReviewPanel: React.FC<AIReviewPanelProps> = ({
  analysis,
  focusPaths,
  focusNote,
  onFocusHandled,
}) => {
  const { isDark } = useTheme();
  const { activeConfig, isAiConfigured, setIsSettingsOpen } = useAI();
  const panelRef = useRef<HTMLElement>(null);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = overviewPanelClass(isDark);
  const border = overviewBorderClass(isDark);
  const divide = overviewDivideClass(isDark);

  const [aiReviewCandidates, setAIReviewCandidates] = useState<string[]>(() => getQualityReviewCandidatePaths(analysis));
  const [aiReviewSearch, setAIReviewSearch] = useState('');
  const [aiSelectedPaths, setAISelectedPaths] = useState<string[]>([]);
  const [aiReviewFiles, setAIReviewFiles] = useState<QualityReviewSourceFile[]>([]);
  const [aiReviewResult, setAIReviewResult] = useState<AIReviewResult | null>(null);
  const [aiReviewError, setAIReviewError] = useState<string | null>(null);
  const [isRunningAIReview, setIsRunningAIReview] = useState(false);
  const [reviewPhase, setReviewPhase] = useState<'idle' | 'reading' | 'reviewing'>('idle');
  const [activeFocusNote, setActiveFocusNote] = useState<string | undefined>();
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showSentPayload, setShowSentPayload] = useState(false);
  const [expandedPayloadPath, setExpandedPayloadPath] = useState<string | null>(null);
  const [fileListLimit, setFileListLimit] = useState(AI_REVIEW_FILE_LIST_PAGE);

  const allFindingLinkedPaths = useMemo(() => getAllFindingLinkedReviewPaths(analysis), [analysis]);
  const suggestedPaths = useMemo(() => getSuggestedAIReviewPaths(analysis), [analysis]);
  const suggestedButtonLabel =
    allFindingLinkedPaths.length > suggestedPaths.length
      ? `Suggested (${suggestedPaths.length} of ${allFindingLinkedPaths.length})`
      : `Suggested (${suggestedPaths.length})`;
  const busy = isRunningAIReview;

  const matchingAIReviewCandidates = useMemo(
    () =>
      aiReviewCandidates.filter(path =>
        path.toLowerCase().includes(aiReviewSearch.trim().toLowerCase()),
      ),
    [aiReviewCandidates, aiReviewSearch],
  );

  const visibleFileCandidates = useMemo(
    () => matchingAIReviewCandidates.slice(0, fileListLimit),
    [matchingAIReviewCandidates, fileListLimit],
  );

  const fileListHasMore = fileListLimit < matchingAIReviewCandidates.length;

  const resultListItems = useMemo(() => {
    if (!aiReviewResult) return [];
    const items: Array<
      | { kind: 'summary'; id: string }
      | { kind: 'static'; id: string; index: number }
      | { kind: 'finding'; id: string; index: number }
    > = [{ kind: 'summary', id: 'summary' }];
    aiReviewResult.staticFindingNotes.forEach((_, index) => {
      items.push({ kind: 'static', id: `static-${index}`, index });
    });
    aiReviewResult.findings.forEach((_, index) => {
      items.push({ kind: 'finding', id: `finding-${index}`, index });
    });
    return items;
  }, [aiReviewResult]);

  const selectedResultItem = resultListItems[selectedResultIndex] ?? resultListItems[0];

  useEffect(() => {
    setAIReviewCandidates(getQualityReviewCandidatePaths(analysis));
    setAIReviewSearch('');
    setAISelectedPaths([]);
    setAIReviewFiles([]);
    setAIReviewResult(null);
    setAIReviewError(null);
    setActiveFocusNote(undefined);
    setShowResults(false);
    setSelectedResultIndex(0);
    setFileListLimit(AI_REVIEW_FILE_LIST_PAGE);
  }, [analysis.scannedAt]);

  useEffect(() => {
    if (showResults || !aiSelectedPaths.length) return;
    let maxIndex = -1;
    for (const path of aiSelectedPaths) {
      const index = matchingAIReviewCandidates.indexOf(path);
      if (index > maxIndex) maxIndex = index;
    }
    if (maxIndex < 0) return;
    const neededLimit = Math.ceil((maxIndex + 1) / AI_REVIEW_FILE_LIST_PAGE) * AI_REVIEW_FILE_LIST_PAGE;
    setFileListLimit(current => (current >= neededLimit ? current : neededLimit));
  }, [aiSelectedPaths, matchingAIReviewCandidates, showResults]);

  useEffect(() => {
    if (!focusPaths?.length) return;
    const allowed = new Set(aiReviewCandidates);
    const next = focusPaths.filter(path => allowed.has(path)).slice(0, 6);
    if (next.length) {
      setAISelectedPaths(next);
      setActiveFocusNote(focusNote);
      setAIReviewFiles([]);
      setAIReviewResult(null);
      setShowResults(false);
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onFocusHandled?.();
  }, [focusPaths, focusNote, aiReviewCandidates, onFocusHandled]);

  useEffect(() => {
    if (aiReviewResult) {
      setShowResults(true);
      const firstDetailIndex =
        aiReviewResult.staticFindingNotes.length > 0
          ? 1
          : aiReviewResult.findings.length > 0
            ? 1
            : 0;
      setSelectedResultIndex(firstDetailIndex);
    }
  }, [aiReviewResult]);

  const toggleAIReviewPath = (path: string) => {
    setAIReviewError(null);
    setAIReviewResult(null);
    setAIReviewFiles([]);
    setShowResults(false);
    setAISelectedPaths(current =>
      current.includes(path) ? current.filter(item => item !== path) : current.length < 6 ? [...current, path] : current,
    );
  };

  const applySuggestedPaths = () => {
    setAIReviewError(null);
    setAIReviewResult(null);
    setAIReviewFiles([]);
    setShowResults(false);
    setAISelectedPaths(suggestedPaths);
    setActiveFocusNote(undefined);
  };

  const resetReview = () => {
    setAIReviewFiles([]);
    setAIReviewResult(null);
    setAIReviewError(null);
    setShowResults(false);
    setSelectedResultIndex(0);
  };

  const runAIReviewFromSelection = async () => {
    if (!isAiConfigured || !aiSelectedPaths.length) return;
    setIsRunningAIReview(true);
    setReviewPhase('reading');
    setAIReviewError(null);
    setAIReviewResult(null);
    setShowResults(false);
    setShowSentPayload(false);
    try {
      const files = await readQualityReviewSources(analysis, aiSelectedPaths);
      if (!files.length) {
        throw new Error('None of the selected files could be read. Re-analyze the codebase and try again.');
      }
      setAIReviewFiles(files);
      setReviewPhase('reviewing');
      setAIReviewResult(await runQualityAIReview(activeConfig, analysis, files, activeFocusNote));
    } catch (error) {
      setAIReviewError(error instanceof Error ? error.message : 'The AI review failed. Please try again.');
    } finally {
      setIsRunningAIReview(false);
      setReviewPhase('idle');
    }
  };

  const textAction = isDark ? 'text-xs font-medium text-blue-400 hover:text-blue-300' : 'text-xs font-medium text-blue-600 hover:text-blue-800';

  return (
    <section ref={panelRef} id="quality-ai-review-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${panel}`}>
      <AIReviewPanelHeader
        isDark={isDark}
        titleText={titleText}
        muted={muted}
        border={border}
        textAction={textAction}
        isAiConfigured={isAiConfigured}
        providerName={isAiConfigured ? activeConfig.name : undefined}
        modelName={isAiConfigured ? activeConfig.model : undefined}
        onOpenSettings={() => setIsSettingsOpen(true)}
        showToolbar={isAiConfigured && aiReviewCandidates.length > 0}
        showResults={showResults}
        hasReviewResult={Boolean(aiReviewResult)}
        aiReviewSearch={aiReviewSearch}
        onSearchChange={value => {
          setAIReviewSearch(value);
          setFileListLimit(AI_REVIEW_FILE_LIST_PAGE);
        }}
        onClearSearch={() => {
          setAIReviewSearch('');
          setFileListLimit(AI_REVIEW_FILE_LIST_PAGE);
        }}
        aiSelectedPathsCount={aiSelectedPaths.length}
        onClearSelection={() => setAISelectedPaths([])}
        onApplySuggested={applySuggestedPaths}
        suggestedButtonLabel={suggestedButtonLabel}
        suggestedDisabled={suggestedPaths.length === 0}
        suggestedTitle={
          suggestedPaths.length === 0
            ? 'No file paths in static findings'
            : allFindingLinkedPaths.length > suggestedPaths.length
              ? `Select up to ${suggestedPaths.length} files for AI review (highest-priority finding paths first). ${allFindingLinkedPaths.length - suggestedPaths.length} more finding-linked files are not included due to the review size limit.`
              : 'Select files linked to static findings (highest priority first)'
        }
        busy={busy}
        onChangeFiles={() => setShowResults(false)}
      />

      {!isAiConfigured ? (
        <div className="px-5 py-8 sm:px-6">
          <p className={`text-[13px] ${muted}`}>Static analysis works without AI. Use Connect AI above to enable reviews.</p>
        </div>
      ) : !aiReviewCandidates.length ? (
        <div className="px-5 py-8 text-center sm:px-6">
          <p className={`text-[13px] ${muted}`}>Re-analyze this project to enable file selection for AI review.</p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 lg:grid-cols-12 lg:divide-x ${divide}`}>
            <div className="lg:col-span-5 min-h-[280px] max-h-[min(560px,55vh)] overflow-y-auto overscroll-contain">
              {showResults && aiReviewResult ? (
                <ul className={`divide-y ${divide}`}>
                  {resultListItems.map((item, idx) => {
                    const isSelected = selectedResultIndex === idx;
                    if (item.kind === 'summary') {
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedResultIndex(idx)}
                            className={`w-full py-4 pr-5 pl-5 text-left sm:pr-6 sm:pl-6 ${
                              isSelected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                            } ${overviewRowEmphasis(isDark, isSelected ? 'info' : 'neutral')}`}
                          >
                            <p className={`text-[13px] font-medium ${titleText}`}>Summary</p>
                            <p className={`mt-1.5 text-xs ${muted}`}>Overview and strengths</p>
                          </button>
                        </li>
                      );
                    }
                    if (item.kind === 'static') {
                      const note = aiReviewResult.staticFindingNotes[item.index];
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedResultIndex(idx)}
                            className={`w-full py-4 pr-5 pl-5 text-left sm:pr-6 sm:pl-6 ${
                              isSelected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                            } ${overviewRowEmphasis(isDark, isSelected ? 'info' : staticAssessmentLabel(note.assessment))}`}
                          >
                            <p className={`text-[13px] leading-snug ${titleText}`}>{note.staticTitle}</p>
                            <p className={`mt-1.5 line-clamp-2 text-xs leading-relaxed ${muted}`}>{note.whyFlagged}</p>
                            <p className={`mt-1.5 text-[11px] capitalize ${overviewSeverityLabel(isDark, note.assessment === 'disagree' ? 'critical' : note.assessment === 'nuance' ? 'warning' : 'optimization')}`}>
                              Static · {note.assessment}
                            </p>
                          </button>
                        </li>
                      );
                    }
                    const finding = aiReviewResult.findings[item.index];
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedResultIndex(idx)}
                          className={`w-full py-4 pr-5 pl-5 text-left sm:pr-6 sm:pl-6 ${
                            isSelected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                          } ${overviewRowEmphasis(isDark, isSelected ? 'info' : aiSeverityEmphasis(finding.severity))}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] leading-snug ${titleText}`}>{finding.title}</p>
                            <span className={`shrink-0 text-[11px] uppercase ${overviewSeverityLabel(isDark, finding.severity === 'high' ? 'critical' : finding.severity === 'medium' ? 'warning' : 'optimization')}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <p className={`mt-1.5 line-clamp-2 text-xs leading-relaxed ${muted}`}>{finding.rationale}</p>
                          <p className={`mt-1.5 break-all font-mono text-[11px] leading-relaxed ${muted}`}>
                            {finding.path}
                            {finding.line ? `:${finding.line}` : ''}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <>
                <ul className={`divide-y ${divide}`}>
                  {visibleFileCandidates.map(path => {
                    const selected = aiSelectedPaths.includes(path);
                    const disabled = !selected && aiSelectedPaths.length >= 6;
                    const fileName = path.split('/').pop() || path;
                    return (
                      <li key={path}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleAIReviewPath(path)}
                          className={`w-full py-4 pr-5 pl-5 text-left transition-colors sm:pr-6 sm:pl-6 disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                          } ${overviewRowEmphasis(isDark, selected ? 'info' : 'neutral')}`}
                        >
                          <p className={`text-[13px] leading-snug ${selected ? `font-medium ${titleText}` : titleText}`}>{fileName}</p>
                          <p className={`mt-2 break-all font-mono text-[11px] leading-relaxed ${muted}`} title={path}>
                            {path}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                  {matchingAIReviewCandidates.length === 0 ? (
                    <li className="px-5 py-12 text-center sm:px-6">
                      <p className={`text-sm ${muted}`}>No paths match your filter.</p>
                    </li>
                  ) : null}
                </ul>
                {matchingAIReviewCandidates.length > 0 ? (
                  <FileListPaginationFooter
                    visibleCount={visibleFileCandidates.length}
                    totalCount={matchingAIReviewCandidates.length}
                    projectTotal={aiReviewSearch.trim() ? undefined : aiReviewCandidates.length}
                    hasMore={fileListHasMore}
                    pageSize={AI_REVIEW_FILE_LIST_PAGE}
                    showAllEnabled={matchingAIReviewCandidates.length <= 500}
                    busy={busy}
                    isDark={isDark}
                    muted={muted}
                    border={border}
                    onShowMore={() => setFileListLimit(limit => limit + AI_REVIEW_FILE_LIST_PAGE)}
                    onShowAll={() => setFileListLimit(matchingAIReviewCandidates.length)}
                  />
                ) : null}
                </>
              )}
            </div>

            <div className="lg:col-span-7 min-h-[280px] max-h-[min(560px,55vh)] overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
              {showResults && aiReviewResult && selectedResultItem ? (
                <ResultDetailPane
                  item={selectedResultItem}
                  result={aiReviewResult}
                  sentFiles={aiReviewFiles}
                  showSentPayload={showSentPayload}
                  setShowSentPayload={setShowSentPayload}
                  expandedPayloadPath={expandedPayloadPath}
                  setExpandedPayloadPath={setExpandedPayloadPath}
                  isDark={isDark}
                  titleText={titleText}
                  muted={muted}
                  border={border}
                  divide={divide}
                  onReset={resetReview}
                />
              ) : (
                <SetupDetailPane
                  aiSelectedPaths={aiSelectedPaths}
                  activeFocusNote={activeFocusNote}
                  busy={busy}
                  reviewPhase={reviewPhase}
                  aiReviewError={aiReviewError}
                  providerName={activeConfig.name}
                  modelName={activeConfig.model}
                  isDark={isDark}
                  titleText={titleText}
                  muted={muted}
                  border={border}
                  divide={divide}
                  onRun={() => void runAIReviewFromSelection()}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

function SentPayloadDetails({
  files,
  showSentPayload,
  setShowSentPayload,
  expandedPayloadPath,
  setExpandedPayloadPath,
  isDark,
  titleText,
  muted,
  border,
  divide,
}: {
  files: QualityReviewSourceFile[];
  showSentPayload: boolean;
  setShowSentPayload: (open: boolean) => void;
  expandedPayloadPath: string | null;
  setExpandedPayloadPath: (path: string | null) => void;
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
  divide: string;
}) {
  if (!files.length) return null;
  const chars = files.reduce((n, f) => n + f.content.length, 0);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setShowSentPayload(!showSentPayload)}
        className={`text-xs font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
      >
        {showSentPayload ? 'Hide' : 'Show'} source sent to AI ({chars.toLocaleString()} chars)
      </button>
      {showSentPayload ? (
        <ul className={`mt-2 divide-y rounded-lg border ${divide} ${border}`}>
          {files.map(file => {
            const open = expandedPayloadPath === file.path;
            return (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setExpandedPayloadPath(open ? null : file.path)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                >
                  <span className={`break-all font-mono ${titleText}`}>{file.path}</span>
                  <span className={`shrink-0 ${muted}`}>{open ? 'Hide' : 'View'}</span>
                </button>
                {open ? (
                  <pre
                    className={`max-h-44 overflow-auto border-t px-4 py-2 font-mono text-[11px] leading-relaxed ${border} ${
                      isDark ? 'bg-black/25 text-slate-300' : 'bg-slate-950 text-slate-300'
                    }`}
                  >
                    {file.content}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function aiReviewToolbarButtonClass(isDark: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    isDark
      ? 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-white/[0.12] hover:bg-white/[0.06]'
      : 'border-slate-200/90 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50'
  }`;
}

function AIReviewPanelHeader({
  isDark,
  titleText,
  muted,
  border,
  textAction,
  isAiConfigured,
  providerName,
  modelName,
  onOpenSettings,
  showToolbar,
  showResults,
  hasReviewResult,
  aiReviewSearch,
  onSearchChange,
  onClearSearch,
  aiSelectedPathsCount,
  onClearSelection,
  onApplySuggested,
  suggestedButtonLabel,
  suggestedDisabled,
  suggestedTitle,
  busy,
  onChangeFiles,
}: {
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
  textAction: string;
  isAiConfigured: boolean;
  providerName?: string;
  modelName?: string;
  onOpenSettings: () => void;
  showToolbar: boolean;
  showResults: boolean;
  hasReviewResult: boolean;
  aiReviewSearch: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  aiSelectedPathsCount: number;
  onClearSelection: () => void;
  onApplySuggested: () => void;
  suggestedButtonLabel: string;
  suggestedDisabled: boolean;
  suggestedTitle?: string;
  busy: boolean;
  onChangeFiles: () => void;
}) {
  const inResultsMode = showResults && hasReviewResult;
  const statusLabel = inResultsMode ? 'Results' : aiSelectedPathsCount > 0 ? `${aiSelectedPathsCount}/6 selected` : null;

  const subtitle = !isAiConfigured
    ? 'Connect a provider to send selected source files for an optional second opinion.'
    : inResultsMode
      ? 'Browse AI notes and new findings for the files you reviewed.'
      : 'Pick source files to review. Uses your scan and static findings - does not change your score.';

  return (
    <header className={`border-b ${border}`}>
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className={`text-[15px] font-medium ${titleText}`}>AI code review</h2>
              {statusLabel ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums tracking-wide ${
                    inResultsMode
                      ? isDark
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'bg-blue-50 text-blue-700'
                      : isDark
                        ? 'bg-white/[0.06] text-slate-400'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <p className={`mt-1 max-w-2xl text-[13px] leading-relaxed ${muted}`}>{subtitle}</p>
          </div>

          {isAiConfigured && providerName ? (
            <div
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 ${border} ${
                isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'bg-slate-50/80'
              }`}
              title="Connected AI provider"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 ${isDark ? 'shadow-[0_0_6px_rgba(16,185,129,0.45)]' : ''}`} />
              <p className={`text-[11px] leading-snug ${titleText}`}>
                <span className="font-medium">{providerName}</span>
                {modelName ? (
                  <>
                    <span className={muted}> · </span>
                    <span className={muted}>{modelName}</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <button type="button" onClick={onOpenSettings} className={`inline-flex shrink-0 items-center gap-1.5 ${textAction}`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${isDark ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.35)]' : 'bg-rose-500'}`}
                aria-hidden
              />
              Connect AI
            </button>
          )}
        </div>
      </div>

      {showToolbar ? (
        <div className={`border-t px-5 py-3 sm:px-6 ${border}`}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
              <input
                type="search"
                value={aiReviewSearch}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={inResultsMode ? 'Path filter unavailable in results view' : 'Filter paths…'}
                disabled={inResultsMode}
                className={`w-full rounded-lg border py-1.5 pl-8 pr-8 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDark
                    ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
                    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400'
                }`}
              />
              {aiReviewSearch && !inResultsMode ? (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${muted}`}
                  aria-label="Clear filter"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 lg:shrink-0">
              {inResultsMode ? (
                <button type="button" onClick={onChangeFiles} className={aiReviewToolbarButtonClass(isDark)}>
                  Change files
                </button>
              ) : (
                <>
                  {aiSelectedPathsCount > 0 ? (
                    <button type="button" onClick={onClearSelection} disabled={busy} className={`text-xs ${muted}`}>
                      Clear selection
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onApplySuggested}
                    disabled={busy || suggestedDisabled}
                    title={suggestedTitle}
                    className={aiReviewToolbarButtonClass(isDark)}
                  >
                    {suggestedButtonLabel}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AIReviewSelectionPlaceholder({
  isDark,
  titleText,
  muted,
  border,
}: {
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
}) {
  const steps = [
    'Select up to six paths from the list on the left.',
    'Or use Suggested to pick files linked to static findings.',
  ];

  return (
    <div className="flex min-h-[min(480px,52vh)] flex-col justify-center px-1 py-6">
      <div
        className={`mx-auto w-full max-w-md rounded-2xl border border-dashed px-6 py-8 sm:px-8 ${border} ${
          isDark ? 'border-white/[0.08] bg-white/[0.015]' : 'border-slate-200/90 bg-slate-50/40'
        }`}
      >
        <div className="mx-auto mb-6 flex max-w-[240px] flex-col items-start gap-2 opacity-[0.32]" aria-hidden>
          {(['w-full', 'w-[88%]', 'w-[72%]'] as const).map(widthClass => (
            <div
              key={widthClass}
              className={`flex ${widthClass} items-center gap-2.5 rounded-lg border px-3 py-2 ${border} ${
                isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-200/80 bg-white'
              }`}
            >
              <div className={`h-2 w-2 shrink-0 rounded-full ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />
              <div className={`h-1.5 min-w-0 flex-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>

        <div className="text-center">
          <div
            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border ${
              isDark ? 'border-white/[0.08] bg-white/[0.04] text-slate-400' : 'border-slate-200/90 bg-white text-slate-600 shadow-sm'
            }`}
          >
            <FileStack className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className={`mt-4 text-[15px] font-medium ${titleText}`}>No files selected</p>
          <p className={`mx-auto mt-1.5 max-w-[18rem] text-[13px] leading-relaxed ${muted}`}>
            Your queue and <span className={titleText}>Run AI review</span> action appear here after you choose files.
          </p>
        </div>

        <ol className={`mt-7 space-y-2.5 border-t pt-6 ${border}`}>
          {steps.map((text, index) => (
            <li key={index} className="flex gap-3 text-left">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums ${
                  isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {index + 1}
              </span>
              <p className={`min-w-0 pt-0.5 text-xs leading-relaxed ${muted}`}>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SetupDetailPane({
  aiSelectedPaths,
  activeFocusNote,
  busy,
  reviewPhase,
  aiReviewError,
  providerName,
  modelName,
  isDark,
  titleText,
  muted,
  border,
  divide,
  onRun,
}: {
  aiSelectedPaths: string[];
  activeFocusNote?: string;
  busy: boolean;
  reviewPhase: 'idle' | 'reading' | 'reviewing';
  aiReviewError: string | null;
  providerName: string;
  modelName: string;
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
  divide: string;
  onRun: () => void;
}) {
  if (!aiSelectedPaths.length) {
    return <AIReviewSelectionPlaceholder isDark={isDark} titleText={titleText} muted={muted} border={border} />;
  }

  const runLabel =
    reviewPhase === 'reading' ? 'Reading files…' : reviewPhase === 'reviewing' ? 'Reviewing…' : 'Run AI review';
  const runHint =
    reviewPhase === 'reading'
      ? 'Reading source on this device - nothing sent yet.'
      : reviewPhase === 'reviewing'
        ? `${providerName} · ${modelName}`
        : 'Local read first, then code and related static findings go to your AI provider.';

  return (
    <div className="flex min-h-[min(480px,52vh)] flex-col">
      <div className="min-h-0 flex-1 space-y-4 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className={`text-xs ${muted}`}>Selected for review</p>
            <h3 className={`mt-0.5 text-[15px] font-medium ${titleText}`}>
              {aiSelectedPaths.length} file{aiSelectedPaths.length === 1 ? '' : 's'}
            </h3>
          </div>
          <span className={`text-[11px] tabular-nums ${muted}`}>{aiSelectedPaths.length}/6</span>
        </div>

        {activeFocusNote ? (
          <div className={`rounded-lg border px-3 py-2.5 ${border} ${overviewRowEmphasis(isDark, 'info')}`}>
            <p className={`text-xs font-medium ${titleText}`}>Focus</p>
            <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{activeFocusNote}</p>
          </div>
        ) : null}

        <ul className={`divide-y rounded-xl border ${divide} ${border}`}>
          {aiSelectedPaths.map(path => {
            const fileName = path.split('/').pop() || path;
            return (
              <li key={path} className="flex gap-3 px-4 py-3">
                <FileCheck2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isDark ? 'text-blue-400/90' : 'text-blue-600'}`} />
                <div className="min-w-0">
                  <p className={`text-[13px] leading-snug ${titleText}`}>{fileName}</p>
                  <p className={`mt-1 break-all font-mono text-[10px] leading-relaxed ${muted}`} title={path}>
                    {path}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {aiReviewError ? (
          <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
            {aiReviewError}
          </p>
        ) : null}
      </div>

      <div
        className={`sticky bottom-0 -mx-5 mt-auto space-y-3 border-t px-5 pt-4 pb-1 sm:-mx-6 sm:px-6 ${border} ${
          isDark
            ? 'bg-gradient-to-t from-[#131417] via-[#131417]/98 to-transparent'
            : 'bg-gradient-to-t from-white via-white/98 to-transparent'
        }`}
      >
        <p className={`text-center text-[11px] leading-relaxed ${muted}`}>{runHint}</p>
        <button type="button" onClick={onRun} disabled={busy} className={aiReviewRunButtonClass(isDark)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {runLabel}
        </button>
      </div>
    </div>
  );
}

function FileListPaginationFooter({
  visibleCount,
  totalCount,
  projectTotal,
  hasMore,
  pageSize,
  showAllEnabled,
  busy,
  isDark,
  muted,
  border,
  onShowMore,
  onShowAll,
}: {
  visibleCount: number;
  totalCount: number;
  projectTotal?: number;
  hasMore: boolean;
  pageSize: number;
  showAllEnabled: boolean;
  busy: boolean;
  isDark: boolean;
  muted: string;
  border: string;
  onShowMore: () => void;
  onShowAll: () => void;
}) {
  const remaining = totalCount - visibleCount;
  const nextBatch = Math.min(pageSize, remaining);
  const surface = isDark ? 'bg-[#0f1012]/80' : 'bg-slate-50/90';
  const emphasis = isDark ? 'text-slate-200' : 'text-slate-800';

  const headline = hasMore
    ? `Showing ${visibleCount} of ${totalCount} paths in this list`
    : totalCount === 1
      ? '1 path in this list'
      : `All ${totalCount} matching paths are visible`;

  const helper = hasMore
    ? null
    : totalCount > pageSize
      ? 'Use Filter paths above to narrow a long list.'
      : projectTotal !== undefined && projectTotal > totalCount
        ? `${projectTotal} reviewable paths in this project - filter to find one quickly.`
        : null;

  return (
    <div className={`border-t px-5 py-4 sm:px-6 ${border} ${surface}`}>
      <p className={`text-xs font-medium tabular-nums ${emphasis}`}>{headline}</p>
      {hasMore ? (
        <p className={`mt-1.5 text-[11px] leading-relaxed ${muted}`}>
          All {totalCount} paths are already in your scan.{' '}
          <span className={`font-medium tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{remaining}</span>{' '}
          are hidden only in this picker - show more below or filter by path.
        </p>
      ) : null}
      {helper ? <p className={`mt-1.5 text-[11px] leading-relaxed ${muted}`}>{helper}</p> : null}

      {hasMore ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={onShowMore}
            aria-label={`Show ${nextBatch} more paths in the list`}
            className={`group flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isDark
                ? 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-white/[0.12] hover:bg-white/[0.06]'
                : 'border-slate-200/90 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-y-0.5 ${muted}`} />
            Show {nextBatch} more in list
          </button>
          {showAllEnabled ? (
            <button
              type="button"
              disabled={busy}
              onClick={onShowAll}
              className={`mx-auto block text-[11px] transition-colors disabled:opacity-40 ${muted} ${
                isDark ? 'hover:text-slate-300' : 'hover:text-slate-700'
              }`}
            >
              Reveal all {totalCount} paths in list
            </button>
          ) : remaining > pageSize ? (
            <p className={`text-center text-[10px] leading-relaxed ${muted}`}>
              Very large project - reveal in batches of {pageSize}, or search by path.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function reviewFixSteps(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed
    .split(/\n+/)
    .map(line => line.replace(/^[\s•*–-]+/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  return lines.length > 1 ? lines : [trimmed];
}

function ReviewCodeSnippetBlock({
  snippet,
  isDark,
  muted,
  border,
}: {
  snippet: AIReviewCodeSnippet;
  isDark: boolean;
  muted: string;
  border: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-lg border font-mono text-[11px] leading-5 ${border} ${isDark ? 'border-white/[0.08] bg-[#0c0d0f] text-slate-300' : 'border-slate-200 bg-slate-950 text-slate-300'}`}>
      {snippet.lines.map((line, lineIndex) => {
        const lineNumber = snippet.startLine + lineIndex;
        const isFocus = lineNumber === snippet.focusLine;
        return (
          <div
            key={lineNumber}
            className={`flex min-w-max px-3 ${isFocus ? 'bg-blue-500/15 border-l-2 border-blue-400/80' : 'border-l-2 border-transparent'}`}
          >
            <span className={`mr-3 w-6 select-none text-right tabular-nums ${muted}`}>{lineNumber}</span>
            <code className="whitespace-pre">{line || ' '}</code>
          </div>
        );
      })}
    </div>
  );
}

function WhyFlaggedBlock({ text, titleText, isDark }: { text: string; titleText: string; isDark: boolean }) {
  return (
    <div>
      <h4 className={`text-[13px] font-medium ${titleText}`}>Why flagged</h4>
      <p className={`mt-2 text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{text}</p>
    </div>
  );
}

function RecommendedFixBlock({
  text,
  titleText,
  muted,
}: {
  text: string;
  titleText: string;
  muted: string;
}) {
  const steps = reviewFixSteps(text);
  if (!steps.length) return null;
  return (
    <div>
      <h4 className={`text-[13px] font-medium ${titleText}`}>Recommended fix</h4>
      {steps.length > 1 ? (
        <ul className={`mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed ${muted}`}>
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      ) : (
        <p className={`mt-2 text-[13px] leading-relaxed ${muted}`}>{steps[0]}</p>
      )}
    </div>
  );
}

function ResultDetailPane({
  item,
  result,
  sentFiles,
  showSentPayload,
  setShowSentPayload,
  expandedPayloadPath,
  setExpandedPayloadPath,
  isDark,
  titleText,
  muted,
  border,
  divide,
  onReset,
}: {
  item: { kind: 'summary' | 'static' | 'finding'; index?: number };
  result: AIReviewResult;
  sentFiles: QualityReviewSourceFile[];
  showSentPayload: boolean;
  setShowSentPayload: (open: boolean) => void;
  expandedPayloadPath: string | null;
  setExpandedPayloadPath: (path: string | null) => void;
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
  divide: string;
  onReset: () => void;
}) {
  const textAction = isDark ? 'text-xs font-medium text-blue-400 hover:text-blue-300' : 'text-xs font-medium text-blue-600 hover:text-blue-800';

  if (item.kind === 'summary') {
    return (
      <div className="space-y-4">
        <div>
          <p className={`text-xs ${muted}`}>AI review</p>
          <h3 className={`mt-0.5 text-[15px] font-medium ${titleText}`}>Summary</h3>
        </div>
        <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{result.summary}</p>
        {result.strengths.length > 0 ? (
          <div>
            <h4 className={`text-[13px] font-medium ${titleText}`}>Strengths</h4>
            <ul className={`mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed ${muted}`}>
              {result.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {result.limitations.length > 0 ? (
          <p className={`text-xs leading-relaxed ${muted}`}>Limits: {result.limitations.join(' · ')}</p>
        ) : null}
        <SentPayloadDetails
          files={sentFiles}
          showSentPayload={showSentPayload}
          setShowSentPayload={setShowSentPayload}
          expandedPayloadPath={expandedPayloadPath}
          setExpandedPayloadPath={setExpandedPayloadPath}
          isDark={isDark}
          titleText={titleText}
          muted={muted}
          border={border}
          divide={divide}
        />
        <button type="button" onClick={onReset} className={textAction}>
          Start a new review
        </button>
      </div>
    );
  }

  if (item.kind === 'static' && item.index !== undefined) {
    const note = result.staticFindingNotes[item.index];
    return (
      <div className="space-y-4">
        <div>
          <p className={`text-xs capitalize ${overviewSeverityLabel(isDark, note.assessment === 'disagree' ? 'critical' : note.assessment === 'nuance' ? 'warning' : 'optimization')}`}>
            Static finding · {note.assessment}
          </p>
          <h3 className={`mt-1 text-[15px] font-medium leading-snug ${titleText}`}>{note.staticTitle}</h3>
          {note.path ? (
            <p className={`mt-1 font-mono text-xs ${muted}`}>
              {note.path}
              {note.line ? `:${note.line}` : ''}
            </p>
          ) : null}
        </div>

        {note.blueprintDetail ? (
          <p className={`text-xs leading-relaxed ${muted}`}>{note.blueprintDetail}</p>
        ) : null}

        {note.codeSnippet ? (
          <ReviewCodeSnippetBlock snippet={note.codeSnippet} isDark={isDark} muted={muted} border={border} />
        ) : null}

        <WhyFlaggedBlock text={note.whyFlagged} titleText={titleText} isDark={isDark} />
        <RecommendedFixBlock text={note.recommendedFix} titleText={titleText} muted={muted} />

        {note.blueprintEvidence && note.blueprintEvidence.length > 0 ? (
          <div>
            <h4 className={`text-[13px] font-medium ${titleText}`}>blueprint studio evidence</h4>
            <ul className={`mt-2 space-y-1 font-mono text-[11px] leading-relaxed ${muted}`}>
              {note.blueprintEvidence.map((line, index) => (
                <li key={index} className="break-all">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (item.kind === 'finding' && item.index !== undefined) {
    const finding = result.findings[item.index];
    return (
      <div className="space-y-4">
        <div>
          <p className={`text-xs ${muted}`}>
            {finding.category || 'finding'}
            {' · '}
            <span className={overviewSeverityLabel(isDark, finding.severity === 'high' ? 'critical' : finding.severity === 'medium' ? 'warning' : 'optimization')}>
              {finding.severity} priority
            </span>
          </p>
          <h3 className={`mt-1 text-[15px] font-medium leading-snug ${titleText}`}>{finding.title}</h3>
          <p className={`mt-1 font-mono text-xs ${muted}`}>
            {finding.path}
            {finding.line ? `:${finding.line}` : ''}
          </p>
        </div>

        {finding.relatedStaticFinding ? (
          <p className={`text-xs ${isDark ? 'text-blue-300/90' : 'text-blue-700'}`}>Related static rule: {finding.relatedStaticFinding}</p>
        ) : null}

        {finding.codeSnippet ? (
          <ReviewCodeSnippetBlock snippet={finding.codeSnippet} isDark={isDark} muted={muted} border={border} />
        ) : null}

        <WhyFlaggedBlock text={finding.rationale} titleText={titleText} isDark={isDark} />
        <RecommendedFixBlock text={finding.recommendation} titleText={titleText} muted={muted} />
      </div>
    );
  }

  return (
    <div className={`flex min-h-[200px] flex-col items-center justify-center text-center ${muted}`}>
      <CheckCircle2 className="h-6 w-6 text-emerald-500/80" />
      <p className={`mt-2 text-sm ${titleText}`}>Review complete</p>
    </div>
  );
}
