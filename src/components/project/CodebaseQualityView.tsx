import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Search, RefreshCw, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { CodebaseAnalysis, QualityFinding, QualityDimension } from '../../types/codebase';
import { SafeErrorBoundary } from '../common/SafeErrorBoundary';
import { Dropdown } from '../common/Dropdown';
import { AIReviewPanel } from './AIReviewPanel';
import { DependencySecurityPanel } from './DependencySecurityPanel';
import { QualityHealthSummary } from './QualityHealthSummary';
import { useCodebaseWorkspace } from '../../context/CodebaseWorkspaceContext';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewPanelClass,
  overviewRowEmphasis,
  overviewSeverityLabel,
  type OverviewEmphasis,
} from './overviewUi';

interface CodebaseQualityViewProps {
  analysis: CodebaseAnalysis;
  onRescan: () => Promise<void>;
  isRescanning: boolean;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
}

interface ParsedFindingInfo {
  headline: string;
  target?: string;
  metrics: Array<{ label: string; value: string }>;
  remediationAdvice: string[];
}

function qualityReviewPathFromFinding(finding: QualityFinding): string | undefined {
  if (finding.location?.path) return finding.location.path;
  for (const evidence of finding.evidence) {
    const match = evidence.match(/^(.*?):\d+(?:[–-]\d+)?$/);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function parseFindingInfo(finding: QualityFinding): ParsedFindingInfo {
  const detail = finding.detail || '';
  const title = finding.title || '';

  // 1. Complexity Findings
  if (
    title.toLowerCase().includes('complexity') ||
    title.toLowerCase().includes('oversized function') ||
    detail.toLowerCase().includes('branch-complexity') ||
    detail.toLowerCase().includes('effective complexity')
  ) {
    const legacyMatch = detail.match(
      /([a-zA-Z0-9_$]+)\s+spans\s+(\d+)\s+lines(?:\s+and\s+has\s+a\s+branch-complexity\s+estimate\s+of\s+(\d+))?/i,
    );
    const modernMatch = detail.match(/^([a-zA-Z0-9_$]+)\s+has effective complexity\s+(\d+)/i);
    const oversizedMatch = detail.match(/^([a-zA-Z0-9_$]+)\s+spans\s+(\d+)\s+logical lines/i);

    const rawName = modernMatch?.[1] || oversizedMatch?.[1] || legacyMatch?.[1];
    const funcName = rawName
      ? rawName.includes('anonymous')
        ? 'anonymous handler'
        : `${rawName}()`
      : 'Monolithic routine';
    const complexity = modernMatch?.[2] || legacyMatch?.[3];
    const lines = oversizedMatch?.[2] || legacyMatch?.[2];

    const metrics: Array<{ label: string; value: string }> = [];
    if (lines) metrics.push({ label: 'Logical lines', value: lines });
    if (complexity) metrics.push({ label: 'Effective complexity', value: complexity });
    metrics.push({ label: 'Target', value: funcName });

    const isOversized = title.toLowerCase().includes('oversized');
    return {
      headline: isOversized ? `Oversized · ${funcName}` : `High Complexity · ${funcName}`,
      target: funcName,
      metrics,
      remediationAdvice: isOversized
        ? [
            'Split long functions by responsibility (fetch vs transform vs render/format).',
            'Move repeated object shapes into shared builders or config tables.',
            'Keep each exported helper focused on one stat, field group, or UI block.',
          ]
        : [
            'Replace nested if/else chains with guard clauses or a lookup map keyed by status/type.',
            'Extract inner loops and switch cases into named helpers with unit tests.',
            'If the function is mostly data shaping, use declarative config arrays instead of branching.',
          ],
    };
  }

  // 2. Secret / Credential Findings
  if (title.toLowerCase().includes('credential') || title.toLowerCase().includes('secret') || detail.toLowerCase().includes('credential')) {
    return {
      headline: 'Hard-coded Secret / Credential Risk',
      target: finding.location?.path ? finding.location.path.split('/').pop() : 'Credentials',
      metrics: [
        { label: 'Risk', value: 'High Exposure' },
        { label: 'Category', value: 'Credential Leak' },
        { label: 'Remediation', value: 'Env Secrets' },
      ],
      remediationAdvice: [
        'Migrate hard-coded tokens, keys, and connection strings to `.env.local` or a secret manager.',
        'Verify that secret values are never exposed in client-facing bundles or server responses.',
        'Confirm `.env*` files containing sensitive variables are strictly listed in `.gitignore`.',
      ],
    };
  }

  // 3. Testing Findings
  if (title.toLowerCase().includes('test') || detail.toLowerCase().includes('test')) {
    return {
      headline: 'Missing Automated Test Infrastructure',
      target: 'Test Harness',
      metrics: [
        { label: 'Coverage', value: '0% Automated' },
        { label: 'Impact', value: 'Regression Risk' },
        { label: 'Recommended', value: 'Vitest / Jest' },
      ],
      remediationAdvice: [
        'Configure a modern test runner (e.g. Vitest, Jest, or Playwright for end-to-end flows).',
        'Add test scripts (`"test": "vitest run"`) to `package.json` and configure CI verification.',
        'Write baseline integration tests around critical business paths and action handlers.',
      ],
    };
  }

  // 4. Correctness / Syntax / Next.js
  if (finding.category === 'correctness') {
    return {
      headline: title,
      target: finding.location?.path ? finding.location.path.split('/').pop() : 'Syntax / API',
      metrics: [
        { label: 'Category', value: 'Correctness' },
        { label: 'Confidence', value: (finding.confidence || 'medium').toUpperCase() },
      ],
      remediationAdvice: [
        'Verify Next.js Server / Client component boundaries to avoid hydration mismatches.',
        'Implement robust error boundaries and explicit exception handling.',
        'Ensure all async operations are properly awaited and return validated schemas.',
      ],
    };
  }

  // Generic fallback
  return {
    headline: title,
    target: finding.location?.path ? finding.location.path.split('/').pop() : undefined,
    metrics: [
      { label: 'Category', value: finding.category || 'Quality' },
      { label: 'Priority', value: finding.priority.toUpperCase() },
    ],
    remediationAdvice: [
      'Refactor this segment following architectural guidelines to improve modularity and safety.',
      'Add inline documentation explaining non-trivial business logic and edge cases.',
    ],
  };
}

export const CodebaseQualityView: React.FC<CodebaseQualityViewProps> = React.memo(({
  analysis,
  onRescan,
  isRescanning,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
  const { isAiConfigured } = useAI();
  const { openFileInAnalysis } = useCodebaseWorkspace();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  const [qualityPriorityFilter, setQualityPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [findingSearchQuery, setFindingSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [copiedRemediation, setCopiedRemediation] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [aiReviewFocus, setAiReviewFocus] = useState<{ paths: string[]; note?: string } | null>(null);

  // Pure static code findings only (preventing duplicate CVE entries since they have their dedicated panel)
  const qualityFindings = useMemo(() => {
    return (analysis.quality?.findings || []).filter(
      f => !f.ruleId?.startsWith('cve-') && !f.title.toLowerCase().startsWith('vulnerable package')
    );
  }, [analysis.quality?.findings]);

  const omittedQualityFindings = analysis.quality?.findingsOmitted || 0;
  const totalQualityFindings = qualityFindings.length + omittedQualityFindings;

  const highPriorityCount = qualityFindings.filter(f => f.priority === 'high').length;

  const findingsCategoryOptions = useMemo(
    () =>
      (
        [
          ['all', 'All categories'],
          ['maintainability', 'Maintainability'],
          ['security', 'Security'],
          ['testing', 'Testing'],
          ['correctness', 'Correctness'],
          ['structure', 'Structure'],
          ['delivery', 'Delivery'],
          ['documentation', 'Documentation'],
          ['tooling', 'Tooling'],
        ] as const
      ).map(([value, label]) => ({
        value,
        label,
        badge: String(
          value === 'all'
            ? qualityFindings.length
            : qualityFindings.filter(f => f.category === value).length,
        ),
      })),
    [qualityFindings],
  );

  const findingsPriorityOptions = useMemo(
    () =>
      (['all', 'high', 'medium', 'low'] as const).map(value => ({
        value,
        label: value === 'all' ? 'All priorities' : value.charAt(0).toUpperCase() + value.slice(1),
        badge: String(
          value === 'all'
            ? qualityFindings.length
            : qualityFindings.filter(f => f.priority === value).length,
        ),
      })),
    [qualityFindings],
  );

  const findingsFilterTriggerClass = isDark
    ? '!rounded-lg !border-white/[0.08] !bg-black/20 !text-slate-200 !font-normal'
    : '!rounded-lg !border-slate-200 !bg-white !text-slate-800 !font-normal';

  // Filtered findings list
  const filteredFindings = useMemo(() => {
    return qualityFindings.filter(f => {
      if (qualityPriorityFilter !== 'all' && f.priority !== qualityPriorityFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (findingSearchQuery.trim()) {
        const q = findingSearchQuery.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          f.detail.toLowerCase().includes(q) ||
          (f.location?.path && f.location.path.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [qualityFindings, qualityPriorityFilter, categoryFilter, findingSearchQuery]);

  const selectedFinding: QualityFinding | undefined = filteredFindings[selectedIndex] || filteredFindings[0];
  const parsedSelected = selectedFinding ? parseFindingInfo(selectedFinding) : null;

  // Health Score & Grade
  const score = analysis.quality?.score ?? 0;
  const grade = useMemo(() => {
    const emerald = isDark ? 'text-emerald-400' : 'text-emerald-700';
    const blue = isDark ? 'text-blue-400' : 'text-blue-700';
    const amber = isDark ? 'text-amber-400' : 'text-amber-700';
    const rose = isDark ? 'text-rose-400' : 'text-rose-700';
    if (score >= 90) return { letter: 'A', status: 'Optimal Rigor', color: emerald, border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
    if (score >= 80) return { letter: 'B+', status: 'Production Grade', color: emerald, border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
    if (score >= 70) return { letter: 'B', status: 'Solid Posture', color: blue, border: 'border-blue-500/30', bg: 'bg-blue-500/10' };
    if (score >= 60) return { letter: 'C', status: 'Moderate Health', color: amber, border: 'border-amber-500/30', bg: 'bg-amber-500/10' };
    if (score >= 45) return { letter: 'D', status: 'Action Required', color: amber, border: 'border-amber-500/30', bg: 'bg-amber-500/10' };
    return { letter: 'F', status: 'Critical Deficits', color: rose, border: 'border-rose-500/30', bg: 'bg-rose-500/10' };
  }, [score, isDark]);

  // Executive Architecture Diagnostic Sentence
  const executiveDiagnosis = useMemo(() => {
    const cveCount = analysis.dependencyRisk?.advisories?.length || 0;
    const testDim = analysis.quality?.dimensions.find(d => d.name === 'Tests');
    const hasZeroTests = testDim && testDim.score === 0;

    if (cveCount > 0 && hasZeroTests) {
      return `Severe supply-chain exposure (${cveCount} CVE advisories) and zero automated test suites compromise release safety. Folder architecture and documentation remain solid, but urgent remediation is required for dependencies and test infrastructure.`;
    }
    if (cveCount > 0) {
      return `Identified ${cveCount} supply-chain vulnerabilities in project dependencies. Code organization is healthy, but third-party package upgrades should be prioritized immediately.`;
    }
    if (score >= 80) {
      return `High architectural discipline observed. Clean modular structure, consistent code practices, and healthy maintainability scores across inspected source files.`;
    }
    return `Codebase demonstrates workable fundamentals with key opportunities to reduce function complexity spikes, add automated test suites, and improve continuous verification.`;
  }, [analysis.dependencyRisk, analysis.quality, score]);

  // Group Dimensions into 2 Architectural Pillars
  const { codeRigorPillar, securityVerificationPillar } = useMemo(() => {
    const allDims = analysis.quality?.dimensions || [];
    const rigorNames = ['Folder structure', 'Code maintainability', 'Code correctness', 'Documentation'];

    const rigorDims: QualityDimension[] = [];
    const secDims: QualityDimension[] = [];

    for (const d of allDims) {
      if (rigorNames.includes(d.name)) {
        rigorDims.push(d);
      } else {
        secDims.push(d);
      }
    }

    const calcSubtotal = (dims: QualityDimension[]) => {
      const earned = dims.reduce((acc, d) => acc + d.score, 0);
      const max = dims.reduce((acc, d) => acc + d.maxScore, 0);
      const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
      return { earned, max, pct, dims };
    };

    return {
      codeRigorPillar: calcSubtotal(rigorDims),
      securityVerificationPillar: calcSubtotal(secDims),
    };
  }, [analysis.quality?.dimensions]);

  // Copy Remediation Prompt
  const copyRemediation = useCallback(async () => {
    if (!selectedFinding) return;
    const file = selectedFinding.location?.path || 'Codebase general';
    const line = selectedFinding.location?.line || selectedFinding.codeSnippet?.focusLine;
    const locStr = line ? `${file}:${line}` : file;

    const snippetText = selectedFinding.codeSnippet && selectedFinding.codeSnippet.lines.length > 0
      ? `\n\n### Code Context (${locStr}):\n\`\`\`typescript\n${selectedFinding.codeSnippet.lines.join('\n')}\n\`\`\``
      : '';

    const evidenceText = selectedFinding.evidence.length > 0
      ? `\n\n### Violations & AST Evidence:\n${selectedFinding.evidence.map(e => `- ${e}`).join('\n')}`
      : '';

    const prompt = `### Architectural Remediation Task
**Issue:** ${selectedFinding.title}
**Location:** \`${locStr}\`
**Severity:** ${selectedFinding.priority.toUpperCase()} | **Category:** ${selectedFinding.category || 'quality'}

### Detail
${selectedFinding.detail}${snippetText}${evidenceText}

### Remediation Objectives
1. Refactor the identified code segment to resolve the structural violation.
2. Break down cyclomatic complexity into modular, single-responsibility helper functions.
3. Preserve existing functional behavior and public API contracts while ensuring clean type safety.`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedRemediation(true);
      setTimeout(() => setCopiedRemediation(false), 2000);
    } catch {
      // Ignore
    }
  }, [selectedFinding]);

  const copyFilePath = useCallback(async () => {
    if (!selectedFinding?.location?.path) return;
    try {
      await navigator.clipboard.writeText(selectedFinding.location.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1800);
    } catch {
      // Ignore
    }
  }, [selectedFinding]);

  // Export Comprehensive Audit Report
  const exportAuditReport = useCallback(() => {
    if (!analysis.quality) return;
    const lines = [
      `# ${analysis.rootName} · Architectural & Security Audit Report`,
      `*Generated on ${new Date().toLocaleString()} by Blueprint Studio*`,
      ``,
      `## Executive Summary`,
      `- **Health Index:** ${analysis.quality.score}/100 (${grade.status})`,
      `- **Evaluation Confidence:** ${analysis.quality.confidence.toUpperCase()}`,
      `- **Source Files Scanned:** ${analysis.quality.analyzedSourceFiles}`,
      `- **Estimated Lines of Code:** ${analysis.quality.linesOfCode ? analysis.quality.linesOfCode.toLocaleString() : 'N/A'}`,
      `- **Critical / High Static Findings:** ${highPriorityCount}`,
      `- **Total Static Code Findings:** ${totalQualityFindings}`,
      `- **Supply-Chain CVE Advisories:** ${analysis.dependencyRisk?.advisories?.length || 0}`,
      ``,
      `## Architectural Diagnosis`,
      `> ${executiveDiagnosis}`,
      ``,
      `## Architectural Posture Pillars`,
      `### Code Rigor & Modularity (${codeRigorPillar.earned}/${codeRigorPillar.max} pts · ${codeRigorPillar.pct}%)`,
      ...codeRigorPillar.dims.map(d => `- **${d.name}:** ${d.score}/${d.maxScore} pts · ${d.summary}`),
      ``,
      `### Security & Verification Posture (${securityVerificationPillar.earned}/${securityVerificationPillar.max} pts · ${securityVerificationPillar.pct}%)`,
      ...securityVerificationPillar.dims.map(d => `- **${d.name}:** ${d.score}/${d.maxScore} pts · ${d.summary}`),
      ``,
      `## Static Code Findings (${qualityFindings.length})`,
      ...qualityFindings.map((f, i) => [
        `### ${i + 1}. [${f.priority.toUpperCase()}] ${f.title}`,
        `- **Category:** ${f.category || 'quality'}`,
        `- **Location:** ${f.location?.path ? `\`${f.location.path}\`` : 'General'}`,
        `- **Detail:** ${f.detail}`,
        f.evidence.length > 0 ? `- **Evidence:**\n${f.evidence.map(e => `  - ${e}`).join('\n')}` : '',
        ``,
      ].filter(Boolean).join('\n')),
      ``,
      analysis.dependencyRisk ? `## Supply-Chain Vulnerabilities (OSV.dev)\n- **Packages Evaluated:** ${analysis.dependencyRisk.packagesChecked}\n- **Active Advisories:** ${analysis.dependencyRisk.advisories.length}\n${analysis.dependencyRisk.advisories.map(a => `- **${a.packageName}@${a.version}** [${a.severity}]: ${a.summary}`).join('\n')}` : '',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysis.rootName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_architectural_audit.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  }, [analysis, grade.status, highPriorityCount, totalQualityFindings, executiveDiagnosis, codeRigorPillar, securityVerificationPillar, qualityFindings]);

  const findingEmphasis = (priority: string): OverviewEmphasis => {
    if (priority === 'high') return 'critical';
    if (priority === 'medium') return 'warning';
    return 'info';
  };

  const qualityPanel = overviewPanelClass(isDark);
  const qualityBorder = overviewBorderClass(isDark);
  const qualityDivide = overviewDivideClass(isDark);
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';

  return (
    <SafeErrorBoundary fallbackTitle="Quality view unavailable" variant="inline">
    <div className="space-y-5">
      {analysis.quality ? (
        <>
          <QualityHealthSummary
            analysis={analysis}
            isDark={isDark}
            score={score}
            gradeLabel={grade.letter}
            gradeStatus={grade.status}
            executiveDiagnosis={executiveDiagnosis}
            codeRigorPillar={codeRigorPillar}
            securityVerificationPillar={securityVerificationPillar}
            totalQualityFindings={totalQualityFindings}
            cveCount={analysis.dependencyRisk?.advisories?.length || 0}
            showScoreBreakdown={showScoreBreakdown}
            onToggleScoreBreakdown={() => setShowScoreBreakdown(open => !open)}
            onExportReport={exportAuditReport}
            copiedReport={copiedReport}
          />

          {/* ========================================================================= */}
          {/* 2. SUPPLY CHAIN VULNERABILITY ADVISORIES (Dedicated OSV.dev Panel)        */}
          {/* ========================================================================= */}
          <div id="quality-supply-chain-panel" className="scroll-mt-4">
            <DependencySecurityPanel analysis={analysis} onUpdateAnalysis={onUpdateAnalysis} />
          </div>

          <section id="quality-findings-panel" className={`scroll-mt-4 overflow-hidden rounded-2xl border ${qualityPanel}`}>
            <header className={`border-b px-5 py-4 sm:px-6 ${qualityBorder}`}>
              <h2 className={`text-[15px] font-medium ${titleText}`}>Findings</h2>
              <p className={`mt-0.5 text-[13px] ${muted}`}>
                Static rules for complexity, credentials, tests, and structure.
              </p>
            </header>

            <div className={`border-b px-5 py-3 sm:px-6 ${qualityBorder}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative min-w-0 flex-1 lg:max-w-md">
                  <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
                  <input
                    type="text"
                    value={findingSearchQuery}
                    onChange={e => {
                      setFindingSearchQuery(e.target.value);
                      setSelectedIndex(0);
                    }}
                    placeholder="Search title, detail, or path…"
                    className={`w-full rounded-lg border py-1.5 pl-8 pr-8 text-xs outline-none ${
                      isDark
                        ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
                        : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400'
                    }`}
                  />
                  {findingSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setFindingSearchQuery('')}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${muted}`}
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Dropdown
                    options={findingsCategoryOptions}
                    value={categoryFilter}
                    onChange={value => {
                      setCategoryFilter(value);
                      setSelectedIndex(0);
                    }}
                    placeholder="Category"
                    size="sm"
                    variant="subtle"
                    fullWidth={false}
                    className="min-w-[10.5rem]"
                    triggerClassName={findingsFilterTriggerClass}
                    menuClassName="!min-w-[12rem]"
                  />
                  <Dropdown<'all' | 'high' | 'medium' | 'low'>
                    options={findingsPriorityOptions}
                    value={qualityPriorityFilter}
                    onChange={value => {
                      setQualityPriorityFilter(value);
                      setSelectedIndex(0);
                    }}
                    placeholder="Priority"
                    size="sm"
                    variant="subtle"
                    fullWidth={false}
                    className="min-w-[9.5rem]"
                    triggerClassName={findingsFilterTriggerClass}
                    menuClassName="!min-w-[11rem]"
                  />
                </div>
              </div>
              <p className={`mt-2 text-xs tabular-nums ${muted}`}>
                Showing {filteredFindings.length} of {qualityFindings.length}
                {omittedQualityFindings > 0 ? (
                  <span>
                    {' '}
                    · {omittedQualityFindings} more omitted from this list (see total {totalQualityFindings})
                  </span>
                ) : null}
              </p>
            </div>

            <div className={`grid grid-cols-1 pt-4 sm:pt-5 lg:grid-cols-12 lg:divide-x ${qualityDivide}`}>
              <div className="lg:col-span-5 max-h-[560px] overflow-y-auto">
                {filteredFindings.length > 0 ? (
                  <ul className={`divide-y ${qualityDivide}`}>
                    {filteredFindings.map((finding, idx) => {
                      const isSelected = selectedFinding === finding;
                      const parsed = parseFindingInfo(finding);
                      const emphasis = findingEmphasis(finding.priority);

                      return (
                        <li key={`${finding.ruleId || finding.title}-${idx}`}>
                          <button
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className={`w-full py-3.5 pr-5 text-left transition-colors sm:pr-6 ${
                              isSelected
                                ? isDark
                                  ? 'bg-white/[0.04]'
                                  : 'bg-slate-50'
                                : isDark
                                  ? 'hover:bg-white/[0.02]'
                                  : 'hover:bg-slate-50/80'
                            } ${overviewRowEmphasis(isDark, isSelected ? 'info' : emphasis)}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-[13px] leading-snug ${isSelected ? `font-medium ${titleText}` : titleText}`}
                                title={parsed.headline}
                              >
                                {parsed.headline}
                              </p>
                              <span
                                className={`shrink-0 text-[11px] uppercase tracking-wide ${overviewSeverityLabel(
                                  isDark,
                                  finding.priority === 'high' ? 'critical' : finding.priority === 'medium' ? 'warning' : 'optimization',
                                )}`}
                              >
                                {finding.priority}
                              </span>
                            </div>
                            <p className={`mt-1 truncate text-xs ${muted}`}>
                              {finding.location?.path || finding.category || 'General'}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-5 py-16 text-center sm:px-6">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500/80" />
                    <p className={`mt-2 text-sm font-medium ${titleText}`}>No matching findings</p>
                    <p className={`mt-0.5 text-xs ${muted}`}>Adjust filters or search.</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 max-h-[560px] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                {selectedFinding && parsedSelected ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-xs ${muted}`}>
                          {selectedFinding.category || 'quality'}
                          {' · '}
                          <span
                            className={overviewSeverityLabel(
                              isDark,
                              selectedFinding.priority === 'high'
                                ? 'critical'
                                : selectedFinding.priority === 'medium'
                                  ? 'warning'
                                  : 'optimization',
                            )}
                          >
                            {selectedFinding.priority} priority
                          </span>
                          {selectedFinding.confidence ? ` · ${selectedFinding.confidence} confidence` : null}
                        </p>
                        <h3 className={`mt-1 text-[15px] font-medium leading-snug ${titleText}`}>{parsedSelected.headline}</h3>
                        <p className={`mt-1 truncate text-xs ${muted}`}>
                          {selectedFinding.location?.path || 'No file path'}
                          {selectedFinding.location?.line ? `:${selectedFinding.location.line}` : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                        {selectedFinding.location?.path ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openFileInAnalysis(selectedFinding.location!.path!)}
                              className={
                                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                              }
                            >
                              Open in tree
                            </button>
                            <button
                              type="button"
                              onClick={copyFilePath}
                              className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}
                            >
                              {copiedPath ? 'Path copied' : 'Copy path'}
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={copyRemediation}
                          className={
                            isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                          }
                        >
                          {copiedRemediation ? 'Prompt copied' : 'Copy prompt'}
                        </button>
                        {isAiConfigured && selectedFinding && qualityReviewPathFromFinding(selectedFinding) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const path = qualityReviewPathFromFinding(selectedFinding!);
                              if (!path) return;
                              setAiReviewFocus({
                                paths: [path],
                                note: `Validate or nuance the static finding “${selectedFinding.title}” using the supplied source.`,
                              });
                            }}
                            className={
                              isDark ? 'text-violet-300 hover:text-violet-200' : 'text-violet-700 hover:text-violet-900'
                            }
                          >
                            Review with AI
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {selectedFinding.detail}
                    </p>

                    {selectedFinding.codeSnippet ? (
                      <div>
                        <p className={`mb-2 text-xs ${muted}`}>
                          Line {selectedFinding.codeSnippet.focusLine}
                        </p>
                        <div
                          className={`overflow-x-auto rounded-lg border font-mono text-[11px] leading-5 ${
                            isDark ? 'border-white/[0.08] bg-[#0c0d0f] text-slate-300' : 'border-slate-200 bg-slate-950 text-slate-300'
                          }`}
                        >
                          {selectedFinding.codeSnippet.lines.map((line, lineIndex) => {
                            const lineNumber = selectedFinding.codeSnippet!.startLine + lineIndex;
                            const isFocus = lineNumber === selectedFinding.codeSnippet!.focusLine;
                            return (
                              <div
                                key={lineNumber}
                                className={`flex min-w-max px-3 ${
                                  isFocus ? 'bg-blue-500/15 border-l-2 border-blue-400/80' : 'border-l-2 border-transparent'
                                }`}
                              >
                                <span className={`mr-3 w-6 select-none text-right tabular-nums ${muted}`}>{lineNumber}</span>
                                <code className="whitespace-pre">{line || ' '}</code>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {parsedSelected.remediationAdvice.length > 0 ? (
                      <div>
                        <h4 className={`text-[13px] font-medium ${titleText}`}>Suggested fixes</h4>
                        <ul className={`mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed ${muted}`}>
                          {parsedSelected.remediationAdvice.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {selectedFinding.evidence.length > 0 ? (
                      <div>
                        <h4 className={`text-[13px] font-medium ${titleText}`}>Evidence</h4>
                        <ul className={`mt-2 space-y-1 text-xs ${muted}`}>
                          {selectedFinding.evidence.map((ev, eIdx) => (
                            <li key={eIdx} className="break-all font-mono text-[11px]">
                              {ev}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className={`flex min-h-[240px] flex-col items-center justify-center text-center ${muted}`}>
                    <p className={`text-sm font-medium ${titleText}`}>Select a finding</p>
                    <p className="mt-0.5 text-xs">Details, code context, and remediation notes appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 4. OPTIONAL AI DEEP CODE REVIEW ACCORDION                                */}
          {/* ========================================================================= */}
          <AIReviewPanel
            analysis={analysis}
            focusPaths={aiReviewFocus?.paths}
            focusNote={aiReviewFocus?.note}
            onFocusHandled={() => setAiReviewFocus(null)}
          />
        </>
      ) : (
        <section className={`rounded-2xl border p-8 text-center ${qualityPanel}`}>
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-3" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quality Analysis Not Available in Saved Scan
          </h3>
          <p className={`mt-1 text-xs max-w-md mx-auto ${muted}`}>
            Re-scan this codebase to inspect source files, evaluate architecture, and calculate a comprehensive health index.
          </p>
          <button
            type="button"
            onClick={onRescan}
            disabled={isRescanning}
            className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
              isDark
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {isRescanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>{isRescanning ? 'Analyzing…' : 'Re-scan Codebase'}</span>
          </button>
        </section>
      )}
    </div>
    </SafeErrorBoundary>
  );
});
