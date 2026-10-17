import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FileCode2, Loader2, Sparkles } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getSuggestedAIReviewPaths,
  runQualityAIReview,
  type AIReviewResult,
} from '../../services/aiQualityReviewService';
import { getQualityReviewCandidatePaths, readQualityReviewSources } from '../../services/qualityReviewSourceService';
import type { QualityReviewSourceFile } from '../../services/qualityReviewSourceService';
import type { CodebaseAnalysis } from '../../types/codebase';
import { overviewBorderClass, overviewDivideClass, overviewPanelClass, overviewSeverityLabel } from './overviewUi';

interface AIReviewPanelProps {
  analysis: CodebaseAnalysis;
  /** Paths to pre-select (e.g. from “Review with AI” on a finding). */
  focusPaths?: string[];
  focusNote?: string;
  onFocusHandled?: () => void;
}

function severityEmphasis(severity: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
  return severity;
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

  const [expanded, setExpanded] = useState(true);
  const [aiReviewCandidates, setAIReviewCandidates] = useState<string[]>(() => getQualityReviewCandidatePaths(analysis));
  const [aiReviewSearch, setAIReviewSearch] = useState('');
  const [aiSelectedPaths, setAISelectedPaths] = useState<string[]>([]);
  const [aiReviewFiles, setAIReviewFiles] = useState<QualityReviewSourceFile[]>([]);
  const [aiReviewResult, setAIReviewResult] = useState<AIReviewResult | null>(null);
  const [aiReviewError, setAIReviewError] = useState<string | null>(null);
  const [isPreparingAIReview, setIsPreparingAIReview] = useState(false);
  const [isRunningAIReview, setIsRunningAIReview] = useState(false);
  const [activeFocusNote, setActiveFocusNote] = useState<string | undefined>();

  const suggestedPaths = useMemo(() => getSuggestedAIReviewPaths(analysis, 6), [analysis]);

  const matchingAIReviewCandidates = aiReviewCandidates.filter(path =>
    path.toLowerCase().includes(aiReviewSearch.trim().toLowerCase()),
  );

  useEffect(() => {
    setAIReviewCandidates(getQualityReviewCandidatePaths(analysis));
    setAIReviewSearch('');
    setAISelectedPaths([]);
    setAIReviewFiles([]);
    setAIReviewResult(null);
    setAIReviewError(null);
    setActiveFocusNote(undefined);
  }, [analysis.scannedAt]);

  useEffect(() => {
    if (!focusPaths?.length) return;
    const allowed = new Set(aiReviewCandidates);
    const next = focusPaths.filter(path => allowed.has(path)).slice(0, 6);
    if (next.length) {
      setAISelectedPaths(next);
      setExpanded(true);
      setActiveFocusNote(focusNote);
      setAIReviewFiles([]);
      setAIReviewResult(null);
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onFocusHandled?.();
  }, [focusPaths, focusNote, aiReviewCandidates, onFocusHandled]);

  const toggleAIReviewPath = (path: string) => {
    setAIReviewError(null);
    setAIReviewResult(null);
    setAIReviewFiles([]);
    setAISelectedPaths(current =>
      current.includes(path) ? current.filter(item => item !== path) : current.length < 6 ? [...current, path] : current,
    );
  };

  const applySuggestedPaths = () => {
    setAIReviewError(null);
    setAIReviewResult(null);
    setAIReviewFiles([]);
    setAISelectedPaths(suggestedPaths);
    setActiveFocusNote(undefined);
  };

  const prepareAIReview = async () => {
    setIsPreparingAIReview(true);
    setAIReviewError(null);
    setAIReviewResult(null);
    try {
      const files = await readQualityReviewSources(analysis, aiSelectedPaths);
      if (!files.length) throw new Error('None of the selected files could be read. Re-analyze the codebase and try again.');
      setAIReviewFiles(files);
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

  const busy = isPreparingAIReview || isRunningAIReview;

  return (
    <section ref={panelRef} id="quality-ai-review-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`border-b px-5 py-4 sm:px-6 ${border}`}>
        <button
          type="button"
          onClick={() => setExpanded(open => !open)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-[15px] font-medium ${titleText}`}>AI code review</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}
              >
                Optional
              </span>
            </div>
            <p className={`mt-0.5 max-w-2xl text-[13px] ${muted}`}>
              Second opinion on selected files — validates static findings and surfaces logic or security gaps rules miss.
              Does not change your score.
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''} ${muted}`} />
        </button>
        {isAiConfigured && (
          <p className={`mt-2 text-[11px] ${muted}`}>
            Model: {activeConfig.name} · {activeConfig.model}
          </p>
        )}
      </header>

      {expanded ? (
        <div className="px-5 py-4 sm:px-6">
          {!isAiConfigured ? (
            <div className={`rounded-xl border px-4 py-3 ${border} ${isDark ? 'bg-black/20' : 'bg-slate-50/80'}`}>
              <p className={`text-[13px] ${muted}`}>Connect an AI provider to run a review. Static analysis works without one.</p>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="mt-3 text-xs font-medium text-blue-500 hover:underline"
              >
                Open AI settings
              </button>
            </div>
          ) : !aiReviewCandidates.length ? (
            <p className={`text-[13px] ${muted}`}>
              No source file list in this saved scan. Re-analyze the project to enable AI review.
            </p>
          ) : (
            <>
              <div className={`rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${border} ${isDark ? 'bg-black/15' : 'bg-slate-50/60'}`}>
                You choose files locally first. Nothing is sent until you click{' '}
                <span className={titleText}>Send for AI review</span>. The request includes project context, related
                static findings, and the file preview below.
              </div>

              <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${divide}`}>
                <div>
                  <p className={`text-[13px] font-medium ${titleText}`}>Source files</p>
                  <p className={`text-xs ${muted}`}>Up to 6 files · {aiReviewCandidates.length} available</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={applySuggestedPaths}
                    disabled={busy}
                    className={`text-xs font-medium ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
                  >
                    Use suggested ({suggestedPaths.length})
                  </button>
                  <span className={`text-xs tabular-nums ${muted}`}>{aiSelectedPaths.length} / 6 selected</span>
                </div>
              </div>

              <div className="relative mt-3 max-w-md">
                <input
                  type="search"
                  value={aiReviewSearch}
                  onChange={e => setAIReviewSearch(e.target.value)}
                  placeholder="Filter by path…"
                  className={`w-full rounded-lg border py-1.5 px-3 text-xs outline-none ${
                    isDark
                      ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>

              <div className="mt-3 max-h-52 overflow-y-auto">
                <ul className={`divide-y ${divide}`}>
                  {matchingAIReviewCandidates.slice(0, 80).map(path => {
                    const selected = aiSelectedPaths.includes(path);
                    const disabled = !selected && aiSelectedPaths.length >= 6;
                    return (
                      <li key={path}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 py-2.5 pr-2 text-xs ${
                            disabled ? 'cursor-not-allowed opacity-45' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={disabled}
                            onChange={() => toggleAIReviewPath(path)}
                            className="rounded border-slate-400"
                          />
                          <FileCode2 className={`h-3.5 w-3.5 shrink-0 ${muted}`} />
                          <span className={`min-w-0 flex-1 truncate font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {path}
                          </span>
                          {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-blue-500" /> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {matchingAIReviewCandidates.length === 0 ? (
                  <p className={`py-4 text-center text-xs ${muted}`}>No paths match your filter.</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {aiReviewFiles.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void prepareAIReview()}
                    disabled={!aiSelectedPaths.length || busy}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${border} ${muted}`}
                  >
                    Refresh preview
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => (aiReviewFiles.length ? void runAIReview() : void prepareAIReview())}
                  disabled={(!aiSelectedPaths.length && !aiReviewFiles.length) || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isPreparingAIReview ? 'Preparing…' : isRunningAIReview ? 'Reviewing…' : aiReviewFiles.length ? 'Send for AI review' : 'Prepare preview'}
                </button>
                {(aiReviewFiles.length > 0 || aiReviewResult) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAIReviewFiles([]);
                      setAIReviewResult(null);
                      setAIReviewError(null);
                    }}
                    className={`text-xs ${muted}`}
                  >
                    Clear
                  </button>
                )}
              </div>

              {activeFocusNote ? (
                <p className={`mt-3 text-xs ${isDark ? 'text-blue-200/90' : 'text-blue-800'}`}>Focus: {activeFocusNote}</p>
              ) : null}

              {aiReviewFiles.length > 0 ? (
                <details className={`mt-4 rounded-xl border ${border}`}>
                  <summary className={`cursor-pointer px-4 py-2.5 text-xs font-medium ${titleText}`}>
                    Preview before send · {aiReviewFiles.reduce((n, f) => n + f.content.length, 0).toLocaleString()} chars
                  </summary>
                  <div className={`border-t px-4 py-3 ${divide}`}>
                    {aiReviewFiles.map(file => (
                      <details key={file.path} className="mb-2 last:mb-0">
                        <summary className={`cursor-pointer font-mono text-[11px] ${muted}`}>
                          {file.path}
                          {file.truncated ? ' · clipped' : ''}
                        </summary>
                        <pre
                          className={`mt-2 max-h-40 overflow-auto rounded-lg p-2 font-mono text-[11px] ${
                            isDark ? 'bg-black/30 text-slate-300' : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {file.content}
                        </pre>
                      </details>
                    ))}
                  </div>
                </details>
              ) : null}

              {aiReviewError ? (
                <p role="alert" className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                  {aiReviewError}
                </p>
              ) : null}

              {aiReviewResult ? (
                <div className={`mt-5 border-t pt-5 ${divide}`}>
                  <h3 className={`text-[13px] font-medium ${titleText}`}>Review result</h3>
                  <p className={`mt-2 text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {aiReviewResult.summary}
                  </p>

                  {aiReviewResult.strengths.length > 0 ? (
                    <div className="mt-4">
                      <p className={`text-xs font-medium uppercase tracking-wide ${muted}`}>Strengths</p>
                      <ul className={`mt-1.5 list-disc space-y-1 pl-4 text-[13px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {aiReviewResult.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {aiReviewResult.staticFindingNotes.length > 0 ? (
                    <div className="mt-4">
                      <p className={`text-xs font-medium uppercase tracking-wide ${muted}`}>Static findings — AI take</p>
                      <ul className={`mt-2 space-y-2 ${divide}`}>
                        {aiReviewResult.staticFindingNotes.map((item, i) => (
                          <li
                            key={i}
                            className={`rounded-lg border px-3 py-2.5 text-[13px] ${border} ${isDark ? 'bg-black/15' : 'bg-slate-50/50'}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`font-medium ${titleText}`}>{item.staticTitle}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                  item.assessment === 'agree'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : item.assessment === 'disagree'
                                      ? 'bg-rose-500/15 text-rose-600'
                                      : 'bg-amber-500/15 text-amber-700'
                                }`}
                              >
                                {item.assessment}
                              </span>
                            </div>
                            <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{item.note}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {aiReviewResult.findings.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <p className={`text-xs font-medium uppercase tracking-wide ${muted}`}>Additional findings</p>
                      {aiReviewResult.findings.map((finding, index) => (
                        <article key={`${finding.path}-${index}`} className={`rounded-xl border px-4 py-3 ${border}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h4 className={`text-[13px] font-medium ${titleText}`}>{finding.title}</h4>
                            <span className={`text-[10px] font-semibold uppercase ${overviewSeverityLabel(isDark, severityEmphasis(finding.severity))}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <p className={`mt-1 font-mono text-[11px] ${muted}`}>
                            {finding.path}
                            {finding.line ? `:${finding.line}` : ''}
                            {finding.category ? ` · ${finding.category}` : ''}
                          </p>
                          {finding.relatedStaticFinding ? (
                            <p className={`mt-1 text-[11px] ${isDark ? 'text-blue-200/80' : 'text-blue-700'}`}>
                              Extends static finding: {finding.relatedStaticFinding}
                            </p>
                          ) : null}
                          {finding.codeSnippet ? (
                            <div className={`mt-2 overflow-hidden rounded-lg border ${border}`}>
                              {finding.codeSnippet.lines.map((line, lineIndex) => {
                                const lineNumber = finding.codeSnippet!.startLine + lineIndex;
                                return (
                                  <div
                                    key={lineNumber}
                                    className={`flex font-mono text-[11px] leading-5 ${
                                      lineNumber === finding.codeSnippet!.focusLine
                                        ? isDark
                                          ? 'bg-blue-500/10 text-slate-100'
                                          : 'bg-blue-50 text-slate-900'
                                        : muted
                                    }`}
                                  >
                                    <span className="w-8 shrink-0 select-none pr-2 text-right opacity-60">{lineNumber}</span>
                                    <code className="whitespace-pre">{line || ' '}</code>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          <p className={`mt-2 text-[13px] leading-relaxed ${muted}`}>{finding.rationale}</p>
                          <p className={`mt-1.5 text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {finding.recommendation}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-3 text-[13px] ${muted}`}>No new file-specific findings beyond static notes.</p>
                  )}

                  {aiReviewResult.limitations.length > 0 ? (
                    <p className={`mt-4 text-[11px] ${muted}`}>Limits: {aiReviewResult.limitations.join(' · ')}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};
