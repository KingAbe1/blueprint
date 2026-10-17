import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dropdown } from '../common/Dropdown';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Lock,
  ArrowUpRight,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Package,
  Layers,
  Terminal,
  Wrench,
  Sparkles,
  ArrowUpDown,
  Filter,
  ArrowRight,
  SlidersHorizontal,
  Flame,
  Bug,
} from 'lucide-react';
import { CodebaseAnalysis, DependencyRiskAssessment, DependencyAdvisory, DependencySeverity } from '../../types/codebase';
import { scanNpmDependencyRisks } from '../../services/dependencyRiskService';
import { useCodebaseWorkspace } from '../../context/CodebaseWorkspaceContext';
import { recalculateQualityWithDependencyRisk } from '../../services/codebaseAnalysisLoader';
import { useTheme } from '../../context/ThemeContext';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewMetricValueAccent,
  overviewPanelClass,
  overviewSeverityLabel,
} from './overviewUi';

interface DependencySecurityPanelProps {
  analysis: CodebaseAnalysis;
  onUpdateAnalysis?: (analysis: CodebaseAnalysis) => void;
}

const SEVERITY_ORDER: Record<DependencySeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

const PAGE_SIZE = 8;

interface PackageAdvisoryGroup {
  packageName: string;
  version: string;
  highestSeverity: DependencySeverity;
  advisories: DependencyAdvisory[];
  recommendedFix?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topSummary: string;
  vulnerabilityTypes: string[];
}

function extractVulnerabilityTags(summary: string): string[] {
  const tags: string[] = [];
  const lower = summary.toLowerCase();
  if (lower.includes('remote code execution') || lower.includes(' rce')) tags.push('RCE');
  if (lower.includes('prototype pollution')) tags.push('Prototype Pollution');
  if (lower.includes('denial of service') || lower.includes('dos') || lower.includes('redos')) tags.push('DoS');
  if (lower.includes('cross-site scripting') || lower.includes('xss')) tags.push('XSS');
  if (lower.includes('bypass') || lower.includes('authorization') || lower.includes('authentication')) tags.push('Auth Bypass');
  if (lower.includes('injection') || lower.includes('command injection') || lower.includes('sql')) tags.push('Injection');
  if (lower.includes('directory traversal') || lower.includes('path traversal')) tags.push('Path Traversal');
  if (lower.includes('information disclosure') || lower.includes('sensitive')) tags.push('Info Leak');
  if (tags.length === 0) tags.push('Vulnerability');
  return tags.slice(0, 2);
}

