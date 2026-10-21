import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { CodebaseAnalysis, QualityDimension } from '../../types/codebase';
import { SafeErrorBoundary } from '../common/SafeErrorBoundary';
import { AIReviewPanel } from './AIReviewPanel';
import { DependencySecurityPanel } from './DependencySecurityPanel';
import { QualityHealthSummary } from './QualityHealthSummary';
import { overviewPanelClass } from './overviewUi';
import { saveExportText } from '../../utils/exportFileSave';

interface CodebaseQualityViewProps {
  analysis: CodebaseAnalysis;
  onRescan: () => Promise<void>;
  isRescanning: boolean;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
}

export const CodebaseQualityView: React.FC<CodebaseQualityViewProps> = React.memo(({
  analysis,
  onRescan,
  isRescanning,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  const [copiedReport, setCopiedReport] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [aiReviewFocus, setAiReviewFocus] = useState<{ paths: string[]; note?: string } | null>(null);

  // Counts for health summary + export (findings UI lives on Overview)
  const qualityFindings = useMemo(() => {
    return (analysis.quality?.findings || []).filter(
      f => !f.ruleId?.startsWith('cve-') && !f.title.toLowerCase().startsWith('vulnerable package'),
    );
  }, [analysis.quality?.findings]);

  const omittedQualityFindings = analysis.quality?.findingsOmitted || 0;
  const totalQualityFindings = qualityFindings.length + omittedQualityFindings;
  const highPriorityCount = qualityFindings.filter(f => f.priority === 'high').length;

  const score = analysis.quality?.score ?? 0;
  const grade = useMemo(() => {
    const emerald = isDark ? 'text-emerald-400' : 'text-emerald-700';
    const blue = isDark ? 'text-blue-400' : 'text-blue-700';
    const amber = isDark ? 'text-amber-400' : 'text-amber-700';
    const rose = isDark ? 'text-rose-400' : 'text-rose-700';
    if (score >= 90) return { letter: 'A', status: 'Optimal Rigor', color: emerald };
    if (score >= 80) return { letter: 'B+', status: 'Production Grade', color: emerald };
    if (score >= 70) return { letter: 'B', status: 'Solid Posture', color: blue };
    if (score >= 60) return { letter: 'C', status: 'Moderate Health', color: amber };
    if (score >= 45) return { letter: 'D', status: 'Action Required', color: amber };
    return { letter: 'F', status: 'Critical Deficits', color: rose };
  }, [score, isDark]);

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

  const { codeRigorPillar, securityVerificationPillar } = useMemo(() => {
    const allDims = analysis.quality?.dimensions || [];
    const rigorNames = ['Folder structure', 'Code maintainability', 'Code correctness', 'Documentation'];

    const rigorDims: QualityDimension[] = [];
    const secDims: QualityDimension[] = [];

    for (const d of allDims) {
      if (rigorNames.includes(d.name)) rigorDims.push(d);
      else secDims.push(d);
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

  const exportAuditReport = useCallback(async () => {
    if (!analysis.quality) return;
    const lines = [
      `# ${analysis.rootName} · Architectural & Security Audit Report`,
      `*Generated on ${new Date().toLocaleString()} by blueprint studio*`,
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
      `*Browse actionable findings on the Overview tab (framework review) and use AI review below for deeper notes.*`,
      ``,
      ...qualityFindings.map((f, i) => [
        `### ${i + 1}. [${f.priority.toUpperCase()}] ${f.title}`,
        `- **Category:** ${f.category || 'quality'}`,
        `- **Location:** ${f.location?.path ? `\`${f.location.path}\`` : 'General'}`,
        `- **Detail:** ${f.detail}`,
        f.evidence.length > 0 ? `- **Evidence:**\n${f.evidence.map(e => `  - ${e}`).join('\n')}` : '',
        ``,
      ].filter(Boolean).join('\n')),
      ``,
      analysis.dependencyRisk
        ? `## Supply-Chain Vulnerabilities (OSV.dev)\n- **Packages Evaluated:** ${analysis.dependencyRisk.packagesChecked}\n- **Active Advisories:** ${analysis.dependencyRisk.advisories.length}\n${analysis.dependencyRisk.advisories.map(a => `- **${a.packageName}@${a.version}** [${a.severity}]: ${a.summary}`).join('\n')}`
        : '',
    ];

    const filename = `${analysis.rootName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_architectural_audit.md`;
    try {
      const saved = await saveExportText(lines.join('\n'), filename, 'md');
      if (!saved) return;
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      // Keep UI quiet on cancel/failure
    }
  }, [
    analysis,
    grade.status,
    highPriorityCount,
    totalQualityFindings,
    executiveDiagnosis,
    codeRigorPillar,
    securityVerificationPillar,
    qualityFindings,
  ]);

  const qualityPanel = overviewPanelClass(isDark);

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

            <div id="quality-supply-chain-panel" className="scroll-mt-4">
              <DependencySecurityPanel analysis={analysis} onUpdateAnalysis={onUpdateAnalysis} />
            </div>

            <AIReviewPanel
              analysis={analysis}
              focusPaths={aiReviewFocus?.paths}
              focusNote={aiReviewFocus?.note}
              onFocusHandled={() => setAiReviewFocus(null)}
            />
          </>
        ) : (
          <section className={`rounded-2xl border p-8 text-center ${qualityPanel}`}>
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Quality Analysis Not Available in Saved Scan
            </h3>
            <p className={`mx-auto mt-1 max-w-md text-xs ${muted}`}>
              Re-scan this codebase to inspect source files, evaluate architecture, and calculate a comprehensive health
              index.
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
