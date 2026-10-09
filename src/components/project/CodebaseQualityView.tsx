import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Gauge, Lightbulb, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { CodebaseAnalysis } from '../../types/codebase';
import { AIReviewPanel } from './AIReviewPanel';

interface CodebaseQualityViewProps {
  analysis: CodebaseAnalysis;
  onRescan: () => Promise<void>;
  isRescanning: boolean;
}

export const CodebaseQualityView: React.FC<CodebaseQualityViewProps> = ({ analysis, onRescan, isRescanning }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';
  const [qualityPriorityFilter, setQualityPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const qualityFindings = analysis.quality?.findings || [];
  const omittedQualityFindings = analysis.quality?.findingsOmitted || 0;
  const totalQualityFindings = qualityFindings.length + omittedQualityFindings;
  const visibleQualityFindings = qualityPriorityFilter === 'all' ? qualityFindings : qualityFindings.filter(finding => finding.priority === qualityPriorityFilter);
  const highPriorityCount = qualityFindings.filter(finding => finding.priority === 'high').length;
  const mediumPriorityCount = qualityFindings.filter(finding => finding.priority === 'medium').length;
  const lowPriorityCount = qualityFindings.filter(finding => finding.priority === 'low').length;

  return (
    <>{analysis.quality ? <>
          <section className={`mb-4 rounded-2xl border p-5 sm:p-6 ${panel}`}>
            <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
              <div className="flex items-center gap-4">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-[7px]" style={{ background: `conic-gradient(${analysis.quality.score >= 80 ? '#10b981' : analysis.quality.score >= 60 ? '#3b82f6' : '#f59e0b'} ${analysis.quality.score * 3.6}deg, ${isDark ? '#ffffff18' : '#e2e8f0'} 0deg)` }}>
                  <div className={`flex h-full w-full flex-col items-center justify-center rounded-full ${isDark ? 'bg-[#141518]' : 'bg-white'}`}>
                    <span className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>{analysis.quality.score}</span>
                    <span className={`text-[9px] ${muted}`}>out of 100</span>
                  </div>
                </div>
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Static quality score</p>
                  <h3 className={`mt-1 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.quality.score >= 80 ? 'Healthy signals' : analysis.quality.score >= 60 ? 'Room to improve' : 'Needs attention'}</h3>
                  <p className={`mt-1 text-[10px] ${muted}`}>{analysis.quality.confidence} confidence · based on {analysis.quality.analyzedSourceFiles} source files</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { value: highPriorityCount.toLocaleString(), label: 'high-priority items' },
                  { value: totalQualityFindings.toLocaleString(), label: 'findings to review' },
                  { value: analysis.quality.analyzedSourceFiles.toLocaleString(), label: 'source files scanned' },
                ].map(metric => <div key={metric.label} className={`rounded-xl px-3 py-3 ${isDark ? 'bg-white/[0.035]' : 'bg-slate-50'}`}>
                  <p className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{metric.value}</p>
                  <p className={`mt-0.5 text-[9px] ${muted}`}>{metric.label}</p>
                </div>)}
              </div>
            </div>
            <p className={`mt-4 flex items-start gap-2 border-t pt-3 text-[10px] leading-4 ${isDark ? 'border-white/[0.07] text-slate-400' : 'border-slate-100 text-slate-500'}`}>
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />The first deep code profile covers Next.js JavaScript/TypeScript: syntax, complexity, duplication, imports, and selected correctness and risk patterns. Other languages receive general repository checks but do not yet have dedicated source-level profiles. Blueprint does not run project tests, type-checkers, or linters, and this score is not a complete security audit.
            </p>
            {(analysis.quality.deepAnalysis?.skippedJavaScriptFiles || 0) > 0 && <p className={`mt-2 text-[10px] ${muted}`}>{analysis.quality.deepAnalysis?.skippedJavaScriptFiles} JavaScript/TypeScript files were beyond the parser limit and were not AST-reviewed.</p>}
          </section>

          <details className={`mb-4 rounded-2xl border p-5 ${panel}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-blue-500" /><div><h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Score details</h3><p className={`mt-0.5 text-[10px] ${muted}`}>What each score means and where to focus next.</p></div></div><ChevronDown className={`h-4 w-4 ${muted}`} /></summary>
            <p className={`mt-3 rounded-lg px-3 py-2 text-[10px] leading-4 ${isDark ? 'bg-white/[0.025] text-slate-400' : 'bg-slate-50 text-slate-600'}`}>Scores use language-specific signals where available and are normalized over assessed areas. “Not assessed” means Blueprint lacks a supported check for that code; it does not count as a pass. This is not a full quality or security audit.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {analysis.quality.dimensions.map(dimension => {
                const percent = dimension.maxScore ? Math.round((dimension.score / dimension.maxScore) * 100) : 0;
                const categoryByDimension: Record<string, NonNullable<(typeof qualityFindings)[number]['category']>> = {
                  Tests: 'testing',
                  'Code maintainability': 'maintainability',
                  'Folder structure': 'structure',
                  'CI checks': 'delivery',
                  Documentation: 'documentation',
                  'Security risks': 'security',
                  'Code correctness': 'correctness',
                };
                const relatedFinding = qualityFindings.find(finding => finding.category === categoryByDimension[dimension.name]);
                const nextStepByDimension: Record<string, string> = {
                  Tests: 'Add or expand tests around an important user flow or business rule.',
                  'Code maintainability': 'Review complexity, duplication, large files, and unfinished TODOs.',
                  'Folder structure': 'Keep related code grouped around clear features or layers.',
                  'CI checks': 'Have CI run the project’s tests and production build on changes.',
                  Documentation: 'Document setup, run, and test steps so a new contributor can get started.',
                  'Security risks': 'Inspect flagged snippets and trace how input reaches the risky operation.',
                  'Code correctness': 'Review Next.js App Router findings, then run the project’s build and configured checks.',
                };
                const isRiskDimension = dimension.name === 'Security risks' || dimension.name === 'Code correctness';
                const status = dimension.assessmentStatus === 'not-assessed'
                  ? 'Not assessed'
                  : dimension.assessmentStatus === 'partial'
                    ? 'Partial coverage'
                    : isRiskDimension
                      ? dimension.assessmentStatus === 'reviewed' ? 'Static pattern review' : percent >= 80 ? 'Few signals flagged' : percent >= 50 ? 'Some signals flagged' : 'Review flagged signals'
                      : percent >= 80 ? 'Strong signals' : percent >= 50 ? 'Partial signals' : 'Needs attention';
                const statusTone = dimension.assessmentStatus === 'not-assessed'
                  ? (isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500')
                  : dimension.assessmentStatus === 'partial'
                    ? (isDark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-700')
                    : percent >= 80
                  ? (isDark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                  : percent >= 50
                    ? (isDark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-700')
                    : (isDark ? 'bg-rose-400/10 text-rose-300' : 'bg-rose-50 text-rose-700');
                return <div key={dimension.name} className={`rounded-xl border p-3.5 ${isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{dimension.name}</p><span className={`font-mono text-[10px] ${muted}`}>{dimension.maxScore ? `${dimension.score}/${dimension.maxScore}` : '—'}</span></div>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[8px] font-semibold ${statusTone}`}>{status}</span>
                  {dimension.maxScore > 0 && <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`}><div className={`h-full rounded-full ${dimension.assessmentStatus === 'not-assessed' ? 'bg-slate-400' : percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} /></div>}
                  <p className={`mt-2 text-[10px] leading-4 ${muted}`}>{dimension.summary}</p>
                  <div className={`mt-3 border-t pt-2.5 ${isDark ? 'border-white/[0.06]' : 'border-slate-200/80'}`}>
                    <p className={`text-[8px] font-semibold uppercase tracking-wide ${muted}`}>{relatedFinding ? `Review finding: ${relatedFinding.title}` : 'Suggested focus'}</p>
                    <p className={`mt-1 text-[10px] leading-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{relatedFinding?.detail || nextStepByDimension[dimension.name] || 'Review the available findings for a focused next step.'}</p>
                  </div>
                </div>;
              })}
            </div>
          </details>

          <details className={`mb-4 rounded-2xl border p-5 ${panel}`}>
            <summary className="flex list-none cursor-pointer items-center justify-between gap-3">
              <div>
                <p className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Recommended next step</p>
                <h3 className={`mt-1 text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Review findings</h3>
                <p className={`mt-1 text-xs ${muted}`}>Findings are signals to investigate, not confirmed defects.</p>
              </div>
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${isDark ? 'bg-rose-400/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>High {highPriorityCount}</span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${isDark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-700'}`}>Medium {mediumPriorityCount}</span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-700'}`}>Low {lowPriorityCount}</span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-medium ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{totalQualityFindings} total</span>
                <ChevronDown className={`ml-0.5 h-4 w-4 ${muted}`} />
              </div>
            </summary>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter findings by priority">
              {(['all', 'high', 'medium', 'low'] as const).map(priority => {
                const count = priority === 'all' ? qualityFindings.length : qualityFindings.filter(finding => finding.priority === priority).length;
                const selected = qualityPriorityFilter === priority;
                return <button key={priority} type="button" onClick={() => setQualityPriorityFilter(priority)} aria-pressed={selected} className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium capitalize transition-colors ${selected ? (isDark ? 'border-blue-300/30 bg-blue-400/15 text-blue-100' : 'border-blue-200 bg-blue-50 text-blue-800') : (isDark ? 'border-white/[0.08] text-slate-400 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}`}>
                  {priority} <span className="ml-1 opacity-70">{count}</span>
                </button>;
              })}
            </div>
            {omittedQualityFindings > 0 && <p className={`mt-3 rounded-lg border px-3 py-2 text-[10px] leading-4 ${isDark ? 'border-amber-300/15 bg-amber-300/[0.04] text-amber-100/80' : 'border-amber-200 bg-amber-50/70 text-amber-900'}`}>
              Showing the 50 highest-priority findings of {totalQualityFindings}. {omittedQualityFindings} additional findings are omitted from this view; priority filters apply to the findings shown.
            </p>}
            <div className="mt-3 space-y-2">
              {visibleQualityFindings.map((finding, index) => <details key={`${finding.ruleId || finding.title}-${index}`} className={`group rounded-xl border p-4 ${isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                <summary className="flex cursor-pointer list-none items-start gap-3">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${finding.priority === 'high' ? (isDark ? 'bg-rose-400/10 text-rose-300' : 'bg-rose-50 text-rose-600') : finding.priority === 'medium' ? (isDark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-50 text-amber-600') : (isDark ? 'bg-blue-400/10 text-blue-300' : 'bg-blue-50 text-blue-600')}`}>
                    {finding.priority === 'high' ? <AlertTriangle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{finding.title}</h4>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${finding.priority === 'high' ? 'bg-rose-500/10 text-rose-500' : finding.priority === 'medium' ? 'bg-amber-500/10 text-amber-600' : isDark ? 'bg-blue-400/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{finding.priority} priority</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-medium uppercase tracking-wide ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{finding.category || 'quality'}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>{finding.confidence || 'medium'} confidence</span>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>{finding.source === 'project-tool' ? 'project tool' : 'Blueprint static'}</span>
                    </div>
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition-transform group-open:rotate-180 ${muted}`} />
                </summary>
                <div className={`ml-10 mt-3 border-t pt-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
                  <p className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{finding.detail}</p>
                  {finding.codeSnippet && <div className={`mt-3 overflow-hidden rounded-lg border ${isDark ? 'border-white/[0.07] bg-[#0c0d0f]' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`border-b px-3 py-2 text-[10px] font-medium ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-200 text-slate-500'}`}>Code context · line {finding.codeSnippet.focusLine}</p>
                    <div className="overflow-x-auto py-1.5 font-mono text-[10px] leading-5">
                      {finding.codeSnippet.lines.map((line, lineIndex) => {
                        const lineNumber = finding.codeSnippet!.startLine + lineIndex;
                        const isFocusLine = lineNumber === finding.codeSnippet!.focusLine;
                        return <div key={lineNumber} className={`flex min-w-max px-3 ${isFocusLine ? (isDark ? 'bg-blue-400/[0.09] text-slate-100' : 'bg-blue-100/70 text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>
                          <span className={`mr-3 w-7 shrink-0 select-none text-right ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{lineNumber}</span>
                          <code className="whitespace-pre">{line || ' '}</code>
                        </div>;
                      })}
                    </div>
                  </div>}
                  {finding.evidence.length > 0 && <div className={`mt-3 rounded-lg border px-3 py-2 ${isDark ? 'border-white/[0.06] bg-black/10' : 'border-slate-100 bg-slate-50/70'}`}>
                    <p className={`text-[10px] font-medium ${muted}`}>Evidence ({finding.evidence.length})</p>
                    <ul className={`mt-2 space-y-1.5 font-mono text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{finding.evidence.map(item => <li key={item} className="break-all">{item}</li>)}</ul>
                  </div>}
                </div>
              </details>)}
              {visibleQualityFindings.length === 0 && <div className={`rounded-xl border px-4 py-6 text-center ${isDark ? 'border-emerald-400/15 bg-emerald-400/[0.03]' : 'border-emerald-100 bg-emerald-50/50'}`}>
                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                <p className={`mt-2 text-sm font-medium ${isDark ? 'text-emerald-100' : 'text-emerald-800'}`}>{qualityFindings.length ? `No ${qualityPriorityFilter}-priority findings` : 'No static findings detected'}</p>
                <p className={`mt-1 text-xs ${muted}`}>{qualityFindings.length ? 'Choose another priority filter to see the rest.' : 'A code review and running the project’s checks can still uncover issues.'}</p>
              </div>}
            </div>
          </details>

          <AIReviewPanel analysis={analysis} />

        </> : <section className={`rounded-2xl border p-6 ${panel}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" /><div><h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Quality analysis is not available in this saved scan</h3><p className={`mt-1 text-xs ${muted}`}>Re-analyze this codebase to inspect source files and calculate a quality score.</p></div></div>
            <button type="button" onClick={onRescan} disabled={isRescanning} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${isDark ? 'border-blue-400/35 bg-blue-400/[0.09] text-blue-200 hover:bg-blue-400/[0.15]' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              {isRescanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{isRescanning ? 'Analyzing…' : 'Re-analyze codebase'}
            </button>
          </div>
        </section>}</>
  );
};
