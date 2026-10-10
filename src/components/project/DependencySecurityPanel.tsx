import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Lock,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { CodebaseAnalysis, DependencyRiskAssessment } from '../../types/codebase';
import { scanNpmDependencyRisks } from '../../services/dependencyRiskService';
import { useTheme } from '../../context/ThemeContext';

interface DependencySecurityPanelProps {
  analysis: CodebaseAnalysis;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
}

export const DependencySecurityPanel: React.FC<DependencySecurityPanelProps> = ({
  analysis,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';

  const inventory = analysis.dependencyInventory;
  const assessment = analysis.dependencyRisk;

  const runVulnerabilityAudit = async () => {
    if (!inventory) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      const riskAssessment = await scanNpmDependencyRisks(inventory);
      if (onUpdateAnalysis) {
        onUpdateAnalysis({
          ...analysis,
          dependencyRisk: riskAssessment,
        });
      }
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Could not complete vulnerability audit.');
    } finally {
      setIsAuditing(false);
    }
  };

  const advisories = assessment?.advisories || [];
  const criticalCount = advisories.filter(a => a.severity === 'critical').length;
  const highCount = advisories.filter(a => a.severity === 'high').length;
  const mediumCount = advisories.filter(a => a.severity === 'medium').length;
  const lowCount = advisories.filter(a => a.severity === 'low').length;

  const visibleAdvisories = advisories.filter(a => {
    if (activeSeverityFilter === 'all') return true;
    return a.severity === activeSeverityFilter;
  });

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            criticalCount > 0
              ? 'bg-rose-500/10 text-rose-500'
              : highCount > 0
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-emerald-500/10 text-emerald-500'
          }`}>
            {criticalCount > 0 ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Dependency Vulnerabilities & CVE Advisories
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono ${
                isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}>
                OSV.dev
              </span>
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>
              Audits locked dependencies against open-source CVE vulnerability databases.
            </p>
          </div>
        </div>

        {/* Audit Button */}
        <button
          type="button"
          onClick={runVulnerabilityAudit}
          disabled={isAuditing || !inventory}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
            isDark
              ? 'border-blue-400/35 bg-blue-400/[0.09] text-blue-200 hover:bg-blue-400/[0.15]'
              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          {isAuditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span>{isAuditing ? 'Querying OSV.dev…' : assessment ? 'Re-audit CVEs' : 'Audit Dependencies'}</span>
        </button>
      </div>

      {auditError && (
        <p className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500">
          {auditError}
        </p>
      )}

      {/* Audit Stats if performed */}
      {assessment ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <div className={`p-3 rounded-xl border ${
              criticalCount > 0
                ? (isDark ? 'border-rose-500/30 bg-rose-500/10' : 'border-rose-200 bg-rose-50')
                : (isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70')
            }`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                criticalCount > 0 ? 'text-rose-500' : muted
              }`}>
                Critical Severity
              </p>
              <p className={`text-xl font-semibold mt-1 ${criticalCount > 0 ? 'text-rose-500' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {criticalCount}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              highCount > 0
                ? (isDark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50')
                : (isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70')
            }`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                highCount > 0 ? 'text-amber-500' : muted
              }`}>
                High Severity
              </p>
              <p className={`text-xl font-semibold mt-1 ${highCount > 0 ? 'text-amber-500' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {highCount}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Medium / Low</p>
              <p className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {mediumCount + lowCount}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>Packages Checked</p>
              <p className={`text-xl font-semibold mt-1 text-emerald-500`}>
                {assessment.packagesChecked.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Severity Filter Pills */}
          {advisories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => {
                const count = sev === 'all' ? advisories.length : advisories.filter(a => a.severity === sev).length;
                if (sev !== 'all' && count === 0) return null;
                const isSelected = activeSeverityFilter === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setActiveSeverityFilter(sev)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                      isSelected
                        ? (isDark ? 'bg-white/[0.1] text-white ring-1 ring-white/20' : 'bg-slate-200 text-slate-900')
                        : (isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-600 hover:bg-slate-100')
                    }`}
                  >
                    {sev} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Advisories List */}
          {advisories.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {visibleAdvisories.map((advisory, idx) => {
                const isCrit = advisory.severity === 'critical';
                const isHigh = advisory.severity === 'high';
                const tone = isCrit
                  ? 'border-rose-500/20 bg-rose-500/[0.04]'
                  : isHigh
                  ? 'border-amber-500/20 bg-amber-500/[0.04]'
                  : 'border-blue-500/20 bg-blue-500/[0.04]';

                return (
                  <div key={`${advisory.id}-${idx}`} className={`rounded-xl border p-3.5 ${tone}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-400'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {advisory.severity}
                          </span>
                          <span className={`font-mono text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {advisory.packageName}
                          </span>
                          <span className={`font-mono text-[10px] ${muted}`}>
                            v{advisory.version}
                          </span>
                        </div>
                        <p className={`mt-1.5 text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {advisory.summary}
                        </p>
                      </div>

                      {advisory.id && (
                        <a
                          href={`https://osv.dev/vulnerability/${advisory.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-1 font-mono text-[10px] hover:underline ${
                            isDark ? 'text-blue-400' : 'text-blue-600'
                          }`}
                        >
                          {advisory.id}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {advisory.fixedVersions.length > 0 && (
                      <div className={`mt-2.5 pt-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200/70'} flex items-center gap-2 text-[11px]`}>
                        <span className="font-semibold text-emerald-500">Fix Available:</span>
                        <span className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          Upgrade to {advisory.fixedVersions.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`rounded-xl border p-4 text-center ${
              isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50/50'
            }`}>
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
              <p className={`mt-1.5 text-xs font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                Zero known vulnerabilities detected
              </p>
              <p className={`mt-0.5 text-[10px] ${muted}`}>
                None of the {assessment.packagesChecked} locked dependencies matched known CVE advisories in OSV.dev.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className={`rounded-xl border border-dashed p-4 text-center ${
          isDark ? 'border-white/[0.08] bg-black/10' : 'border-slate-200 bg-slate-50'
        }`}>
          <Lock className={`mx-auto h-5 w-5 ${muted}`} />
          <p className={`mt-2 text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Audit your package dependencies for known CVEs
          </p>
          <p className={`mt-1 text-[11px] ${muted} max-w-md mx-auto`}>
            Queries OSV.dev (Google's open-source vulnerability database) with your locked package versions to flag any known security advisories.
          </p>
        </div>
      )}
    </section>
  );
};
