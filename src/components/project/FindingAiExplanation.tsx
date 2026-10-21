import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import type { CodebaseAnalysis } from '../../types/codebase';
import {
  clearCachedFindingExplanation,
  clipSourceForExplanation,
  explainFinding,
  getCachedFindingExplanation,
  loadSourceSnippetForFinding,
  setCachedFindingExplanation,
  type FindingExplanation,
} from '../../services/explainFindingService';

export interface FindingAiExplanationProps {
  findingId: string;
  frameworkLabel: string;
  title: string;
  category?: string;
  severity?: string;
  impact: string;
  remediation: string;
  file?: string;
  focusLine?: number;
  codeSnippet?: string;
  analysis?: CodebaseAnalysis;
  /**
   * `toolbar` — chip for Overview action bars (pair with panel below).
   * `block` — standalone control for Quality detail (default).
   */
  variant?: 'toolbar' | 'block';
  triggerClassName?: string;
}

type FindingAiContextValue = {
  variant: 'toolbar' | 'block';
  triggerClassName?: string;
  loading: boolean;
  error: string | null;
  explanation: FindingExplanation | null;
  usedCode: boolean;
  isAiConfigured: boolean;
  file?: string;
  runExplain: (forceRefresh?: boolean) => void;
};

const FindingAiContext = createContext<FindingAiContextValue | null>(null);

function useFindingAi(): FindingAiContextValue {
  const ctx = useContext(FindingAiContext);
  if (!ctx) throw new Error('Finding AI components must be used within FindingAiProvider');
  return ctx;
}

function toolbarTriggerClass(isDark: boolean, active: boolean): string {
  if (active) {
    return isDark
      ? 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-sky-300'
      : 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-sky-700';
  }
  return isDark
    ? 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
}

function blockTriggerClass(isDark: boolean): string {
  return isDark
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
}

