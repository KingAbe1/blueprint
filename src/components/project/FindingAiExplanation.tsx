import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useTheme } from '../../context/ThemeContext';
import {
  clearCachedFindingExplanation,
  explainFinding,
  getCachedFindingExplanation,
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
  /** Optional clipped source already prepared by the caller. */
  codeSnippet?: string;
}

function explainButtonClass(isDark: boolean): string {
  return isDark
    ? 'inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900 disabled:cursor-not-allowed disabled:opacity-50';
}

export const FindingAiExplanation: React.FC<FindingAiExplanationProps> = ({
  findingId,
  frameworkLabel,
  title,
  category,
  severity,
  impact,
  remediation,
  file,
  codeSnippet,
}) => {
  const { isDark } = useTheme();
  const { activeConfig, isAiConfigured, setIsSettingsOpen } = useAI();
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const body = isDark ? 'text-slate-300' : 'text-slate-700';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';

  const [explanation, setExplanation] = useState<FindingExplanation | null>(
    () => getCachedFindingExplanation(frameworkLabel, findingId) || null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExplanation(getCachedFindingExplanation(frameworkLabel, findingId) || null);
    setError(null);
    setLoading(false);
  }, [frameworkLabel, findingId]);

  const runExplain = useCallback(async (forceRefresh = false) => {
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
      const result = await explainFinding(activeConfig, {
        frameworkLabel,
        title,
        category,
        severity,
        impact,
        remediation,
        file,
        codeSnippet,
      });
      setCachedFindingExplanation(frameworkLabel, findingId, result);
      setExplanation(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not explain this finding.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    activeConfig,
    category,
    codeSnippet,
    file,
    findingId,
    frameworkLabel,
    impact,
    isAiConfigured,
    remediation,
    setIsSettingsOpen,
    severity,
    title,
  ]);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => void runExplain(Boolean(explanation))}
          disabled={loading}
          className={explainButtonClass(isDark)}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Explaining…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              {explanation ? 'Refresh explanation' : isAiConfigured ? 'Explain' : 'Explain (set up AI)'}
            </>
          )}
        </button>
        {!isAiConfigured ? (
          <span className={`text-[11px] ${muted}`}>Uses your AI settings to rewrite this in plain language.</span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2">
          <p className={`text-xs ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{error}</p>
          <button
            type="button"
            onClick={() => void runExplain()}
            className={`mt-1 text-xs font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
          >
            Retry
          </button>
        </div>
      ) : null}

      {explanation ? (
        <div
          className={`mt-3 space-y-3 rounded-xl border px-3.5 py-3 ${
            isDark ? 'border-violet-500/20 bg-violet-500/[0.06]' : 'border-violet-200/80 bg-violet-50/60'
          }`}
        >
          <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>Plain-language explanation</p>

          <div>
            <p className={`text-[11px] font-medium ${titleText}`}>What this means</p>
            <p className={`mt-1 text-xs leading-relaxed ${body}`}>{explanation.whatThisMeans}</p>
          </div>

          <div>
            <p className={`text-[11px] font-medium ${titleText}`}>Why it matters</p>
            <p className={`mt-1 text-xs leading-relaxed ${body}`}>{explanation.whyItMatters}</p>
          </div>

          <div>
            <p className={`text-[11px] font-medium ${titleText}`}>What to do</p>
            <ul className={`mt-1 space-y-1 text-xs leading-relaxed ${body}`}>
              {explanation.whatToDo
                .split(/\n+/)
                .map(step => step.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
                .filter(Boolean)
                .map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className={`shrink-0 tabular-nums ${muted}`}>{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
            </ul>
          </div>

          {explanation.simpleAnalogy ? (
            <div>
              <p className={`text-[11px] font-medium ${titleText}`}>Analogy</p>
              <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{explanation.simpleAnalogy}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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