export const DependencySecurityPanel: React.FC<DependencySecurityPanelProps> = React.memo(({
  analysis,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
  const { isRescanning } = useCodebaseWorkspace();
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Filters and controls
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [onlyFixable, setOnlyFixable] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [sortBy, setSortBy] = useState<'severity' | 'name' | 'cves'>('severity');
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded items for accordions
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const lastAuditedKeyRef = useRef<string | null>(null);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  const inventory = analysis.dependencyInventory;
  const assessment = analysis.dependencyRisk;

  const runVulnerabilityAudit = useCallback(async () => {
    if (!inventory || inventory.packages.length === 0) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      const riskAssessment = await scanNpmDependencyRisks(inventory);
      if (onUpdateAnalysis) {
        const updatedQuality = analysis.quality
          ? await recalculateQualityWithDependencyRisk(analysis.quality, riskAssessment)
          : analysis.quality;
        onUpdateAnalysis({
          ...analysis,
          dependencyRisk: riskAssessment,
          quality: updatedQuality,
        });
      }
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Could not complete vulnerability audit.');
    } finally {
      setIsAuditing(false);
    }
  }, [inventory, analysis, onUpdateAnalysis]);

  // Automatically run the dependency audit as soon as inventory is available
  useEffect(() => {
    if (isRescanning) return;
    const auditKey = `${analysis.rootPath}:${analysis.scannedAt}:${inventory?.packages.length || 0}`;
    if (assessment) {
      lastAuditedKeyRef.current = auditKey;
      return;
    }
    if (inventory && inventory.packages.length > 0 && lastAuditedKeyRef.current !== auditKey && !isAuditing) {
      lastAuditedKeyRef.current = auditKey;
      void runVulnerabilityAudit();
    }
  }, [assessment, inventory, analysis.rootPath, analysis.scannedAt, isAuditing, isRescanning, runVulnerabilityAudit]);

  // Sync existing assessment into quality assessment if not yet factored or if legacy duplicate findings exist
  useEffect(() => {
    if (
      assessment &&
      analysis.quality &&
      (
        !analysis.quality.dimensions.some(d => d.name === 'Dependency CVEs' && d.maxScore > 0) ||
        analysis.quality.findings.some(f => f.ruleId?.startsWith('cve-') || f.title.toLowerCase().startsWith('vulnerable package'))
      )
    ) {
      void recalculateQualityWithDependencyRisk(analysis.quality, assessment).then(updatedQuality => {
        onUpdateAnalysis({
          ...analysis,
          quality: updatedQuality,
        });
      });
    }
  }, [assessment, analysis, onUpdateAnalysis]);

  const advisories = assessment?.advisories || [];
  const criticalCount = advisories.filter(a => a.severity === 'critical').length;
  const highCount = advisories.filter(a => a.severity === 'high').length;
  const mediumCount = advisories.filter(a => a.severity === 'medium').length;
  const lowCount = advisories.filter(a => a.severity === 'low').length;
  const fixableCount = advisories.filter(a => a.fixedVersions.length > 0).length;

  // Group advisories by package
  const packageGroups = useMemo<PackageAdvisoryGroup[]>(() => {
    const map = new Map<string, {
      packageName: string;
      version: string;
      highestSeverity: DependencySeverity;
      advisories: DependencyAdvisory[];
      recommendedFix?: string;
    }>();

    for (const adv of advisories) {
      const key = `${adv.packageName}@${adv.version}`;
      let group = map.get(key);
      if (!group) {
        group = {
          packageName: adv.packageName,
          version: adv.version,
          highestSeverity: adv.severity,
          advisories: [],
          recommendedFix: adv.fixedVersions[adv.fixedVersions.length - 1],
        };
        map.set(key, group);
      }
      group.advisories.push(adv);

      // Upgrade highest severity if needed
      if (SEVERITY_ORDER[adv.severity] < SEVERITY_ORDER[group.highestSeverity]) {
        group.highestSeverity = adv.severity;
      }
      // Update recommended fix if a fix exists
      if (adv.fixedVersions.length > 0) {
        const candidate = adv.fixedVersions[adv.fixedVersions.length - 1];
        if (!group.recommendedFix || candidate > group.recommendedFix) {
          group.recommendedFix = candidate;
        }
      }
    }

    return Array.from(map.values()).map(g => {
      const crit = g.advisories.filter(a => a.severity === 'critical').length;
      const hi = g.advisories.filter(a => a.severity === 'high').length;
      const med = g.advisories.filter(a => a.severity === 'medium').length;
      const lo = g.advisories.filter(a => a.severity === 'low').length;

      // Top summary: first critical, or first high, or first general
      const topAdv = g.advisories.find(a => a.severity === 'critical') || g.advisories.find(a => a.severity === 'high') || g.advisories[0];
      const tags = new Set<string>();
      g.advisories.forEach(a => {
        extractVulnerabilityTags(a.summary).forEach(t => tags.add(t));
      });

      return {
        ...g,
        criticalCount: crit,
        highCount: hi,
        mediumCount: med,
        lowCount: lo,
        topSummary: topAdv?.summary || 'Known vulnerability advisory in package dependency.',
        vulnerabilityTypes: Array.from(tags).slice(0, 3),
      };
    });
  }, [advisories]);

  // Packages with available fixes for bulk copy
  const packagesWithFixes = useMemo(() => {
    return packageGroups.filter(g => Boolean(g.recommendedFix));
  }, [packageGroups]);

  // Filter package groups
  const filteredPackageGroups = useMemo(() => {
    return packageGroups.filter(grp => {
      if (activeSeverityFilter !== 'all') {
        const hasMatchingSev = grp.advisories.some(a => a.severity === activeSeverityFilter);
        if (!hasMatchingSev) return false;
      }
      if (onlyFixable && !grp.recommendedFix) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPkg = grp.packageName.toLowerCase().includes(q) || grp.version.toLowerCase().includes(q);
        const matchesAdv = grp.advisories.some(a => a.id.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q));
        if (!matchesPkg && !matchesAdv) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'severity') {
        const sevDiff = SEVERITY_ORDER[a.highestSeverity] - SEVERITY_ORDER[b.highestSeverity];
        if (sevDiff !== 0) return sevDiff;
        return b.advisories.length - a.advisories.length;
      }
      if (sortBy === 'cves') {
        return b.advisories.length - a.advisories.length;
      }
      return a.packageName.localeCompare(b.packageName);
    });
  }, [packageGroups, activeSeverityFilter, onlyFixable, searchQuery, sortBy]);

  // Filter individual advisories for list view
  const filteredAdvisories = useMemo(() => {
    return advisories.filter(a => {
      if (activeSeverityFilter !== 'all' && a.severity !== activeSeverityFilter) return false;
      if (onlyFixable && a.fixedVersions.length === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.packageName.toLowerCase().includes(q) ||
          a.version.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'severity') {
        return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.packageName.localeCompare(b.packageName);
      }
      return a.packageName.localeCompare(b.packageName);
    });
  }, [advisories, activeSeverityFilter, onlyFixable, searchQuery, sortBy]);

  // Paged items
  const totalItems = viewMode === 'grouped' ? filteredPackageGroups.length : filteredAdvisories.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const pagedGroups = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPackageGroups.slice(start, start + PAGE_SIZE);
  }, [filteredPackageGroups, currentPage]);

  const pagedAdvisories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAdvisories.slice(start, start + PAGE_SIZE);
  }, [filteredAdvisories, currentPage]);

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyUpgradeCommand = async (packageName: string, targetVersion: string) => {
    const cmd = `npm install ${packageName}@${targetVersion}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedAction(cmd);
      setTimeout(() => setCopiedAction(null), 2200);
    } catch {
      // ignore
    }
  };

  const copyBulkFixCommands = async () => {
    if (packagesWithFixes.length === 0) return;
    const args = packagesWithFixes.map(g => `${g.packageName}@${g.recommendedFix}`).join(' ');
    const cmd = `npm install ${args}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedAction('bulk-upgrade');
      setTimeout(() => setCopiedAction(null), 2500);
    } catch {
      // ignore
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction(label);
      setTimeout(() => setCopiedAction(null), 2000);
    } catch {
      // ignore
    }
  };

  // Severity style helper
  const getSeverityStyle = (sev: DependencySeverity) => {
    switch (sev) {
      case 'critical':
        return isDark
          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
          : 'border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-200';
      case 'high':
        return isDark
          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
          : 'border-amber-300 bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'medium':
        return isDark
          ? 'border-blue-500/40 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
          : 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200';
      case 'low':
      default:
        return isDark
          ? 'border-slate-500/40 bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30'
          : 'border-slate-300 bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    }
  };

  const getAccentBorder = (sev: DependencySeverity) => {
    switch (sev) {
      case 'critical':
        return 'border-l-rose-500';
      case 'high':
        return 'border-l-amber-500';
      case 'medium':
        return 'border-l-blue-500';
      case 'low':
      default:
        return 'border-l-slate-500';
    }
  };

  const panel = overviewPanelClass(isDark);
  const border = overviewBorderClass(isDark);
  const divide = overviewDivideClass(isDark);
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';

  return (
    <section className={`overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 ${border}`}>
        <div>
          <h2 className={`text-[15px] font-medium ${titleText}`}>Supply chain</h2>
          <p className={`mt-0.5 text-[13px] ${muted}`}>
            CVE advisories from OSV.dev for packages in your lockfile.
            {assessment?.scannedAt ? (
              <span className="opacity-80">
                {' '}
                · Last audit{' '}
                {new Date(assessment.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
          {packagesWithFixes.length > 0 ? (
            <button
              type="button"
              onClick={copyBulkFixCommands}
              className={isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-900'}
            >
              {copiedAction === 'bulk-upgrade' ? 'Fix commands copied' : `Copy all fixes (${packagesWithFixes.length})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={runVulnerabilityAudit}
            disabled={isAuditing || !inventory}
            className={
              isDark
                ? 'text-blue-400 hover:text-blue-300 disabled:opacity-50'
                : 'text-blue-600 hover:text-blue-800 disabled:opacity-50'
            }
          >
            {isAuditing ? 'Querying OSV.dev…' : assessment ? 'Re-audit' : 'Run audit'}
          </button>
        </div>
      </header>

      {auditError ? (
        <p className={`mx-5 mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:mx-6 ${
          isDark ? 'border-rose-500/25 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{auditError}</span>
        </p>
      ) : null}

      {/* ---------------------------------------------------- */}
      {/* 2. REAL-TIME AUDITING SCAN STATE                     */}
      {/* ---------------------------------------------------- */}
      {isAuditing && !assessment ? (
        <div className={`rounded-xl border p-5 ${
          isDark ? 'border-blue-500/20 bg-blue-500/[0.03]' : 'border-blue-200 bg-blue-50/40'
        }`}>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
            <div>
              <p className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                Scanning {inventory?.packages.length ? `${inventory.packages.length.toLocaleString()} locked dependencies` : 'packages'} against OSV.dev CVE database…
              </p>
              <p className={`mt-0.5 text-[11px] ${muted}`}>
                Checking for open-source vulnerability advisories, severity ratings, and remediation patches.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {['Critical', 'High', 'Medium / Low', 'Packages Checked'].map((label, idx) => (
              <div key={idx} className={`p-3.5 rounded-xl border animate-pulse ${
                isDark ? 'border-white/[0.04] bg-white/[0.02]' : 'border-slate-200 bg-slate-100/60'
              }`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>{label}</p>
                <div className={`h-6 w-12 rounded mt-1.5 ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />
              </div>
            ))}
          </div>
        </div>
      ) : assessment ? (
        <>
          <div
            className={`m-0 grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0 ${divide} ${border}`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter(prev => (prev === 'critical' ? 'all' : 'critical'));
                setCurrentPage(1);
              }}
              className={`px-5 py-4 text-left transition-colors sm:px-6 ${
                activeSeverityFilter === 'critical' ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : ''
              }`}
            >
              <span className={`block text-[13px] ${muted}`}>Critical</span>
              <span
                className={`mt-2 block text-xl font-medium tabular-nums tracking-tight ${
                  criticalCount > 0 ? overviewSeverityLabel(isDark, 'critical') : titleText
                }`}
              >
                {criticalCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter(prev => (prev === 'high' ? 'all' : 'high'));
                setCurrentPage(1);
              }}
              className={`px-5 py-4 text-left transition-colors sm:px-6 ${
                activeSeverityFilter === 'high' ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-50') : ''
              }`}
            >
              <span className={`block text-[13px] ${muted}`}>High</span>
              <span
                className={`mt-2 block text-xl font-medium tabular-nums tracking-tight ${
                  highCount > 0 ? overviewSeverityLabel(isDark, 'warning') : titleText
                }`}
              >
                {highCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter(prev => (prev === 'medium' ? 'all' : 'medium'));
                setCurrentPage(1);
              }}
              className={`px-5 py-4 text-left transition-colors sm:px-6 ${
                activeSeverityFilter === 'medium' || activeSeverityFilter === 'low'
                  ? isDark
                    ? 'bg-white/[0.04]'
                    : 'bg-slate-50'
                  : ''
              }`}
            >
              <span className={`block text-[13px] ${muted}`}>Medium / low</span>
              <span className={`mt-2 block text-xl font-medium tabular-nums tracking-tight ${titleText}`}>
                {mediumCount + lowCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter('all');
                setOnlyFixable(false);
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className={`px-5 py-4 text-left transition-colors sm:px-6 ${
                activeSeverityFilter === 'all' && !onlyFixable && !searchQuery
                  ? isDark
                    ? 'bg-white/[0.04]'
                    : 'bg-slate-50'
                  : ''
              }`}
            >
              <span className={`block text-[13px] ${muted}`}>Packages scanned</span>
              <span className={`mt-2 block text-xl font-medium tabular-nums tracking-tight ${overviewMetricValueAccent(isDark, 'info')}`}>
                {assessment.packagesChecked.toLocaleString()}
              </span>
              <span className={`mt-1 block text-xs ${muted}`}>{packageGroups.length} with advisories</span>
            </button>
          </div>

          <div className={`flex flex-col gap-2 border-b px-5 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3 sm:px-6 ${border}`}>
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${muted}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by package, version, CVE ID, or vulnerability..."
                className={`w-full rounded-xl border pl-9 pr-8 py-2 text-xs outline-none transition-colors ${
                  isDark
                    ? 'border-white/[0.08] bg-black/30 text-white placeholder:text-slate-600 focus:border-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded ${muted} hover:text-white`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Severity Pills, Sort & View Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Severity Pills */}
              <div className={`hidden sm:flex items-center p-0.5 rounded-lg border text-[11px] ${
                isDark ? 'border-white/[0.08] bg-black/25' : 'border-slate-200 bg-slate-100'
              }`}>
                {(['all', 'critical', 'high', 'medium'] as const).map(sev => {
                  const isSelected = activeSeverityFilter === sev;
                  const count = sev === 'all'
                    ? advisories.length
                    : sev === 'critical'
                    ? criticalCount
                    : sev === 'high'
                    ? highCount
                    : mediumCount;

                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => {
                        setActiveSeverityFilter(sev);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 rounded-md capitalize transition-colors font-medium ${
                        isSelected
                          ? (isDark ? 'bg-[#1E2024] text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                          : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      {sev} <span className="opacity-60 font-mono text-[9px]">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Fix Available Toggle */}
              {fixableCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOnlyFixable(!onlyFixable);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    onlyFixable
                      ? (isDark ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-800')
                      : (isDark ? 'border-white/[0.08] bg-black/20 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900')
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Fixes ({fixableCount})</span>
                </button>
              )}

              <Dropdown<'severity' | 'cves' | 'name'>
                options={[
                  { value: 'severity', label: 'Sort: Severity' },
                  { value: 'cves', label: 'Sort: CVE count' },
                  { value: 'name', label: 'Sort: Name (A–Z)' },
                ]}
                value={sortBy}
                onChange={setSortBy}
                size="sm"
                variant="subtle"
                fullWidth={false}
                className="min-w-[9.5rem]"
                triggerClassName={
                  isDark
                    ? '!rounded-lg !border-white/[0.08] !bg-black/30 !text-slate-300 !font-normal'
                    : '!rounded-lg !border-slate-200 !bg-slate-50 !text-slate-700 !font-normal'
                }
                menuClassName="!min-w-[11rem]"
              />

              {/* View Mode Switcher */}
              <div className={`flex items-center p-0.5 rounded-lg border ${
                isDark ? 'border-white/[0.08] bg-black/30' : 'border-slate-200 bg-slate-100'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('grouped');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'grouped'
                      ? (isDark ? 'bg-[#1E2024] text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                      : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  Group Packages ({packageGroups.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'list'
                      ? (isDark ? 'bg-[#1E2024] text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                      : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  All CVEs ({advisories.length})
                </button>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* 5. ADVISORIES CONTENT (ELEVATED DEVSECOPS CARDS)     */}
          {/* ---------------------------------------------------- */}
          {totalItems > 0 ? (
            <div className="space-y-3 px-5 pt-4 pb-5 sm:px-6 sm:pt-5">
              {/* GROUPED VIEW: BY VULNERABLE PACKAGE */}
              {viewMode === 'grouped' && pagedGroups.map(group => {
                const groupKey = `${group.packageName}@${group.version}`;
                const isExpanded = expandedGroups.has(groupKey);
                const hasFix = Boolean(group.recommendedFix);

                return (
                  <div
                    key={groupKey}
                    className={`rounded-xl border transition-all overflow-hidden ${getAccentBorder(group.highestSeverity)} border-l-4 ${
                      isDark
                        ? 'border-white/[0.08] bg-[#14161A] hover:border-white/[0.14] hover:bg-[#16181D]'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Left: Package info & severity breakdown */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            group.highestSeverity === 'critical'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                              : group.highestSeverity === 'high'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                          }`}>
                            <Package className="h-4.5 w-4.5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${getSeverityStyle(group.highestSeverity)}`}>
                                {group.highestSeverity}
                              </span>
                              <span className={`font-mono text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {group.packageName}
                              </span>
                              <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}>
                                v{group.version}
                              </span>

                              {/* Breakdown Tag */}
                              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                                isDark ? 'border-white/[0.08] bg-white/[0.02] text-slate-300' : 'border-slate-200 bg-white text-slate-700'
                              }`}>
                                {group.criticalCount > 0 ? `${group.criticalCount} Critical · ` : ''}
                                {group.highCount > 0 ? `${group.highCount} High · ` : ''}
                                {group.advisories.length} {group.advisories.length === 1 ? 'CVE' : 'CVEs'}
                              </span>

                              {/* Vulnerability Type Tags */}
                              {group.vulnerabilityTypes.map((tag, i) => (
                                <span
                                  key={i}
                                  className={`hidden sm:inline-flex text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                    isDark ? 'border-white/[0.06] bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Threat preview line on collapsed card */}
                            <div className="mt-1 flex items-center gap-1.5 text-xs">
                              {group.highestSeverity === 'critical' ? (
                                <Flame className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                              ) : (
                                <Bug className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              )}
                              <span className={`truncate text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                {group.topSummary}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Remediation Version Diff & Upgrade Action */}
                        <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                          {hasFix && (
                            <div className="flex items-center gap-2">
                              {/* Version bump diff indicator */}
                              <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs ${
                                isDark ? 'border-white/[0.06] bg-black/30' : 'border-slate-200 bg-slate-50'
                              }`}>
                                <span className={muted}>v{group.version}</span>
                                <ArrowRight className="h-3 w-3 text-emerald-400" />
                                <span className="font-semibold text-emerald-400">v{group.recommendedFix}</span>
                              </div>

                              {/* Upgrade terminal button */}
                              <button
                                type="button"
                                onClick={() => copyUpgradeCommand(group.packageName, group.recommendedFix!)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs ${
                                  copiedAction === `npm install ${group.packageName}@${group.recommendedFix}`
                                    ? 'border-emerald-500/60 bg-emerald-500/25 text-emerald-300'
                                    : (isDark
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                                      : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')
                                }`}
                                title={`Copy: npm install ${group.packageName}@${group.recommendedFix}`}
                              >
                                {copiedAction === `npm install ${group.packageName}@${group.recommendedFix}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Terminal className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {copiedAction === `npm install ${group.packageName}@${group.recommendedFix}`
                                    ? 'Copied npm cmd!'
                                    : `Upgrade to ${group.recommendedFix}`}
                                </span>
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(groupKey)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              isDark ? 'border-white/[0.08] hover:bg-white/[0.06] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                            aria-label={isExpanded ? 'Collapse advisories' : 'Expand advisories'}
                          >
                            <span>{isExpanded ? 'Hide' : `${group.advisories.length} CVEs`}</span>
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Individual CVE Security Bulletins */}
                    {isExpanded && (
                      <div className={`px-4 pb-4 pt-2 border-t space-y-2.5 ${
                        isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200/80 bg-slate-50/50'
                      }`}>
                        <div className="flex items-center justify-between py-1 text-[11px]">
                          <span className={muted}>
                            Detailed Security Advisories for <strong className={isDark ? 'text-white' : 'text-slate-900'}>{group.packageName}@{group.version}</strong>
                          </span>
                          <span className={`font-mono ${muted}`}>
                            {group.advisories.length} entries recorded
                          </span>
                        </div>

                        {group.advisories.map((advisory, idx) => {
                          const advTags = extractVulnerabilityTags(advisory.summary);

                          return (
                            <div
                              key={`${advisory.id}-${idx}`}
                              className={`p-3.5 rounded-xl border text-xs transition-all ${
                                isDark ? 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1]' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${getSeverityStyle(advisory.severity)}`}>
                                    {advisory.severity}
                                  </span>

                                  <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                                    isDark ? 'border-white/[0.08] bg-black/30 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                                  }`}>
                                    {advisory.id}
                                  </span>

                                  {advTags.map((tag, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                        isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
                                      }`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => copyText(advisory.id, advisory.id)}
                                    className={`inline-flex items-center gap-1 font-mono text-[10px] p-1 rounded transition-colors ${
                                      copiedAction === advisory.id ? 'text-emerald-400' : `${muted} hover:text-white`
                                    }`}
                                    title="Copy Advisory ID"
                                  >
                                    {copiedAction === advisory.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    <span>{copiedAction === advisory.id ? 'Copied ID' : 'Copy'}</span>
                                  </button>

                                  {advisory.id && (
                                    <a
                                      href={`https://osv.dev/vulnerability/${advisory.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:underline"
                                    >
                                      <span>OSV.dev</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {advisory.summary}
                              </p>

                              {advisory.fixedVersions.length > 0 && (
                                <div className={`mt-2.5 pt-2 border-t flex flex-wrap items-center justify-between gap-2 ${
                                  isDark ? 'border-white/[0.04]' : 'border-slate-100'
                                }`}>
                                  <span className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                                    Patched in: <strong>{advisory.fixedVersions.join(', ')}</strong>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => copyUpgradeCommand(advisory.packageName, advisory.fixedVersions[advisory.fixedVersions.length - 1])}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] border transition-colors ${
                                      copiedAction === `npm install ${advisory.packageName}@${advisory.fixedVersions[advisory.fixedVersions.length - 1]}`
                                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                                        : isDark
                                        ? 'border-white/[0.08] bg-black/30 text-slate-300 hover:text-white'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900'
                                    }`}
                                  >
                                    <Terminal className="h-2.5 w-2.5" />
                                    <span>npm i {advisory.packageName}@{advisory.fixedVersions[advisory.fixedVersions.length - 1]}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* LIST VIEW: ALL CVEs INDIVIDUALLY */}
              {viewMode === 'list' && pagedAdvisories.map((advisory, idx) => {
                const hasFix = advisory.fixedVersions.length > 0;
                const recFix = advisory.fixedVersions[advisory.fixedVersions.length - 1];
                const advTags = extractVulnerabilityTags(advisory.summary);

                return (
                  <div
                    key={`${advisory.id}-${idx}`}
                    className={`rounded-xl border p-4 transition-all overflow-hidden ${getAccentBorder(advisory.severity)} border-l-4 ${
                      isDark ? 'border-white/[0.08] bg-[#14161A] hover:border-white/[0.14]' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${getSeverityStyle(advisory.severity)}`}>
                          {advisory.severity}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <Package className="h-3.5 w-3.5 text-blue-400" />
                          <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {advisory.packageName}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                            isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}>
                            v{advisory.version}
                          </span>
                        </div>

                        <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                          isDark ? 'border-white/[0.08] bg-black/30 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                        }`}>
                          {advisory.id}
                        </span>

                        {advTags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {advisory.id && (
                        <a
                          href={`https://osv.dev/vulnerability/${advisory.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:underline"
                        >
                          <span>OSV.dev</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <p className={`mt-2.5 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {advisory.summary}
                    </p>

                    {/* Fix Recommendation Banner */}
                    {hasFix && (
                      <div className={`mt-3 p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${
                        isDark ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-emerald-200 bg-emerald-50/70'
                      }`}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span className="text-[11px] font-medium text-emerald-400">
                            Remediation: Upgrade to <span className="font-mono font-bold">v{recFix}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyUpgradeCommand(advisory.packageName, recFix)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors border ${
                            copiedAction === `npm install ${advisory.packageName}@${recFix}`
                              ? 'border-emerald-500/50 bg-emerald-500/30 text-emerald-200'
                              : (isDark ? 'border-white/[0.08] bg-black/30 hover:bg-black/50 text-emerald-300' : 'border-emerald-300 bg-white hover:bg-slate-100 text-emerald-800')
                          }`}
                        >
                          <Terminal className="h-3 w-3" />
                          <span>
                            {copiedAction === `npm install ${advisory.packageName}@${recFix}`
                              ? 'Copied command!'
                              : `npm i ${advisory.packageName}@${recFix}`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ---------------------------------------------------- */}
              {/* 6. PAGINATION BAR                                    */}
              {/* ---------------------------------------------------- */}
              {totalPages > 1 && (
                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-white/[0.06]">
                  <span className={`text-[11px] ${muted}`}>
                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} {viewMode === 'grouped' ? 'vulnerable packages' : 'advisories'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`p-1.5 rounded-lg border disabled:opacity-30 transition-colors ${
                        isDark ? 'border-white/[0.08] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-100'
                      }`}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="font-mono text-xs px-2">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-1.5 rounded-lg border disabled:opacity-30 transition-colors ${
                        isDark ? 'border-white/[0.08] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-100'
                      }`}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`mx-5 mt-4 mb-5 rounded-xl border p-8 text-center sm:mx-6 sm:mt-5 ${
              isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200 bg-slate-50'
            }`}>
              <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {searchQuery || activeSeverityFilter !== 'all' || onlyFixable
                  ? 'No advisories match your current filter criteria'
                  : 'Zero vulnerabilities detected in locked dependencies'}
              </p>
              <p className={`text-[11px] mt-1 ${muted}`}>
                {searchQuery || activeSeverityFilter !== 'all' || onlyFixable
                  ? 'Try clearing your search query or resetting severity filters.'
                  : 'All audited packages are up to date with zero known CVE advisories on OSV.dev.'}
              </p>
              {(searchQuery || activeSeverityFilter !== 'all' || onlyFixable) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveSeverityFilter('all');
                    setOnlyFixable(false);
                    setCurrentPage(1);
                  }}
                  className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isDark ? 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className={`p-6 text-center rounded-xl border ${
          isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200 bg-slate-50'
        }`}>
          <Lock className={`h-8 w-8 mx-auto mb-2 ${muted}`} />
          <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Dependency Audit Pending
          </p>
          <p className={`text-[11px] mt-1 ${muted}`}>
            Click "Audit Dependencies" to scan locked packages against the live OSV.dev CVE database.
          </p>
        </div>
      )}
    </section>
  );
});