function ExplanationPanel({
  explanation,
  usedCode,
  isDark,
  loading,
  onRefresh,
}: {
  explanation: FindingExplanation;
  usedCode: boolean;
  isDark: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const body = isDark ? 'text-slate-300' : 'text-slate-700';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = isDark ? 'border-white/[0.08] bg-[#16181c]' : 'border-slate-200/90 bg-slate-50/80';

  const steps = explanation.whatToDo
    .split(/\n+/)
    .map(step => step.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
    .filter(Boolean);

  return (
    <div className={`overflow-hidden rounded-xl border ${panel}`}>
      <div
        className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${
          isDark ? 'border-white/[0.06]' : 'border-slate-200/80'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
              isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-800'
            }`}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            AI
          </span>
          <span className={`truncate text-[11px] ${muted}`}>
            {usedCode ? 'Grounded in your file' : 'From finding context'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium disabled:opacity-50 ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Refresh explanation"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        <section>
          <h4 className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>In this code</h4>
          <p className={`mt-1 text-xs leading-relaxed ${body}`}>{explanation.inThisCode}</p>
        </section>
        <section>
          <h4 className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>What this means</h4>
          <p className={`mt-1 text-xs leading-relaxed ${body}`}>{explanation.whatThisMeans}</p>
        </section>
        <section>
          <h4 className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Why it matters</h4>
          <p className={`mt-1 text-xs leading-relaxed ${body}`}>{explanation.whyItMatters}</p>
        </section>
        {steps.length > 0 ? (
          <section>
            <h4 className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>What to do</h4>
            <ol className={`mt-1.5 space-y-1.5 text-xs leading-relaxed ${body}`}>
              {steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span
                    className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-medium tabular-nums ${
                      isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-white text-slate-500 ring-1 ring-slate-200/80'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {explanation.simpleAnalogy ? (
          <section
            className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed ${
              isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-600 ring-1 ring-slate-200/70'
            }`}
          >
            <span className={`font-medium ${titleText}`}>Analogy · </span>
            {explanation.simpleAnalogy}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export const FindingAiProvider: React.FC<FindingAiExplanationProps & { children: React.ReactNode }> = ({
  children,
  findingId,
  frameworkLabel,
  title,
  category,
  severity,
  impact,
  remediation,
  file,
  focusLine,
  codeSnippet,
  analysis,
  variant = 'block',
  triggerClassName,
}) => {
  const { activeConfig, isAiConfigured, setIsSettingsOpen } = useAI();
  const [explanation, setExplanation] = useState<FindingExplanation | null>(
    () => getCachedFindingExplanation(frameworkLabel, findingId) || null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedCode, setUsedCode] = useState(false);

  useEffect(() => {
    setExplanation(getCachedFindingExplanation(frameworkLabel, findingId) || null);
    setError(null);
    setLoading(false);
  }, [frameworkLabel, findingId]);

  const runExplain = useCallback(
    async (forceRefresh = false) => {
      if (!isAiConfigured) {
        setIsSettingsOpen(true);
        return;
      }
      if (!forceRefresh) {
        const cached = getCachedFindingExplanation(frameworkLabel, findingId);
        if (cached) {
          setExplanation(cached);
          setError(null);
          return;
        }
      } else {
        clearCachedFindingExplanation(frameworkLabel, findingId);
      }
      setLoading(true);
      setError(null);
      try {
        let snippet: string | undefined;
        if (file && analysis) {
          snippet = await loadSourceSnippetForFinding(analysis, file, focusLine);
        }
        if (!snippet && codeSnippet?.trim()) {
          snippet =
            focusLine && !codeSnippet.includes('|')
              ? clipSourceForExplanation(codeSnippet, { focusLine }) || codeSnippet.trim()
              : codeSnippet.trim();
        }
        setUsedCode(Boolean(snippet));
        const result = await explainFinding(activeConfig, {
          frameworkLabel,
          title,
          category,
          severity,
          impact,
          remediation,
          file,
          focusLine,
          codeSnippet: snippet,
        });
        setCachedFindingExplanation(frameworkLabel, findingId, result);
        setExplanation(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not explain this finding.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      activeConfig,
      analysis,
      category,
      codeSnippet,
      file,
      findingId,
      focusLine,
      frameworkLabel,
      impact,
      isAiConfigured,
      remediation,
      setIsSettingsOpen,
      severity,
      title,
    ],
  );

  const value = useMemo<FindingAiContextValue>(
    () => ({
      variant,
      triggerClassName,
      loading,
      error,
      explanation,
      usedCode,
      isAiConfigured,
      file,
      runExplain: (forceRefresh = false) => {
        void runExplain(forceRefresh);
      },
    }),
    [variant, triggerClassName, loading, error, explanation, usedCode, isAiConfigured, file, runExplain],
  );

  return <FindingAiContext.Provider value={value}>{children}</FindingAiContext.Provider>;
};

/** Compact Explain chip — place inside the finding action toolbar. */
export const FindingAiTrigger: React.FC = () => {
  const { isDark } = useTheme();
  const { variant, triggerClassName, loading, explanation, isAiConfigured, file, runExplain } = useFindingAi();
  const hasExplanation = Boolean(explanation);

  const triggerLabel = loading
    ? 'Explaining…'
    : hasExplanation
      ? 'Explained'
      : isAiConfigured
        ? 'Explain'
        : 'Set up AI';

  return (
    <button
      type="button"
      onClick={() => runExplain(false)}
      disabled={loading}
      title={
        isAiConfigured
          ? file
            ? `Explain this finding using ${file}`
            : 'Explain this finding with AI'
          : 'Configure an AI provider to explain findings'
      }
      className={
        triggerClassName ||
        (variant === 'toolbar' ? toolbarTriggerClass(isDark, hasExplanation) : blockTriggerClass(isDark))
      }
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin opacity-80" aria-hidden />
      ) : (
        <Sparkles className="h-3 w-3 opacity-80" aria-hidden />
      )}
      {triggerLabel}
    </button>
  );
};

/** Explanation card / errors — place under the finding body. */
export const FindingAiPanel: React.FC<{ className?: string }> = ({ className }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const { loading, error, explanation, usedCode, isAiConfigured, file, variant, runExplain } = useFindingAi();

  return (
    <div className={className}>
      {variant === 'block' && !explanation && !error ? (
        <p className={`mb-2 text-[11px] ${muted}`}>
          {!isAiConfigured
            ? 'Configure AI in settings to explain findings.'
            : file
              ? `Uses \`${file}\` when available.`
              : 'Uses the finding context.'}
        </p>
      ) : null}

      {error ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
            isDark ? 'border-rose-500/25 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => runExplain(true)}
            className="shrink-0 font-medium underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {explanation ? (
        <div className={error ? 'mt-2' : undefined}>
          <ExplanationPanel
            explanation={explanation}
            usedCode={usedCode}
            isDark={isDark}
            loading={loading}
            onRefresh={() => runExplain(true)}
          />
        </div>
      ) : null}
    </div>
  );
};

/** Convenience wrapper for Quality detail (trigger + panel together). */
export const FindingAiExplanation: React.FC<FindingAiExplanationProps> = props => {
  const variant = props.variant || 'block';
  return (
    <FindingAiProvider {...props} variant={variant}>
      <div className={variant === 'block' ? 'mt-3' : undefined}>
        {variant === 'block' ? (
          <div className="mb-2">
            <FindingAiTrigger />
          </div>
        ) : (
          <FindingAiTrigger />
        )}
        <FindingAiPanel />
      </div>
    </FindingAiProvider>
  );
};

/** Static labels for impact / remediation so rows aren’t two unlabeled blobs. */
export function FindingStaticCopy({
  impact,
  remediation,
}: {
  impact: string;
  remediation: string;
}) {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const body = isDark ? 'text-slate-300' : 'text-slate-700';

  return (
    <>
      <p className={`mt-3 text-[11px] font-medium ${muted}`}>Why we flagged this</p>
      <p className={`mt-1 text-xs leading-relaxed ${body}`}>{impact}</p>
      <p className={`mt-2.5 text-[11px] font-medium ${muted}`}>Suggested fix</p>
      <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{remediation}</p>
    </>
  );
}
