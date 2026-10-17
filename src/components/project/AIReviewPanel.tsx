import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Search } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getSuggestedAIReviewPaths,
  runQualityAIReview,
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

type ReviewStep = 1 | 2 | 3;

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
  const [isPreparingAIReview, setIsPreparingAIReview] = useState(false);
  const [isRunningAIReview, setIsRunningAIReview] = useState(false);
  const [activeFocusNote, setActiveFocusNote] = useState<string | undefined>();
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [expandedPreviewPath, setExpandedPreviewPath] = useState<string | null>(null);

  const suggestedPaths = useMemo(() => getSuggestedAIReviewPaths(analysis, 6), [analysis]);
  const busy = isPreparingAIReview || isRunningAIReview;

  const step: ReviewStep = aiReviewResult ? 3 : aiReviewFiles.length ? 2 : 1;

  const matchingAIReviewCandidates = aiReviewCandidates.filter(path =>
    path.toLowerCase().includes(aiReviewSearch.trim().toLowerCase()),
  );

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
  }, [analysis.scannedAt]);

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
      setSelectedResultIndex(0);
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

  const prepareAIReview = async () => {
    setIsPreparingAIReview(true);
    setAIReviewError(null);
    setAIReviewResult(null);
    setShowResults(false);
    try {
      const files = await readQualityReviewSources(analysis, aiSelectedPaths);
      if (!files.length) throw new Error('None of the selected files could be read. Re-analyze the codebase and try again.');
      setAIReviewFiles(files);
      setExpandedPreviewPath(files[0]?.path ?? null);
    } catch (error) {
      setAIReviewError(error instanceof Error ? error.message : 'Could not prepare selected files for review.');
    } finally {
      setIsPreparingAIReview(false);
    }
  };

  const runAIReview = async () => {
    if (!isAiConfigured || !aiReviewFiles.length) return;
    setIsRunningAIReview(true);
    setAIReviewError(null);
    try {
      setAIReviewResult(await runQualityAIReview(activeConfig, analysis, aiReviewFiles, activeFocusNote));
    } catch (error) {
      setAIReviewError(error instanceof Error ? error.message : 'The AI review failed. Please try again.');
    } finally {
      setIsRunningAIReview(false);
    }
  };

  const stepClass = (n: ReviewStep) => {
    const active = step === n;
    const done = step > n;
    return active
      ? isDark
        ? 'text-slate-100'
        : 'text-slate-900'
      : done
        ? isDark
          ? 'text-slate-400'
          : 'text-slate-600'
        : muted;
  };

  const actionButtonClass = `inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
    isDark
      ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
      : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
  }`;

  const textAction = isDark ? 'text-xs font-medium text-blue-400 hover:text-blue-300' : 'text-xs font-medium text-blue-600 hover:text-blue-800';

  return (
    <section ref={panelRef} id="quality-ai-review-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`border-b px-5 py-4 sm:px-6 ${border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`text-[15px] font-medium ${titleText}`}>AI code review</h2>
            <p className={`mt-0.5 max-w-2xl text-[13px] ${muted}`}>
              Optional second opinion on files you choose. Validates static findings and adds logic or security notes — does
              not change your score.
            </p>
          </div>
          {isAiConfigured ? (
            <p className={`text-[11px] tabular-nums ${muted}`}>
              {activeConfig.name} · {activeConfig.model}
            </p>
          ) : null}
        </div>

        {isAiConfigured && aiReviewCandidates.length > 0 ? (
          <ol className={`mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[11px] ${border} border-t pt-3`}>
            <li className={stepClass(1)}>
              <span className="font-medium">1.</span> Select files
              {aiSelectedPaths.length ? ` (${aiSelectedPaths.length}/6)` : ''}
            </li>
            <li className={stepClass(2)}>
              <span className="font-medium">2.</span> Local preview
            </li>
            <li className={stepClass(3)}>
              <span className="font-medium">3.</span> AI review
            </li>
          </ol>
        ) : null}
      </header>

      {!isAiConfigured ? (
        <div className="px-5 py-8 sm:px-6">
          <p className={`text-[13px] ${muted}`}>Connect an AI provider to run a review. Static analysis works without one.</p>
          <button type="button" onClick={() => setIsSettingsOpen(true)} className={`mt-3 ${textAction}`}>
            Open AI settings
          </button>
        </div>
      ) : !aiReviewCandidates.length ? (
        <div className="px-5 py-8 text-center sm:px-6">
          <p className={`text-[13px] ${muted}`}>Re-analyze this project to enable file selection for AI review.</p>
        </div>
      ) : (
        <>
          <div className={`border-b px-5 py-3 sm:px-6 ${border}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
                <input
                  type="search"
                  value={aiReviewSearch}
                  onChange={e => setAIReviewSearch(e.target.value)}
                  placeholder="Filter paths…"
                  disabled={showResults && Boolean(aiReviewResult)}
                  className={`w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none disabled:opacity-50 ${
                    isDark
                      ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
                      : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400'
                  }`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showResults && aiReviewResult ? (
                  <button type="button" onClick={() => setShowResults(false)} className={textAction}>
                    Change files
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={applySuggestedPaths} disabled={busy} className={textAction}>
                      Use suggested ({suggestedPaths.length})
                    </button>
                    {aiSelectedPaths.length > 0 ? (
                      <button type="button" onClick={() => setAISelectedPaths([])} disabled={busy} className={`text-xs ${muted}`}>
                        Clear selection
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <p className={`mt-2 text-xs tabular-nums ${muted}`}>
              {showResults && aiReviewResult
                ? `${resultListItems.length} review sections`
                : `${matchingAIReviewCandidates.length} paths · ${aiSelectedPaths.length} of 6 selected`}
            </p>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 lg:divide-x ${divide}`}>
            <div className="lg:col-span-5 max-h-[480px] overflow-y-auto">
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
                            className={`w-full py-3.5 pr-5 text-left sm:pr-6 ${
                              isSelected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                            } ${overviewRowEmphasis(isDark, isSelected ? 'info' : 'neutral')}`}
                          >
                            <p className={`text-[13px] font-medium ${titleText}`}>Summary</p>
                            <p className={`mt-1 truncate text-xs ${muted}`}>Overview and strengths</p>
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
                            className={`w-full py-3.5 pr-5 text-left sm:pr-6 ${
                              isSelected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                            } ${overviewRowEmphasis(isDark, isSelected ? 'info' : staticAssessmentLabel(note.assessment))}`}
                          >
                            <p className={`text-[13px] leading-snug ${titleText}`}>{note.staticTitle}</p>
                            <p className={`mt-1 text-xs capitalize ${overviewSeverityLabel(isDark, note.assessment === 'disagree' ? 'critical' : note.assessment === 'nuance' ? 'warning' : 'optimization')}`}>
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
                          className={`w-full py-3.5 pr-5 text-left sm:pr-6 ${
                            isSelected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                          } ${overviewRowEmphasis(isDark, isSelected ? 'info' : aiSeverityEmphasis(finding.severity))}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] leading-snug ${titleText}`}>{finding.title}</p>
                            <span className={`shrink-0 text-[11px] uppercase ${overviewSeverityLabel(isDark, finding.severity === 'high' ? 'critical' : finding.severity === 'medium' ? 'warning' : 'optimization')}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <p className={`mt-1 truncate font-mono text-xs ${muted}`}>
                            {finding.path}
                            {finding.line ? `:${finding.line}` : ''}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className={`divide-y ${divide}`}>
                  {matchingAIReviewCandidates.slice(0, 100).map(path => {
                    const selected = aiSelectedPaths.includes(path);
                    const disabled = !selected && aiSelectedPaths.length >= 6;
                    const fileName = path.split('/').pop() || path;
                    return (
                      <li key={path}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleAIReviewPath(path)}
                          className={`w-full py-3.5 pr-5 text-left transition-colors sm:pr-6 disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
                          } ${overviewRowEmphasis(isDark, selected ? 'info' : 'neutral')}`}
                        >
                          <p className={`text-[13px] ${selected ? `font-medium ${titleText}` : titleText}`}>{fileName}</p>
                          <p className={`mt-1 truncate font-mono text-xs ${muted}`} title={path}>
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
              )}
            </div>

            <div className="lg:col-span-7 max-h-[480px] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {showResults && aiReviewResult && selectedResultItem ? (
                <ResultDetailPane
                  item={selectedResultItem}
                  result={aiReviewResult}
                  isDark={isDark}
                  titleText={titleText}
                  muted={muted}
                  border={border}
                  onReset={resetReview}
                />
              ) : (
                <SetupDetailPane
                  aiSelectedPaths={aiSelectedPaths}
                  aiReviewFiles={aiReviewFiles}
                  activeFocusNote={activeFocusNote}
                  expandedPreviewPath={expandedPreviewPath}
                  setExpandedPreviewPath={setExpandedPreviewPath}
                  busy={busy}
                  isPreparingAIReview={isPreparingAIReview}
                  isRunningAIReview={isRunningAIReview}
                  aiReviewError={aiReviewError}
                  actionButtonClass={actionButtonClass}
                  textAction={textAction}
                  isDark={isDark}
                  titleText={titleText}
                  muted={muted}
                  border={border}
                  divide={divide}
                  onPrepare={() => void prepareAIReview()}
                  onRun={() => void runAIReview()}
                  onRefreshPreview={() => void prepareAIReview()}
                  onReset={resetReview}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

function SetupDetailPane({
  aiSelectedPaths,
  aiReviewFiles,
  activeFocusNote,
  expandedPreviewPath,
  setExpandedPreviewPath,
  busy,
  isPreparingAIReview,
  isRunningAIReview,
  aiReviewError,
  actionButtonClass,
  textAction,
  isDark,
  titleText,
  muted,
  border,
  divide,
  onPrepare,
  onRun,
  onRefreshPreview,
  onReset,
}: {
  aiSelectedPaths: string[];
  aiReviewFiles: QualityReviewSourceFile[];
  activeFocusNote?: string;
  expandedPreviewPath: string | null;
  setExpandedPreviewPath: (path: string | null) => void;
  busy: boolean;
  isPreparingAIReview: boolean;
  isRunningAIReview: boolean;
  aiReviewError: string | null;
  actionButtonClass: string;
  textAction: string;
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
  divide: string;
  onPrepare: () => void;
  onRun: () => void;
  onRefreshPreview: () => void;
  onReset: () => void;
}) {
  if (!aiSelectedPaths.length) {
    return (
      <div className={`flex min-h-[200px] flex-col items-center justify-center text-center ${muted}`}>
        <p className={`text-sm font-medium ${titleText}`}>Select source files</p>
        <p className="mt-0.5 max-w-sm text-xs">Pick up to six paths from the list, or use suggested files from static findings.</p>
      </div>
    );
  }

  const previewChars = aiReviewFiles.reduce((n, f) => n + f.content.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className={`text-xs ${muted}`}>Review setup</p>
        <h3 className={`mt-0.5 text-[15px] font-medium ${titleText}`}>
          {aiReviewFiles.length ? 'Preview ready' : `${aiSelectedPaths.length} file${aiSelectedPaths.length === 1 ? '' : 's'} selected`}
        </h3>
        <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
          Files are read locally first. Nothing is sent to your AI provider until you confirm below.
        </p>
      </div>

      {activeFocusNote ? (
        <div className={`rounded-lg border px-3 py-2.5 text-[13px] ${border} ${overviewRowEmphasis(isDark, 'info')}`}>
          <p className={`text-xs font-medium ${titleText}`}>Focus</p>
          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{activeFocusNote}</p>
        </div>
      ) : null}

      <ul className={`divide-y rounded-lg border ${divide} ${border}`}>
        {(aiReviewFiles.length ? aiReviewFiles.map(f => f.path) : aiSelectedPaths).map(path => (
          <li key={path} className="px-3 py-2 font-mono text-[11px] truncate" title={path}>
            {path}
          </li>
        ))}
      </ul>

      {aiReviewFiles.length > 0 ? (
        <div>
          <p className={`text-xs ${muted}`}>
            Preview · {previewChars.toLocaleString()} characters
            {aiReviewFiles.some(f => f.truncated) ? ' · some files clipped to review limits' : ''}
          </p>
          <ul className={`mt-2 divide-y rounded-lg border ${divide} ${border}`}>
            {aiReviewFiles.map(file => {
              const open = expandedPreviewPath === file.path;
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => setExpandedPreviewPath(open ? null : file.path)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`truncate font-mono ${titleText}`}>{file.path}</span>
                    <span className={`shrink-0 ${muted}`}>{open ? 'Hide' : 'Show'}</span>
                  </button>
                  {open ? (
                    <pre
                      className={`max-h-44 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed ${border} ${
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
        </div>
      ) : null}

      {aiReviewError ? (
        <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
          {aiReviewError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        {aiReviewFiles.length ? (
          <>
            <button type="button" onClick={onRun} disabled={busy} className={actionButtonClass}>
              {isRunningAIReview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isRunningAIReview ? 'Reviewing…' : 'Send for AI review'}
            </button>
            <button type="button" onClick={onRefreshPreview} disabled={busy} className={textAction}>
              Refresh preview
            </button>
          </>
        ) : (
          <button type="button" onClick={onPrepare} disabled={busy} className={actionButtonClass}>
            {isPreparingAIReview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isPreparingAIReview ? 'Preparing…' : 'Prepare local preview'}
          </button>
        )}
        {aiReviewFiles.length ? (
          <button type="button" onClick={onReset} disabled={busy} className={`text-xs ${muted}`}>
            Clear preview
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ResultDetailPane({
  item,
  result,
  isDark,
  titleText,
  muted,
  border,
  onReset,
}: {
  item: { kind: 'summary' | 'static' | 'finding'; index?: number };
  result: AIReviewResult;
  isDark: boolean;
  titleText: string;
  muted: string;
  border: string;
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
        <button type="button" onClick={onReset} className={textAction}>
          Start a new review
        </button>
      </div>
    );
  }

  if (item.kind === 'static' && item.index !== undefined) {
    const note = result.staticFindingNotes[item.index];
    return (
      <div className="space-y-3">
        <div>
          <p className={`text-xs capitalize ${overviewSeverityLabel(isDark, note.assessment === 'disagree' ? 'critical' : note.assessment === 'nuance' ? 'warning' : 'optimization')}`}>
            Static finding · {note.assessment}
          </p>
          <h3 className={`mt-1 text-[15px] font-medium leading-snug ${titleText}`}>{note.staticTitle}</h3>
        </div>
        <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{note.note}</p>
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
          <div className={`overflow-x-auto rounded-lg border font-mono text-[11px] leading-5 ${border} ${isDark ? 'border-white/[0.08] bg-[#0c0d0f] text-slate-300' : 'border-slate-200 bg-slate-950 text-slate-300'}`}>
            {finding.codeSnippet.lines.map((line, lineIndex) => {
              const lineNumber = finding.codeSnippet!.startLine + lineIndex;
              const isFocus = lineNumber === finding.codeSnippet!.focusLine;
              return (
                <div key={lineNumber} className={`flex min-w-max px-3 ${isFocus ? 'bg-blue-500/15 border-l-2 border-blue-400/80' : 'border-l-2 border-transparent'}`}>
                  <span className={`mr-3 w-6 select-none text-right tabular-nums ${muted}`}>{lineNumber}</span>
                  <code className="whitespace-pre">{line || ' '}</code>
                </div>
              );
            })}
          </div>
        ) : null}

        <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{finding.rationale}</p>
        <div>
          <h4 className={`text-[13px] font-medium ${titleText}`}>Suggested next step</h4>
          <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>{finding.recommendation}</p>
        </div>
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
