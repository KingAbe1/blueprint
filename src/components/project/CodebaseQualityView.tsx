import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Gauge,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Search,
  Filter,
  Copy,
  Check,
  Download,
  FileCode,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  TestTube,
  FileText,
  Workflow,
  CheckCheck,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { CodebaseAnalysis, QualityFinding } from '../../types/codebase';
import { AIReviewPanel } from './AIReviewPanel';
import { DependencySecurityPanel } from './DependencySecurityPanel';

interface CodebaseQualityViewProps {
  analysis: CodebaseAnalysis;
  onRescan: () => Promise<void>;
  isRescanning: boolean;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
}

export const CodebaseQualityView: React.FC<CodebaseQualityViewProps> = ({
  analysis,
  onRescan,
  isRescanning,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const [qualityPriorityFilter, setQualityPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [findingSearchQuery, setFindingSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [copiedRemediation, setCopiedRemediation] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const qualityFindings = analysis.quality?.findings || [];
  const omittedQualityFindings = analysis.quality?.findingsOmitted || 0;
  const totalQualityFindings = qualityFindings.length + omittedQualityFindings;

  const highPriorityCount = qualityFindings.filter(finding => finding.priority === 'high').length;
  const mediumPriorityCount = qualityFindings.filter(finding => finding.priority === 'medium').length;
  const lowPriorityCount = qualityFindings.filter(finding => finding.priority === 'low').length;

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

  const copyRemediation = async () => {
    if (!selectedFinding) return;
    const prompt = `Please review and fix this architectural/code quality finding:\nTitle: ${selectedFinding.title}\nCategory: ${selectedFinding.category || 'Quality'}\nSeverity: ${selectedFinding.priority}\nDetail: ${selectedFinding.detail}\nFile: ${selectedFinding.location?.path || 'N/A'}${selectedFinding.codeSnippet ? `\nCode Context (around line ${selectedFinding.codeSnippet.focusLine}):\n${selectedFinding.codeSnippet.lines.join('\n')}` : ''}\nEvidence:\n${selectedFinding.evidence.map(e => `- ${e}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedRemediation(true);
      setTimeout(() => setCopiedRemediation(false), 2000);
    } catch {
      // Ignore
    }
  };

  const exportAuditReport = () => {
    if (!analysis.quality) return;
    const lines = [
      `# ${analysis.rootName} · Quality & Security Audit Report`,
      `*Generated on ${new Date().toLocaleString()} by Blueprint Studio*`,
      ``,
      `## Summary`,
      `- **Overall Health Score:** ${analysis.quality.score}/100`,
      `- **Confidence:** ${analysis.quality.confidence}`,
      `- **Source Files Scanned:** ${analysis.quality.analyzedSourceFiles}`,
      `- **Estimated Lines of Code:** ${analysis.quality.linesOfCode ? analysis.quality.linesOfCode.toLocaleString() : 'N/A'}`,
      `- **High-Priority Findings:** ${highPriorityCount}`,
      `- **Total Static Findings:** ${totalQualityFindings}`,
      ``,
      `## Domain Dimensions`,
      ...analysis.quality.dimensions.map(d => `- **${d.name}:** ${d.score}/${d.maxScore} (${d.summary})`),
      ``,
      `## Detected Findings (${qualityFindings.length})`,
      ...qualityFindings.map((f, i) => [
        `### ${i + 1}. [${f.priority.toUpperCase()}] ${f.title}`,
        `- **Category:** ${f.category || 'quality'}`,
        `- **Location:** ${f.location?.path ? `\`${f.location.path}\`` : 'General'}`,
        `- **Detail:** ${f.detail}`,
        f.evidence.length > 0 ? `- **Evidence:**\n${f.evidence.map(e => `  - ${e}`).join('\n')}` : '',
        ``,
      ].filter(Boolean).join('\n')),
      ``,
      analysis.dependencyRisk ? `## Dependency Vulnerabilities (OSV.dev)\n- **Packages Checked:** ${analysis.dependencyRisk.packagesChecked}\n- **Advisories:** ${analysis.dependencyRisk.advisories.length}\n${analysis.dependencyRisk.advisories.map(a => `- **${a.packageName}@${a.version}** [${a.severity}]: ${a.summary}`).join('\n')}` : '',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysis.rootName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_quality_audit.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div className="space-y-4">
      {analysis.quality ? (
        <>
          {/* Top Health Scorecard Banner - Balanced 2-Section Grid */}
          <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Left Column: Radial Score & Health Status (4 cols) */}
              <div className={`lg:col-span-4 flex flex-col justify-between h-full pb-4 lg:pb-0 lg:pr-6 border-b lg:border-b-0 ${
                isDark ? 'border-white/[0.06]' : 'border-slate-200/70'
              }`}>
                <div className="flex items-center gap-4">
                  <div
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-[5px]"
                    style={{
                      background: `conic-gradient(${
                        analysis.quality.score >= 80 ? '#10b981' : analysis.quality.score >= 60 ? '#3b82f6' : '#f59e0b'
                      } ${analysis.quality.score * 3.6}deg, ${isDark ? '#ffffff18' : '#e2e8f0'} 0deg)`,
                    }}
                  >
                    <div className={`flex h-full w-full flex-col items-center justify-center rounded-full ${isDark ? 'bg-[#141518]' : 'bg-white'}`}>
                      <span className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-950'}`}>{analysis.quality.score}</span>
                      <span className={`text-[8px] font-mono ${muted}`}>/ 100</span>
                    </div>
                  </div>
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Static Code Quality</span>
                    <h3 className={`mt-0.5 text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {analysis.quality.score >= 80 ? 'Optimal Architecture' : analysis.quality.score >= 60 ? 'Moderate Health' : 'Needs Remediation'}
                    </h3>
                    <p className={`mt-0.5 text-[10px] ${muted}`}>
                      {analysis.quality.confidence} confidence · {analysis.quality.analyzedSourceFiles} files evaluated
                    </p>
                  </div>
                </div>

                <div className={`mt-4 flex items-center justify-between pt-3 border-t ${
                  isDark ? 'border-white/[0.06]' : 'border-slate-200/70'
                }`}>
                  <span className={`text-[11px] ${muted}`}>
                    {highPriorityCount} critical/high findings
                  </span>
                  <button
                    type="button"
                    onClick={exportAuditReport}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isDark
                        ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                    }`}
                  >
                    {copiedReport ? <Check className="h-3 w-3 text-emerald-500" /> : <Download className="h-3 w-3 text-blue-500" />}
                    <span>{copiedReport ? 'Exported' : 'Export Audit (.md)'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: 7 Domain Dimensions in a Spacious Responsive Grid (8 cols) */}
              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {analysis.quality.dimensions.map(dim => {
                  const pct = dim.maxScore ? Math.round((dim.score / dim.maxScore) * 100) : 0;
                  const statusColor =
                    dim.assessmentStatus === 'not-assessed'
                      ? 'text-slate-400 bg-slate-400/10'
                      : pct >= 80
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : pct >= 50
                      ? 'text-blue-500 bg-blue-500/10'
                      : 'text-amber-500 bg-amber-500/10';

                  const barColor =
                    dim.assessmentStatus === 'not-assessed'
                      ? 'bg-slate-500/30'
                      : pct >= 80
                      ? 'bg-emerald-500'
                      : pct >= 50
                      ? 'bg-blue-500'
                      : 'bg-amber-500';

                  return (
                    <div key={dim.name} className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                      isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[11px] font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={dim.name}>
                            {dim.name}
                          </p>
                          <span className={`text-[9px] font-semibold px-1 rounded ${statusColor}`}>
                            {dim.assessmentStatus === 'not-assessed' ? 'N/A' : `${pct}%`}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-semibold">
                          {dim.maxScore ? `${dim.score}/${dim.maxScore}` : '—'}
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="mt-2.5 h-1 w-full rounded-full bg-slate-200/60 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Dependency Vulnerability Scanner (OSV.dev) */}
          <DependencySecurityPanel analysis={analysis} onUpdateAnalysis={onUpdateAnalysis} />

          {/* 2-Column Master-Detail Finding Inspector */}
          <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  Static Findings Inspector
                </h3>
                <p className={`mt-0.5 text-[11px] ${muted}`}>
                  Select any finding to inspect AST violation context, source lines, and remediation guidance.
                </p>
              </div>

              {/* Priority Chips */}
              <div className={`flex flex-wrap items-center gap-1 p-0.5 rounded-lg border ${
                isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200 bg-slate-100/80'
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
                      className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium capitalize transition-all ${
                        isSelected
                          ? (isDark ? 'bg-[#1E2024] text-white shadow-xs border border-white/[0.08]' : 'bg-white text-slate-900 shadow-xs border border-slate-200/80')
                          : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      {p} <span className="opacity-70 font-mono text-[10px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3.5">
              <div className="relative flex-1">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${muted}`} />
                <input
                  type="text"
                  value={findingSearchQuery}
                  onChange={e => {
                    setFindingSearchQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search findings by rule, message, or file path…"
                  className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none transition-colors ${
                    isDark
                      ? 'border-white/[0.08] bg-black/20 text-white placeholder:text-slate-600 focus:border-blue-500'
                      : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Category Dropdown */}
              <select
                value={categoryFilter}
                onChange={e => {
                  setCategoryFilter(e.target.value);
                  setSelectedIndex(0);
                }}
                className={`rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                  isDark ? 'border-white/[0.08] bg-black/20 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              >
                <option value="all">All Categories</option>
                <option value="security">Security</option>
                <option value="correctness">Correctness</option>
                <option value="maintainability">Maintainability</option>
                <option value="testing">Testing</option>
                <option value="structure">Structure</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            {/* 2-Column Split View - Fixed Viewport with Independent Scrolling */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* Left Column: Master Findings List (5 cols) */}
              <div className={`lg:col-span-5 h-[520px] overflow-y-auto space-y-1.5 p-1 rounded-lg border ${
                isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200 bg-slate-50/50'
              }`}>
                {filteredFindings.length > 0 ? (
                  filteredFindings.map((finding, idx) => {
                    const isSelected = selectedFinding === finding;
                    const isHigh = finding.priority === 'high';
                    const isMedium = finding.priority === 'medium';

                    return (
                      <button
                        key={`${finding.ruleId || finding.title}-${idx}`}
                        type="button"
                        onClick={() => setSelectedIndex(idx)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          isSelected
                            ? (isDark
                                ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40 text-white'
                                : 'border-blue-500 bg-blue-50/90 ring-1 ring-blue-500/30 text-slate-950')
                            : (isDark
                                ? 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'
                                : 'border-slate-200/70 bg-white hover:bg-slate-50')
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${
                              isHigh ? 'bg-rose-500' : isMedium ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                            <h4 className="text-xs font-semibold truncate" title={finding.title}>
                              {finding.title}
                            </h4>
                          </div>
                          <span className={`shrink-0 rounded px-1.5 py-0.2 text-[8px] font-semibold uppercase ${
                            isHigh
                              ? 'bg-rose-500/10 text-rose-500'
                              : isMedium
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {finding.priority}
                          </span>
                        </div>
                        <p className={`mt-1 text-[11px] line-clamp-2 leading-4 ${muted}`}>
                          {finding.detail}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[9px]">
                          <span className={`font-mono truncate max-w-[200px] ${muted}`}>
                            {finding.location?.path || (finding.category || 'quality')}
                          </span>
                          <span className="capitalize opacity-75">
                            Confidence: {finding.confidence || 'medium'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
                    <p className={`mt-2 text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      No matching findings
                    </p>
                    <p className={`mt-0.5 text-[10px] ${muted}`}>
                      Try choosing another category or clearing the search query.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Detail Inspector (7 cols) - Fixed Height */}
              <div className={`lg:col-span-7 h-[520px] overflow-y-auto rounded-lg border p-4 ${
                isDark ? 'border-white/[0.07] bg-black/25' : 'border-slate-200 bg-white'
              }`}>
                {selectedFinding ? (
                  <div>
                    {/* Header with Title and Badges */}
                    <div className={`flex flex-wrap items-start justify-between gap-2 pb-3 border-b ${
                      isDark ? 'border-white/[0.06]' : 'border-slate-200/70'
                    }`}>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            selectedFinding.priority === 'high'
                              ? 'bg-rose-500/15 text-rose-400'
                              : selectedFinding.priority === 'medium'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-blue-500/15 text-blue-400'
                          }`}>
                            {selectedFinding.priority} Priority
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase ${
                            isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {selectedFinding.category || 'Quality'}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                            isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {selectedFinding.confidence || 'Medium'} Confidence
                          </span>
                        </div>
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedFinding.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={copyRemediation}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          isDark
                            ? 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs'
                        }`}
                        title="Copy finding details and code context as an AI prompt"
                      >
                        {copiedRemediation ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-blue-500" />}
                        <span>{copiedRemediation ? 'Prompt Copied' : 'Copy AI Prompt'}</span>
                      </button>
                    </div>

                    {/* Finding Detail / Rationale */}
                    <div className="mt-3">
                      <p className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {selectedFinding.detail}
                      </p>
                    </div>

                    {/* Code Snippet Inspector */}
                    {selectedFinding.codeSnippet && (
                      <div className="mt-3.5">
                        <div className="flex items-center justify-between mb-1.5 text-[10px]">
                          <span className={`font-mono ${muted}`}>
                            {selectedFinding.location?.path || 'Code Context'} · Line {selectedFinding.codeSnippet.focusLine}
                          </span>
                          <span className={`font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            Focus Line {selectedFinding.codeSnippet.focusLine}
                          </span>
                        </div>
                        <div className={`overflow-x-auto rounded-lg border py-2 font-mono text-[11px] leading-5 ${
                          isDark ? 'border-white/[0.07] bg-[#0c0d0f]' : 'border-slate-200 bg-slate-50'
                        }`}>
                          {selectedFinding.codeSnippet.lines.map((line, lineIndex) => {
                            const lineNumber = selectedFinding.codeSnippet!.startLine + lineIndex;
                            const isFocus = lineNumber === selectedFinding.codeSnippet!.focusLine;
                            return (
                              <div
                                key={lineNumber}
                                className={`flex min-w-max px-3 ${
                                  isFocus
                                    ? (isDark ? 'bg-blue-400/[0.12] text-blue-200 font-semibold' : 'bg-blue-100/70 text-blue-900 font-semibold')
                                    : (isDark ? 'text-slate-400' : 'text-slate-600')
                                }`}
                              >
                                <span className={`mr-3 w-6 select-none text-right ${
                                  isFocus ? 'text-blue-400 font-semibold' : isDark ? 'text-slate-600' : 'text-slate-400'
                                }`}>
                                  {lineNumber}
                                </span>
                                <code className="whitespace-pre">{line || ' '}</code>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Evidence List */}
                    {selectedFinding.evidence.length > 0 && (
                      <div className={`mt-3.5 rounded-lg border p-3 ${
                        isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1.5 ${muted}`}>
                          Detected Signal Evidence ({selectedFinding.evidence.length})
                        </p>
                        <ul className="space-y-1">
                          {selectedFinding.evidence.map((item, i) => (
                            <li key={i} className={`font-mono text-[10px] break-all flex items-start gap-1.5 ${
                              isDark ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              <span className="text-blue-500">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-slate-400">
                    Select a finding from the list to inspect details.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* AI Review Panel */}
          <AIReviewPanel analysis={analysis} />
        </>
      ) : (
        <section className={`rounded-xl border p-6 ${panel}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Quality analysis is not available in this saved scan
                </h3>
                <p className={`mt-1 text-xs ${muted}`}>
                  Re-analyze this codebase to inspect source files and calculate a quality score.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRescan}
              disabled={isRescanning}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                isDark
                  ? 'border-blue-400/35 bg-blue-400/[0.09] text-blue-200 hover:bg-blue-400/[0.15]'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {isRescanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isRescanning ? 'Analyzing…' : 'Re-analyze codebase'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
