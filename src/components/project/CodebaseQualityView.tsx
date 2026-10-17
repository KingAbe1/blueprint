import React, { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  Check,
  FileCode,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Layers,
  Sparkles,
  ExternalLink,
  TestTube,
  FileText,
  Workflow,
  CheckCheck,
  Search,
  Filter,
  FolderTree,
  ArrowUpRight,
  SlidersHorizontal,
  Terminal,
  Wrench,
  GitBranch,
  Code2,
  Hash,
  Activity,
  Flame,
  Zap,
  RefreshCw,
  Loader2,
  File,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { CodebaseAnalysis, QualityFinding, QualityDimension } from '../../types/codebase';
import { AIReviewPanel } from './AIReviewPanel';
import { DependencySecurityPanel } from './DependencySecurityPanel';
import { useCodebaseWorkspace } from '../../context/CodebaseWorkspaceContext';

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

function parseFindingInfo(finding: QualityFinding): ParsedFindingInfo {
  const detail = finding.detail || '';
  const title = finding.title || '';

  // 1. Complexity Findings
  if (title.toLowerCase().includes('complexity') || detail.toLowerCase().includes('branch-complexity')) {
    const match = detail.match(/([a-zA-Z0-9_$]+)\s+spans\s+(\d+)\s+lines(?:\s+and\s+has\s+a\s+branch-complexity\s+estimate\s+of\s+(\d+))?/i);
    const funcName = match ? (match[1] === 'anonymous' ? 'anonymous handler' : `${match[1]}()`) : 'Monolithic routine';
    const lines = match ? match[2] : undefined;
    const complexity = match ? match[3] : undefined;

    const metrics: Array<{ label: string; value: string }> = [];
    if (lines) metrics.push({ label: 'Span', value: `${lines} LOC` });
    if (complexity) metrics.push({ label: 'Complexity', value: `${complexity} / 15` });
    metrics.push({ label: 'Target', value: funcName });

    return {
      headline: `High Complexity · ${funcName}`,
      target: funcName,
      metrics,
      remediationAdvice: [
        'Decompose monolithic handler into specialized single-purpose functions or domain services.',
        'Extract complex branching (switch / nested if) into guard clauses or a lookup strategy map.',
        'Separate I/O operations (database/network) from core data formatting and transformation logic.',
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
  const { openFileInAnalysis } = useCodebaseWorkspace();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strongText = isDark ? 'text-white' : 'text-slate-900';
  const bodyText = isDark ? 'text-slate-200' : 'text-slate-800';
  const subtleText = isDark ? 'text-slate-300' : 'text-slate-600';
  const sectionDivider = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const progressTrack = isDark ? 'bg-white/[0.06]' : 'bg-slate-200';

  const [qualityPriorityFilter, setQualityPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [findingSearchQuery, setFindingSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [copiedRemediation, setCopiedRemediation] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  // Pure static code findings only (preventing duplicate CVE entries since they have their dedicated panel)
  const qualityFindings = useMemo(() => {
    return (analysis.quality?.findings || []).filter(
      f => !f.ruleId?.startsWith('cve-') && !f.title.toLowerCase().startsWith('vulnerable package')
    );
  }, [analysis.quality?.findings]);

  const omittedQualityFindings = analysis.quality?.findingsOmitted || 0;
  const totalQualityFindings = qualityFindings.length + omittedQualityFindings;

  const highPriorityCount = qualityFindings.filter(f => f.priority === 'high').length;
  const mediumPriorityCount = qualityFindings.filter(f => f.priority === 'medium').length;
  const lowPriorityCount = qualityFindings.filter(f => f.priority === 'low').length;

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

  const priorityBadgeClass = (priority: string) => {
    if (priority === 'high') {
      return isDark
        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
        : 'bg-rose-100 text-rose-800 border border-rose-200';
    }
    if (priority === 'medium') {
      return isDark
        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
        : 'bg-amber-100 text-amber-800 border border-amber-200';
    }
    return isDark
      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
      : 'bg-blue-100 text-blue-800 border border-blue-200';
  };

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

  // Dimension Icon Helper
  const getDimensionIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'folder structure':
        return <FolderTree className="h-3.5 w-3.5 text-emerald-400" />;
      case 'code maintainability':
        return <Wrench className="h-3.5 w-3.5 text-blue-400" />;
      case 'code correctness':
        return <CheckCheck className="h-3.5 w-3.5 text-teal-400" />;
      case 'documentation':
        return <FileText className="h-3.5 w-3.5 text-cyan-400" />;
      case 'dependency cves':
        return <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />;
      case 'security risks':
        return <Shield className="h-3.5 w-3.5 text-amber-400" />;
      case 'tests':
        return <TestTube className="h-3.5 w-3.5 text-violet-400" />;
      case 'ci checks':
        return <Workflow className="h-3.5 w-3.5 text-indigo-400" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-5">
      {analysis.quality ? (
        <>
          {/* ========================================================================= */}
          {/* 1. BESPOKE ARCHITECTURAL HEALTH & POSTURE ENGINE (Executive Dashboard)   */}
          {/* ========================================================================= */}
          <section
            id="quality-score-panel"
            className={`scroll-mt-4 rounded-2xl border transition-all relative overflow-hidden ${
            isDark
              ? 'border-white/[0.08] bg-[#141518] shadow-xs'
              : 'border-slate-200/90 bg-white shadow-xs'
          }`}
          >
            {/* Top Bar with System Identity & Actions */}
            <div className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'border-white/[0.06] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                  isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-600'
                }`}>
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Health summary
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAuditReport}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    isDark
                      ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                  }`}
                  title="Export complete architectural audit to markdown"
                >
                  {copiedReport ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Download className="h-3.5 w-3.5 text-blue-400" />}
                  <span>{copiedReport ? 'Exported' : 'Export report'}</span>
                </button>
              </div>
            </div>

            {/* Main Scorecard Body: Left Executive Grade + Right 2 Pillars */}
            <div className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Grade, Executive Diagnosis, and Vital Stats (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-5">
                {/* Executive Grade Banner */}
                <div className={`p-4 rounded-xl border relative overflow-hidden ${
                  isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-50/60'
                }`}>
                  <div className="flex items-center gap-4">
                    {/* Stylized Grade Badge */}
                    <div className={`flex flex-col items-center justify-center h-20 w-20 rounded-2xl border shrink-0 font-mono shadow-inner ${grade.bg} ${grade.border}`}>
                      <span className={`text-3xl font-extrabold tracking-tight leading-none ${grade.color}`}>
                        {grade.letter}
                      </span>
                      <span className="text-[10px] font-semibold opacity-70 mt-1">
                        GRADE
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold font-mono tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>
                          {score}
                        </span>
                        <span className={`text-xs font-mono font-medium ${muted}`}>
                          / 100 HEALTH INDEX
                        </span>
                      </div>
                      <h3 className={`mt-1 text-sm font-semibold truncate ${grade.color}`}>
                        {grade.status}
                      </h3>
                      <p className={`mt-0.5 text-[11px] ${muted}`}>
                        {analysis.quality.confidence.toUpperCase()} confidence evaluation
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowScoreBreakdown(open => !open)}
                        className={`mt-2 text-[11px] font-semibold underline-offset-2 hover:underline ${
                          isDark ? 'text-blue-300' : 'text-blue-700'
                        }`}
                      >
                        {showScoreBreakdown ? 'Hide score breakdown' : 'How is this score calculated?'}
                      </button>
                    </div>
                  </div>

                  {showScoreBreakdown ? (
                    <div
                      className={`mt-3 rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed ${
                        isDark ? 'border-white/[0.08] bg-black/30 text-slate-300' : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <p className={`mb-2 ${muted}`}>
                        The health index sums dimension scores from the local static scan (structure, maintainability, tests, tooling, etc.). CVE advisories are tracked separately under supply-chain risk.
                      </p>
                      <ul className="space-y-1.5">
                        {(analysis.quality.dimensions || []).map(dim => (
                          <li key={dim.name} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                            <span className="font-medium">{dim.name}</span>
                            <span className="font-mono text-[10px]">
                              {dim.score}/{dim.maxScore} pts
                            </span>
                            <span className={`w-full text-[10px] ${muted}`}>{dim.summary}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Horizontal Segmented Distribution Bar */}
                  <div className={`mt-4 pt-3.5 border-t ${sectionDivider}`}>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                      <span className={muted}>System Balance</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                        {codeRigorPillar.earned + securityVerificationPillar.earned} / {codeRigorPillar.max + securityVerificationPillar.max} pts
                      </span>
                    </div>
                    <div className={`h-2 w-full rounded-full overflow-hidden flex ${isDark ? 'bg-slate-800/40' : 'bg-slate-200'}`}>
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${codeRigorPillar.pct * 0.5}%` }}
                        title={`Code Rigor: ${codeRigorPillar.pct}%`}
                      />
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${securityVerificationPillar.pct * 0.5}%` }}
                        title={`Security & Verification: ${securityVerificationPillar.pct}%`}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Code Rigor ({codeRigorPillar.pct}%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Verification ({securityVerificationPillar.pct}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Executive Diagnosis Synopsis */}
                <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  isDark ? 'border-white/[0.05] bg-white/[0.015] text-slate-300' : 'border-slate-200 bg-white text-slate-700'
                }`}>
                  <p className="font-sans">
                    <span className={`font-semibold mr-1.5 ${strongText}`}>Executive Diagnosis:</span>
                    {executiveDiagnosis}
                  </p>
                </div>

                {/* Metadata Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className={`p-2.5 rounded-lg border ${
                    isDark ? 'border-white/[0.05] bg-white/[0.01]' : 'border-slate-200/80 bg-slate-50/70'
                  }`}>
                    <span className={`block text-[9px] uppercase tracking-wider font-semibold ${muted}`}>
                      Files Scanned
                    </span>
                    <span className={`font-mono text-xs font-bold mt-0.5 block ${strongText}`}>
                      {analysis.quality.analyzedSourceFiles}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    isDark ? 'border-white/[0.05] bg-white/[0.01]' : 'border-slate-200/80 bg-slate-50/70'
                  }`}>
                    <span className={`block text-[9px] uppercase tracking-wider font-semibold ${muted}`}>
                      Static Issues
                    </span>
                    <span className={`font-mono text-xs font-bold mt-0.5 block ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                      {totalQualityFindings}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    isDark ? 'border-white/[0.05] bg-white/[0.01]' : 'border-slate-200/80 bg-slate-50/70'
                  }`}>
                    <span className={`block text-[9px] uppercase tracking-wider font-semibold ${muted}`}>
                      Supply CVEs
                    </span>
                    <span className={`font-mono text-xs font-bold mt-0.5 block ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                      {analysis.dependencyRisk?.advisories?.length || 0}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    isDark ? 'border-white/[0.05] bg-white/[0.01]' : 'border-slate-200/80 bg-slate-50/70'
                  }`}>
                    <span className={`block text-[9px] uppercase tracking-wider font-semibold ${muted}`}>
                      Codebase LOC
                    </span>
                    <span className={`font-mono text-xs font-bold mt-0.5 block ${strongText}`}>
                      {analysis.quality.linesOfCode ? `${Math.round(analysis.quality.linesOfCode / 1000)}k` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: 2 Core Architectural Pillars (7 cols) */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pillar 1: Code Rigor & Modularity */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'border-white/[0.07] bg-black/20' : 'border-slate-200 bg-white'
                }`}>
                  <div>
                    <div className={`flex items-center justify-between pb-2.5 border-b mb-3 ${sectionDivider}`}>
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-emerald-400" />
                        <h4 className={`text-xs font-semibold tracking-wide ${strongText}`}>
                          Code quality
                        </h4>
                      </div>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                        codeRigorPillar.pct >= 75
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {codeRigorPillar.earned}/{codeRigorPillar.max} pts ({codeRigorPillar.pct}%)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {codeRigorPillar.dims.map(dim => {
                        const pct = dim.maxScore > 0 ? Math.round((dim.score / dim.maxScore) * 100) : 0;
                        const isPerfect = pct === 100;
                        const isWarn = pct < 60;

                        return (
                          <div key={dim.name} className="group">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`flex items-center gap-1.5 font-medium ${bodyText}`}>
                                {getDimensionIcon(dim.name)}
                                <span>{dim.name}</span>
                              </span>
                              <span className={`font-mono text-[11px] font-semibold ${subtleText}`}>
                                {dim.score}/{dim.maxScore}
                              </span>
                            </div>
                            <div className={`h-1.5 w-full rounded-full overflow-hidden ${progressTrack}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isPerfect ? 'bg-emerald-500' : isWarn ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className={`mt-1 text-[10px] truncate leading-tight font-sans ${muted}`}>
                              {dim.summary}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pillar 2: Security & Verification Posture */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'border-white/[0.07] bg-black/20' : 'border-slate-200 bg-white'
                }`}>
                  <div>
                    <div className={`flex items-center justify-between pb-2.5 border-b mb-3 ${sectionDivider}`}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-400" />
                        <h4 className={`text-xs font-semibold tracking-wide ${strongText}`}>
                          Security & tests
                        </h4>
                      </div>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                        securityVerificationPillar.pct >= 75
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : securityVerificationPillar.pct >= 40
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {securityVerificationPillar.earned}/{securityVerificationPillar.max} pts ({securityVerificationPillar.pct}%)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {securityVerificationPillar.dims.map(dim => {
                        const pct = dim.maxScore > 0 ? Math.round((dim.score / dim.maxScore) * 100) : 0;
                        const isCritical = dim.score === 0 && dim.maxScore > 0;
                        const isHigh = pct >= 80;

                        return (
                          <div key={dim.name} className="group">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`flex items-center gap-1.5 font-medium ${bodyText}`}>
                                {getDimensionIcon(dim.name)}
                                <span>{dim.name}</span>
                              </span>
                              <span className={`font-mono text-[11px] font-semibold ${
                                isCritical ? 'text-rose-500 font-bold' : subtleText
                              }`}>
                                {dim.score}/{dim.maxScore}
                              </span>
                            </div>
                            <div className={`h-1.5 w-full rounded-full overflow-hidden ${progressTrack}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isCritical ? 'bg-rose-500' : isHigh ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className={`mt-1 text-[10px] truncate leading-tight font-sans ${muted}`}>
                              {dim.summary}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 2. SUPPLY CHAIN VULNERABILITY ADVISORIES (Dedicated OSV.dev Panel)        */}
          {/* ========================================================================= */}
          <div id="quality-supply-chain-panel" className="scroll-mt-4">
            <DependencySecurityPanel analysis={analysis} onUpdateAnalysis={onUpdateAnalysis} />
          </div>

          {/* ========================================================================= */}
          {/* 3. CODE ARCHITECTURE & STATIC FINDINGS (Linear-Style Issue Workbench)     */}
          {/* ========================================================================= */}
          <section
            id="quality-findings-panel"
            className={`scroll-mt-4 rounded-2xl border transition-all overflow-hidden ${
            isDark
              ? 'border-white/[0.08] bg-[#141518] shadow-xs'
              : 'border-slate-200/90 bg-white shadow-xs'
          }`}
          >
            {/* Header & Filter Toolbar */}
            <div className={`p-4 sm:p-5 border-b ${
              isDark ? 'border-white/[0.06] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Findings
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${
                      isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
                    }`}>
                      {filteredFindings.length} of {qualityFindings.length} active
                    </span>
                  </div>
                  <p className={`mt-0.5 text-xs ${muted}`}>
                    AST inspection detecting complexity spikes, missing test suites, and credential patterns.
                  </p>
                </div>

                {/* Priority Filter Chips */}
                <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${
                  isDark ? 'border-white/[0.06] bg-black/30' : 'border-slate-200 bg-slate-100'
                }`}>
                  {(['all', 'high', 'medium', 'low'] as const).map(p => {
                    const count = p === 'all' ? qualityFindings.length : qualityFindings.filter(f => f.priority === p).length;
                    const isSelected = qualityPriorityFilter === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setQualityPriorityFilter(p);
                          setSelectedIndex(0);
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                          isSelected
                            ? isDark
                              ? 'bg-[#1E2025] text-white shadow-xs border border-white/[0.08]'
                              : 'bg-white text-slate-900 shadow-xs border border-slate-200'
                            : isDark
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {p} <span className="opacity-70 font-mono text-[10px]">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search & Category Filter Row */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${muted}`} />
                  <input
                    type="text"
                    value={findingSearchQuery}
                    onChange={e => {
                      setFindingSearchQuery(e.target.value);
                      setSelectedIndex(0);
                    }}
                    placeholder="Search findings by rule, function name, message, or file path…"
                    className={`w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs outline-none transition-all ${
                      isDark
                        ? 'border-white/[0.08] bg-black/20 text-white placeholder:text-slate-500 focus:border-blue-500'
                        : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                    }`}
                  />
                  {findingSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFindingSearchQuery('')}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={categoryFilter}
                  onChange={e => {
                    setCategoryFilter(e.target.value);
                    setSelectedIndex(0);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs outline-none ${
                    isDark ? 'border-white/[0.08] bg-black/20 text-white' : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <option value="all">All Categories</option>
                  <option value="maintainability">Maintainability ({qualityFindings.filter(f => f.category === 'maintainability').length})</option>
                  <option value="security">Security ({qualityFindings.filter(f => f.category === 'security').length})</option>
                  <option value="testing">Testing ({qualityFindings.filter(f => f.category === 'testing').length})</option>
                  <option value="correctness">Correctness ({qualityFindings.filter(f => f.category === 'correctness').length})</option>
                  <option value="structure">Structure ({qualityFindings.filter(f => f.category === 'structure').length})</option>
                  <option value="delivery">Delivery ({qualityFindings.filter(f => f.category === 'delivery').length})</option>
                </select>
              </div>
            </div>

            {/* Split-Pane: Master Findings List (5 cols) & Detail Inspector (7 cols) */}
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column: Master Findings List (5 cols) */}
              <div className={`lg:col-span-5 h-[560px] overflow-y-auto space-y-2 p-1.5 rounded-xl border ${
                isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-50/50'
              }`}>
                {filteredFindings.length > 0 ? (
                  filteredFindings.map((finding, idx) => {
                    const isSelected = selectedFinding === finding;
                    const parsed = parseFindingInfo(finding);
                    const isHigh = finding.priority === 'high';
                    const isMedium = finding.priority === 'medium';

                    return (
                      <button
                        key={`${finding.ruleId || finding.title}-${idx}`}
                        type="button"
                        onClick={() => setSelectedIndex(idx)}
                        className={`w-full text-left p-3 rounded-xl border transition-all relative ${
                          isSelected
                            ? isDark
                              ? 'border-blue-500/70 bg-blue-500/[0.08] ring-1 ring-blue-500/30 text-white'
                              : 'border-blue-500 bg-blue-50/80 ring-1 ring-blue-500/30 text-slate-950'
                            : isDark
                            ? 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] text-slate-300'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        {/* Title & Severity */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${
                              isHigh ? 'bg-rose-500' : isMedium ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                            <h4 className="text-xs font-semibold truncate" title={parsed.headline}>
                              {parsed.headline}
                            </h4>
                          </div>

                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ${priorityBadgeClass(finding.priority)}`}>
                            {finding.priority}
                          </span>
                        </div>

                        {/* File Location Breadcrumb */}
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 truncate">
                          <FileCode className="h-3 w-3 shrink-0 opacity-70" />
                          <span className="truncate">{finding.location?.path || (finding.category || 'General')}</span>
                        </div>

                        {/* Metric Tags */}
                        {parsed.metrics.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {parsed.metrics.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                  isDark
                                    ? 'border-white/[0.07] bg-white/[0.03] text-slate-300'
                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                                }`}
                              >
                                {m.label}: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{m.value}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
                    <p className={`mt-2 text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      No matching findings
                    </p>
                    <p className={`mt-0.5 text-[11px] ${muted}`}>
                      Try clearing filters or search terms.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Detail Inspector & Remediation Workbench (7 cols) */}
              <div className={`lg:col-span-7 h-[560px] overflow-y-auto rounded-xl border p-5 ${
                isDark ? 'border-white/[0.07] bg-black/30' : 'border-slate-200 bg-white'
              }`}>
                {selectedFinding && parsedSelected ? (
                  <div className="space-y-4">
                    {/* Header Breadcrumb & Actions */}
                    <div className={`pb-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                      isDark ? 'border-white/[0.06]' : 'border-slate-200'
                    }`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1">
                          <span>{analysis.rootName}</span>
                          <span>/</span>
                          <span className={`truncate max-w-[240px] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                            {selectedFinding.location?.path || selectedFinding.category}
                          </span>
                          {selectedFinding.location?.line && (
                            <span className="text-slate-500">:{selectedFinding.location.line}</span>
                          )}
                        </div>
                        <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {parsedSelected.headline}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedFinding.location?.path && (
                          <>
                            <button
                              type="button"
                              onClick={() => openFileInAnalysis(selectedFinding.location!.path!)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                isDark
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                              title="Open this file in the Code Analysis project tree"
                            >
                              <FolderTree className="h-3 w-3" />
                              <span>Open in tree</span>
                            </button>
                            <button
                              type="button"
                              onClick={copyFilePath}
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                isDark
                                  ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                              title="Copy file path"
                            >
                              {copiedPath ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedPath ? 'Copied Path' : 'Copy Path'}</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={copyRemediation}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition-all ${
                            copiedRemediation
                              ? isDark
                                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : isDark
                              ? 'border-blue-500/35 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                          title="Copy detailed context and instructions to fix this issue"
                        >
                          {copiedRemediation ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                          <span>{copiedRemediation ? 'Prompt Copied' : 'Copy Remediation Prompt'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${priorityBadgeClass(selectedFinding.priority)}`}>
                        {selectedFinding.priority} Priority
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono border ${
                        isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
                      }`}>
                        Category: {selectedFinding.category || 'Quality'}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono border ${
                        isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}>
                        Confidence: {selectedFinding.confidence || 'Medium'}
                      </span>
                    </div>

                    {/* Issue Description / Rationale */}
                    <div className={`p-3.5 rounded-xl border leading-relaxed text-xs ${
                      isDark ? 'border-white/[0.05] bg-white/[0.02] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'
                    }`}>
                      <p>{selectedFinding.detail}</p>
                    </div>

                    {/* Code Snippet Inspector */}
                    {selectedFinding.codeSnippet && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Code2 className="h-3.5 w-3.5 text-blue-400" />
                            <span>{selectedFinding.location?.path || 'Code Inspector'}</span>
                          </span>
                          <span className="text-blue-400 font-semibold">
                            Focus Line {selectedFinding.codeSnippet.focusLine}
                          </span>
                        </div>

                        <div className={`rounded-xl border overflow-hidden font-mono text-[11px] leading-5 ${
                          isDark ? 'border-white/[0.08] bg-[#0A0B0D]' : 'border-slate-200 bg-slate-900 text-slate-200'
                        }`}>
                          {/* Editor Top Bar */}
                          <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-rose-500/80" />
                              <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                              <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono ml-2">
                              {selectedFinding.location?.path ? selectedFinding.location.path.split('/').pop() : 'source.ts'}
                            </span>
                          </div>

                          <div className="py-2 overflow-x-auto">
                            {selectedFinding.codeSnippet.lines.map((line, lineIndex) => {
                              const lineNumber = selectedFinding.codeSnippet!.startLine + lineIndex;
                              const isFocus = lineNumber === selectedFinding.codeSnippet!.focusLine;

                              return (
                                <div
                                  key={lineNumber}
                                  className={`flex min-w-max px-3 ${
                                    isFocus
                                      ? 'bg-blue-500/[0.15] text-blue-200 font-semibold border-l-2 border-blue-400'
                                      : 'text-slate-400 border-l-2 border-transparent'
                                  }`}
                                >
                                  <span className={`mr-4 w-7 select-none text-right font-mono ${
                                    isFocus ? 'text-blue-400 font-bold' : 'text-slate-600'
                                  }`}>
                                    {lineNumber}
                                  </span>
                                  <code className="whitespace-pre">{line || ' '}</code>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Architectural Remediation Advice */}
                    {parsedSelected.remediationAdvice.length > 0 && (
                      <div className={`p-3.5 rounded-xl border ${
                        isDark ? 'border-blue-500/20 bg-blue-500/[0.03]' : 'border-blue-200 bg-blue-50/50'
                      }`}>
                        <div className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>
                          <Wrench className="h-3.5 w-3.5" />
                          <span>Recommended Architectural Strategy</span>
                        </div>
                        <ul className={`space-y-1.5 text-xs ${subtleText}`}>
                          {parsedSelected.remediationAdvice.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2">
                              <span className={`shrink-0 font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>•</span>
                              <span className="leading-snug">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Detected Signal Evidence */}
                    {selectedFinding.evidence.length > 0 && (
                      <div className={`p-3 rounded-xl border ${
                        isDark ? 'border-white/[0.05] bg-black/20' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          <Activity className="h-3 w-3" />
                          <span>AST Signal Metrics ({selectedFinding.evidence.length})</span>
                        </div>
                        <div className={`space-y-1 font-mono text-[11px] ${subtleText}`}>
                          {selectedFinding.evidence.map((ev, eIdx) => (
                            <div key={eIdx} className="flex items-start gap-1.5">
                              <span className="text-slate-500">›</span>
                              <span className="break-all">{ev}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`h-full flex flex-col items-center justify-center text-center p-8 ${muted}`}>
                    <FileCode className="h-8 w-8 mb-2 opacity-50" />
                    <p className={`text-xs font-semibold ${strongText}`}>Select a Finding to Inspect</p>
                    <p className="text-[11px] mt-0.5">Click any issue on the left to inspect AST signals, source code, and remediation advice.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 4. OPTIONAL AI DEEP CODE REVIEW ACCORDION                                */}
          {/* ========================================================================= */}
          <AIReviewPanel analysis={analysis} />
        </>
      ) : (
        <section className={`rounded-2xl border p-8 text-center ${
          isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white'
        }`}>
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
  );
});
