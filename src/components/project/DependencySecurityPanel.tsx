import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { CodebaseAnalysis, DependencyRiskAssessment, DependencyAdvisory, DependencySeverity } from '../../types/codebase';
import { scanNpmDependencyRisks } from '../../services/dependencyRiskService';
import { recalculateQualityWithDependencyRisk } from '../../services/codebaseAnalysisService';
import { useTheme } from '../../context/ThemeContext';

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
}

export const DependencySecurityPanel: React.FC<DependencySecurityPanelProps> = React.memo(({
  analysis,
  onUpdateAnalysis,
}) => {
  const { isDark } = useTheme();
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
  const [expandedReferences, setExpandedReferences] = useState<Set<string>>(new Set());
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const lastAuditedKeyRef = useRef<string | null>(null);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

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
          ? recalculateQualityWithDependencyRisk(analysis.quality, riskAssessment)
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
    const auditKey = `${analysis.rootPath}:${inventory?.packages.length || 0}`;
    if (!assessment && inventory && inventory.packages.length > 0 && lastAuditedKeyRef.current !== auditKey && !isAuditing) {
      lastAuditedKeyRef.current = auditKey;
      void runVulnerabilityAudit();
    }
  }, [assessment, inventory, analysis.rootPath, isAuditing, runVulnerabilityAudit]);

  // Sync existing assessment into quality assessment if not yet factored
  useEffect(() => {
    if (
      assessment &&
      analysis.quality &&
      !analysis.quality.dimensions.some(d => d.name === 'Dependency CVEs' && d.maxScore > 0)
    ) {
      const updatedQuality = recalculateQualityWithDependencyRisk(analysis.quality, assessment);
      if (onUpdateAnalysis) {
        onUpdateAnalysis({
          ...analysis,
          quality: updatedQuality,
        });
      }
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
    const map = new Map<string, PackageAdvisoryGroup>();

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

    return Array.from(map.values());
  }, [advisories]);

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

  const toggleRefExpand = (id: string) => {
    setExpandedReferences(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction(label);
      setTimeout(() => setCopiedAction(null), 2000);
    } catch {
      // ignore
    }
  };

  // Severity badge style helpers
  const getSeverityStyle = (sev: DependencySeverity) => {
    switch (sev) {
      case 'critical':
        return isDark
          ? 'border-rose-500/35 bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20'
          : 'border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-200';
      case 'high':
        return isDark
          ? 'border-amber-500/35 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20'
          : 'border-amber-300 bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'medium':
        return isDark
          ? 'border-blue-500/35 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20'
          : 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200';
      case 'low':
      default:
        return isDark
          ? 'border-slate-500/35 bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/20'
          : 'border-slate-300 bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    }
  };

  return (
    <section className={`rounded-xl border p-4 sm:p-5 transition-all ${panel}`}>
      {/* ---------------------------------------------------- */}
      {/* 1. SECTION HEADER                                    */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
            criticalCount > 0
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/25 shadow-xs shadow-rose-500/10'
              : highCount > 0
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/25 shadow-xs shadow-amber-500/10'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          }`}>
            {criticalCount > 0 ? (
              <ShieldAlert className="h-4.5 w-4.5 animate-pulse" />
            ) : highCount > 0 ? (
              <AlertTriangle className="h-4.5 w-4.5" />
            ) : (
              <ShieldCheck className="h-4.5 w-4.5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Dependency Vulnerabilities & CVE Advisories
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono border ${
                isDark ? 'border-white/[0.08] bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}>
                OSV.dev
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium border ${
                criticalCount > 0
                  ? (isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-700')
                  : highCount > 0
                  ? (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700')
                  : (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
              }`}>
                Factored into Health Score
              </span>
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>
              Automated CVE advisory & zero-day vulnerability audit mapped to locked packages.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {assessment?.scannedAt && (
            <span className={`hidden sm:inline-block text-[10px] font-mono ${muted}`}>
              Audited {new Date(assessment.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={runVulnerabilityAudit}
            disabled={isAuditing || !inventory}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60 ${
              isDark
                ? 'border-blue-400/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {isAuditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>{isAuditing ? 'Querying OSV.dev…' : assessment ? 'Re-audit CVEs' : 'Audit Dependencies'}</span>
          </button>
        </div>
      </div>

      {auditError && (
        <p className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 px-3.5 py-2.5 text-xs text-rose-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{auditError}</span>
        </p>
      )}

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
          {/* Skeleton stat boxes */}
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
          {/* ---------------------------------------------------- */}
          {/* 3. INTERACTIVE METRIC HUD CARDS                      */}
          {/* ---------------------------------------------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            {/* Card 1: Critical Severity */}
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter(prev => prev === 'critical' ? 'all' : 'critical');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                activeSeverityFilter === 'critical'
                  ? (isDark ? 'ring-2 ring-rose-500/60 border-rose-500/40 bg-rose-500/10' : 'ring-2 ring-rose-500 border-rose-300 bg-rose-50')
                  : criticalCount > 0
                  ? (isDark ? 'border-rose-500/25 bg-rose-500/[0.04] hover:border-rose-500/40' : 'border-rose-200 bg-rose-50/60 hover:border-rose-300')
                  : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]' : 'border-slate-200 bg-slate-50 hover:border-slate-300')
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${criticalCount > 0 ? 'text-rose-400' : muted}`}>
                  Critical Severity
                </span>
                {criticalCount > 0 && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold mt-1 tracking-tight ${criticalCount > 0 ? 'text-rose-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {criticalCount}
              </p>
              <p className={`mt-1 text-[10px] ${muted}`}>
                {criticalCount > 0 ? 'Immediate patch required' : 'Zero critical CVEs'}
              </p>
            </button>

            {/* Card 2: High Severity */}
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter(prev => prev === 'high' ? 'all' : 'high');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                activeSeverityFilter === 'high'
                  ? (isDark ? 'ring-2 ring-amber-500/60 border-amber-500/40 bg-amber-500/10' : 'ring-2 ring-amber-500 border-amber-300 bg-amber-50')
                  : highCount > 0
                  ? (isDark ? 'border-amber-500/25 bg-amber-500/[0.04] hover:border-amber-500/40' : 'border-amber-200 bg-amber-50/60 hover:border-amber-300')
                  : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]' : 'border-slate-200 bg-slate-50 hover:border-slate-300')
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${highCount > 0 ? 'text-amber-400' : muted}`}>
                  High Severity
                </span>
                <AlertTriangle className={`h-3.5 w-3.5 ${highCount > 0 ? 'text-amber-500' : muted}`} />
              </div>
              <p className={`text-2xl font-bold mt-1 tracking-tight ${highCount > 0 ? 'text-amber-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {highCount}
              </p>
              <p className={`mt-1 text-[10px] ${muted}`}>
                High exploitation risk
              </p>
            </button>

            {/* Card 3: Medium / Low */}
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter(prev => prev === 'medium' ? 'all' : 'medium');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                activeSeverityFilter === 'medium' || activeSeverityFilter === 'low'
                  ? (isDark ? 'ring-2 ring-blue-500/60 border-blue-500/40 bg-blue-500/10' : 'ring-2 ring-blue-500 border-blue-300 bg-blue-50')
                  : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]' : 'border-slate-200 bg-slate-50 hover:border-slate-300')
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                  Medium / Low
                </span>
                <Shield className={`h-3.5 w-3.5 ${mediumCount > 0 ? 'text-blue-500' : muted}`} />
              </div>
              <p className={`text-2xl font-bold mt-1 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {mediumCount + lowCount}
              </p>
              <p className={`mt-1 text-[10px] ${muted}`}>
                {mediumCount} medium · {lowCount} low
              </p>
            </button>

            {/* Card 4: Packages Checked */}
            <button
              type="button"
              onClick={() => {
                setActiveSeverityFilter('all');
                setOnlyFixable(false);
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                isDark ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                  Packages Checked
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold mt-1 tracking-tight text-emerald-500">
                {assessment.packagesChecked.toLocaleString()}
              </p>
              <p className={`mt-1 text-[10px] ${muted}`}>
                {packageGroups.length} vulnerable packages
              </p>
            </button>
          </div>

          {/* ---------------------------------------------------- */}
          {/* 4. SECURITY TOOLBAR: SEARCH, FILTERS & VIEW MODE     */}
          {/* ---------------------------------------------------- */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
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
                placeholder="Search by package, version, or CVE ID…"
                className={`w-full rounded-xl border pl-9 pr-8 py-2 text-xs outline-none transition-colors ${
                  isDark
                    ? 'border-white/[0.08] bg-black/25 text-white placeholder:text-slate-600 focus:border-blue-500'
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

            {/* Filter Pills, Fixable Toggle, View Switcher */}
            <div className="flex flex-wrap items-center gap-2">
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
          {/* 5. ADVISORIES CONTENT (GROUPED OR LIST)              */}
          {/* ---------------------------------------------------- */}
          {totalItems > 0 ? (
            <div className="space-y-3">
              {/* GROUPED VIEW: BY VULNERABLE PACKAGE */}
              {viewMode === 'grouped' && pagedGroups.map(group => {
                const groupKey = `${group.packageName}@${group.version}`;
                const isExpanded = expandedGroups.has(groupKey);
                const hasFix = Boolean(group.recommendedFix);

                return (
                  <div
                    key={groupKey}
                    className={`rounded-xl border transition-all ${
                      isDark ? 'border-white/[0.07] bg-black/25 hover:border-white/[0.12]' : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${getSeverityStyle(group.highestSeverity)}`}>
                          {group.highestSeverity}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="h-4 w-4 text-blue-400 shrink-0" />
                          <span className={`font-mono text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {group.packageName}
                          </span>
                          <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                            isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}>
                            v{group.version}
                          </span>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          isDark ? 'border-white/[0.08] bg-white/[0.02] text-slate-300' : 'border-slate-200 bg-white text-slate-700'
                        }`}>
                          {group.advisories.length} {group.advisories.length === 1 ? 'CVE' : 'CVEs'}
                        </span>
                      </div>

                      {/* Right: Fix Action and Expand button */}
                      <div className="flex items-center gap-2">
                        {hasFix && (
                          <button
                            type="button"
                            onClick={() => copyUpgradeCommand(group.packageName, group.recommendedFix!)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              copiedAction === `npm install ${group.packageName}@${group.recommendedFix}`
                                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                                : (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')
                            }`}
                            title={`Copy upgrade command: npm install ${group.packageName}@${group.recommendedFix}`}
                          >
                            {copiedAction === `npm install ${group.packageName}@${group.recommendedFix}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Terminal className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {copiedAction === `npm install ${group.packageName}@${group.recommendedFix}`
                                ? 'Copied upgrade cmd!'
                                : `Upgrade to ${group.recommendedFix}`}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(groupKey)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isDark ? 'border-white/[0.08] hover:bg-white/[0.05] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                          aria-label={isExpanded ? 'Collapse advisories' : 'Expand advisories'}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Individual CVEs under this Package */}
                    {isExpanded && (
                      <div className={`px-4 pb-4 pt-1 border-t space-y-2.5 ${
                        isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200/80 bg-white'
                      }`}>
                        {group.advisories.map((advisory, idx) => (
                          <div
                            key={`${advisory.id}-${idx}`}
                            className={`p-3 rounded-lg border text-xs ${
                              isDark ? 'border-white/[0.05] bg-white/[0.015]' : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${getSeverityStyle(advisory.severity)}`}>
                                  {advisory.severity}
                                </span>
                                <span className="font-mono text-xs font-semibold">{advisory.id}</span>
                              </div>
                              {advisory.id && (
                                <a
                                  href={`https://osv.dev/vulnerability/${advisory.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-400 hover:underline"
                                >
                                  <span>OSV.dev Advisory</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {advisory.summary}
                            </p>
                            {advisory.fixedVersions.length > 0 && (
                              <p className="mt-2 text-[11px] text-emerald-400 font-mono">
                                Patched in: {advisory.fixedVersions.join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* LIST VIEW: ALL ADVISORIES */}
              {viewMode === 'list' && pagedAdvisories.map((advisory, idx) => {
                const hasFix = advisory.fixedVersions.length > 0;
                const recFix = advisory.fixedVersions[advisory.fixedVersions.length - 1];
                const isRefExpanded = expandedReferences.has(advisory.id);

                return (
                  <div
                    key={`${advisory.id}-${idx}`}
                    className={`rounded-xl border p-4 transition-all ${
                      isDark ? 'border-white/[0.07] bg-black/25 hover:border-white/[0.12]' : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${getSeverityStyle(advisory.severity)}`}>
                          {advisory.severity}
                        </span>
                        <span className={`font-mono text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {advisory.packageName}
                        </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                          isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-200 text-slate-700'
                        }`}>
                          v{advisory.version}
                        </span>
                      </div>

                      {advisory.id && (
                        <a
                          href={`https://osv.dev/vulnerability/${advisory.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:underline"
                        >
                          <span>{advisory.id}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {advisory.summary}
                    </p>

                    {/* Fix Recommendation Banner */}
                    {hasFix && (
                      <div className={`mt-3 p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${
                        isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50/70'
                      }`}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span className="text-[11px] font-medium text-emerald-400">
                            Fix available: Upgrade to <span className="font-mono font-semibold">{recFix}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyUpgradeCommand(advisory.packageName, recFix)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                            copiedAction === `npm install ${advisory.packageName}@${recFix}`
                              ? 'bg-emerald-500/30 text-emerald-200'
                              : (isDark ? 'bg-black/30 hover:bg-black/50 text-emerald-300' : 'bg-white hover:bg-slate-100 text-emerald-800')
                          }`}
                        >
                          <Terminal className="h-3 w-3" />
                          <span>
                            {copiedAction === `npm install ${advisory.packageName}@${recFix}`
                              ? 'Copied cmd!'
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
                    <span className={`px-2.5 font-mono text-[11px] ${muted}`}>
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
            <div className={`rounded-xl border p-6 text-center ${
              isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50/50'
            }`}>
              <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
              <p className={`mt-2 text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-900'}`}>
                Zero CVE Advisories Matched
              </p>
              <p className={`mt-1 text-xs ${muted} max-w-md mx-auto`}>
                {searchQuery || activeSeverityFilter !== 'all' || onlyFixable
                  ? 'No vulnerability advisories matched your current filters or search terms.'
                  : `All ${assessment.packagesChecked} locked dependencies were verified against OSV.dev with zero known security advisories.`}
              </p>
            </div>
          )}
        </>
      ) : !inventory || inventory.packages.length === 0 ? (
        <div className={`rounded-xl border border-dashed p-6 text-center ${
          isDark ? 'border-white/[0.08] bg-black/10' : 'border-slate-200 bg-slate-50'
        }`}>
          <Lock className={`mx-auto h-6 w-6 ${muted}`} />
          <p className={`mt-2 text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            No Package Lockfile Detected
          </p>
          <p className={`mt-1 text-[11px] ${muted} max-w-md mx-auto`}>
            To audit dependency vulnerabilities, ensure your project contains a <code className="font-mono text-[10px]">package-lock.json</code> or <code className="font-mono text-[10px]">npm-shrinkwrap.json</code>.
          </p>
        </div>
      ) : (
        <div className={`rounded-xl border border-dashed p-6 text-center ${
          isDark ? 'border-white/[0.08] bg-black/10' : 'border-slate-200 bg-slate-50'
        }`}>
          <Lock className={`mx-auto h-6 w-6 ${muted}`} />
          <p className={`mt-2 text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Dependency Audit Ready
          </p>
          <p className={`mt-1 text-[11px] ${muted} max-w-md mx-auto`}>
            Click the button above to query OSV.dev for known security advisories.
          </p>
        </div>
      )}
    </section>
  );
});
