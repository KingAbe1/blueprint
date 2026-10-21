import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  NodeJsSpecialization,
  NodeJsArchitecturalImprovement,
  NodeJsImprovementCategory,
} from '../../types/framework';
import type { CodebaseAnalysis } from '../../types/codebase';
import {
  overviewBorderClass,
  overviewDivideClass,
  overviewMetricValueAccent,
  overviewPanelClass,
  overviewRowEmphasis,
  overviewSeverityLabel,
  type OverviewEmphasis,
} from './overviewUi';
import { FindingAiExplanation, FindingStaticCopy } from './FindingAiExplanation';

interface NodeJsSpecializationPanelProps {
  specialization: NodeJsSpecialization;
  rootName: string;
  analysis?: CodebaseAnalysis;
}

const CATEGORY_LABELS: Record<'all' | NodeJsImprovementCategory, string> = {
  all: 'All',
  'route-hygiene': 'Routes',
  middleware: 'Middleware',
  'error-handling': 'Errors',
  'config-delivery': 'Config',
  security: 'Security',
  'async-hygiene': 'Async',
  'data-modeling': 'Data',
  modernization: 'Modern',
};

const CATEGORY_KEYS = [
  'all',
  'route-hygiene',
  'middleware',
  'error-handling',
  'config-delivery',
  'security',
  'async-hygiene',
  'data-modeling',
  'modernization',
] as const;

const SEVERITY_KEYS = ['all', 'critical', 'warning', 'optimization'] as const;
const SEVERITY_LABELS: Record<(typeof SEVERITY_KEYS)[number], string> = {
  all: 'All',
  critical: 'Critical',
  warning: 'Warning',
  optimization: 'Optimization',
};
const SEVERITY_RANK: Record<NodeJsArchitecturalImprovement['severity'], number> = {
  critical: 0,
  warning: 1,
  optimization: 2,
};

function rowEmphasisForSeverity(severity: NodeJsArchitecturalImprovement['severity']): OverviewEmphasis {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function severityDotClass(isDark: boolean, sev: 'critical' | 'warning' | 'optimization'): string {
  if (sev === 'critical') return isDark ? 'bg-rose-400' : 'bg-rose-600';
  if (sev === 'warning') return isDark ? 'bg-amber-400' : 'bg-amber-500';
  return isDark ? 'bg-blue-400' : 'bg-blue-500';
}

function categoryChipClass(isDark: boolean, selected: boolean): string {
  const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';
  const base = `inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${focus}`;
  return selected
    ? isDark
      ? `${base} border-blue-500/45 bg-blue-500/10 font-medium text-slate-100`
      : `${base} border-blue-300 bg-blue-50 font-medium text-slate-900`
    : isDark
      ? `${base} border-white/[0.06] text-slate-500 hover:border-white/12 hover:text-slate-300`
      : `${base} border-slate-200/80 text-slate-600 hover:border-slate-300 hover:text-slate-900`;
}

function severityChipClass(
  isDark: boolean,
  sev: (typeof SEVERITY_KEYS)[number],
  selected: boolean,
): string {
  const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';
  const base = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${focus}`;
  if (sev === 'all') {
    return selected
      ? isDark
        ? `${base} border-white/20 bg-white/[0.08] font-medium text-slate-100`
        : `${base} border-slate-300 bg-white font-medium text-slate-900 shadow-xs`
      : isDark
        ? `${base} border-white/[0.06] text-slate-400 hover:border-white/14 hover:text-slate-200`
        : `${base} border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900`;
  }
  if (sev === 'critical') {
    return selected
      ? isDark
        ? `${base} border-rose-500/45 bg-rose-500/12 font-medium text-rose-300`
        : `${base} border-rose-300 bg-rose-50 font-medium text-rose-800`
      : isDark
        ? `${base} border-white/[0.06] text-slate-400 hover:border-rose-500/35 hover:text-rose-200/90`
        : `${base} border-slate-200 text-slate-600 hover:border-rose-200 hover:text-rose-800`;
  }
  if (sev === 'warning') {
    return selected
      ? isDark
        ? `${base} border-amber-500/45 bg-amber-500/10 font-medium text-amber-200`
        : `${base} border-amber-300 bg-amber-50 font-medium text-amber-900`
      : isDark
        ? `${base} border-white/[0.06] text-slate-400 hover:border-amber-500/35 hover:text-amber-200/90`
        : `${base} border-slate-200 text-slate-600 hover:border-amber-200 hover:text-amber-900`;
  }
  return selected
    ? isDark
      ? `${base} border-blue-500/40 bg-blue-500/10 font-medium text-blue-200`
      : `${base} border-blue-300 bg-blue-50 font-medium text-blue-800`
    : isDark
      ? `${base} border-white/[0.06] text-slate-400 hover:border-blue-500/30 hover:text-blue-200/90`
      : `${base} border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-800`;
}

function metricCell(
  isDark: boolean,
  muted: string,
  label: string,
  value: React.ReactNode,
  detail: React.ReactNode,
  emphasis: OverviewEmphasis,
) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <dt className={`text-[13px] ${muted}`}>{label}</dt>
      <dd className={`mt-2 text-xl font-medium tabular-nums tracking-tight ${overviewMetricValueAccent(isDark, emphasis)}`}>
        {value}
      </dd>
      <dd className={`mt-1.5 text-xs leading-relaxed ${muted}`}>{detail}</dd>
    </div>
  );
}

function runtimeLabel(style: NodeJsSpecialization['runtimeStyle']): string {
  if (style === 'node-http') return 'Node HTTP';
  if (style === 'not-identified') return 'Node.js';
  if (style === 'mixed') return 'mixed runtimes';
  return style.charAt(0).toUpperCase() + style.slice(1);
}

export const NodeJsSpecializationPanel: React.FC<NodeJsSpecializationPanelProps> = ({
  specialization,
  analysis,
}) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-slate-100' : 'text-slate-900';

  const [categoryFilter, setCategoryFilter] = useState<'all' | NodeJsImprovementCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'optimization'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAllImprovements, setShowAllImprovements] = useState(false);
  const IMPROVEMENTS_PREVIEW_COUNT = 8;

  const improvements = specialization?.improvements || [];
  const routeAudit = specialization.routeAudit;
  const middlewareAudit = specialization.middlewareAudit;
  const resilienceAudit = specialization.resilienceAudit;
  const securityAudit = specialization.securityAudit;
  const configAudit = specialization.configAudit;
  const dataModelAudit = specialization.dataModelAudit;

  const filteredImprovements = useMemo(() => {
    return improvements
      .filter(item => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
        return true;
      })
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }, [improvements, categoryFilter, severityFilter]);

  const visibleImprovements = useMemo(() => {
    if (showAllImprovements) return filteredImprovements;
    return filteredImprovements.slice(0, IMPROVEMENTS_PREVIEW_COUNT);
  }, [filteredImprovements, showAllImprovements]);

  const hiddenImprovementCount = Math.max(0, filteredImprovements.length - visibleImprovements.length);

  useEffect(() => {
    setShowAllImprovements(false);
  }, [categoryFilter, severityFilter]);

  const criticalCount = improvements.filter(i => i.severity === 'critical').length;
  const warningCount = improvements.filter(i => i.severity === 'warning').length;
  const optimizationCount = improvements.filter(i => i.severity === 'optimization').length;
  const hasActiveFilters = categoryFilter !== 'all' || severityFilter !== 'all';

  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | NodeJsImprovementCategory, number> = {
      all: improvements.length,
      'route-hygiene': 0,
      middleware: 0,
      'error-handling': 0,
      'config-delivery': 0,
      security: 0,
      'async-hygiene': 0,
      'data-modeling': 0,
      modernization: 0,
    };
    for (const item of improvements) {
      if (item.category in counts) counts[item.category] += 1;
    }
    return counts;
  }, [improvements]);

  const visibleCategoryKeys = useMemo(
    () => CATEGORY_KEYS.filter(cat => cat === 'all' || categoryCounts[cat] > 0),
    [categoryCounts],
  );

  const panel = overviewPanelClass(isDark);
  const divide = overviewDivideClass(isDark);
  const border = overviewBorderClass(isDark);

  const routeEmphasis: OverviewEmphasis =
    routeAudit.unvalidatedFilesCount > 0 || routeAudit.unprotectedFilesCount > 0 ? 'warning' : 'neutral';
  const middlewareEmphasis: OverviewEmphasis =
    middlewareAudit.missingTrustProxy ||
    !middlewareAudit.helmetOrHeadersPresent ||
    !middlewareAudit.errorMiddlewarePresent
      ? 'warning'
      : 'neutral';
  const resilienceEmphasis: OverviewEmphasis = !resilienceAudit.hasUnhandledRejectionHandler
    ? 'warning'
    : 'neutral';
  const committedEnvCount = configAudit.committedEnvFiles?.length || 0;
  const criticalSecurityCount =
    securityAudit.dangerousPatternFiles.length +
    securityAudit.hardcodedSecretFiles.length +
    (securityAudit.sqlInjectionFiles?.length || 0) +
    (securityAudit.pathTraversalFiles?.length || 0) +
    committedEnvCount;
  const securityEmphasis: OverviewEmphasis =
    criticalSecurityCount > 0
      ? 'critical'
      : securityAudit.issueCount > 0 ||
          (securityAudit.weakCookieFiles?.length || 0) > 0 ||
          (securityAudit.webhookUnsignedFiles?.length || 0) > 0 ||
          (securityAudit.weakJwtFiles?.length || 0) > 0
        ? 'warning'
        : 'neutral';
  const configEmphasis: OverviewEmphasis =
    configAudit.eolNodeEngine || committedEnvCount > 0 || configAudit.issueCount > 0 ? 'warning' : 'neutral';
  const dataEmphasis: OverviewEmphasis =
    (dataModelAudit?.modelsWithSensitiveFields.length || 0) > 0
      ? 'warning'
      : (dataModelAudit?.issueCount || 0) > 0
        ? 'warning'
        : 'neutral';

  const ormLabel = (() => {
    const style = dataModelAudit?.ormStyle || 'none';
    if (style === 'none') return 'No ORM detected';
    if (style === 'sql-migrations') return 'SQL migrations';
    if (style === 'mixed') return 'Multiple ORMs';
    return style.charAt(0).toUpperCase() + style.slice(1);
  })();

  const copyFixPrompt = useCallback(async (item: NodeJsArchitecturalImprovement) => {
    const prompt = `### Node.js Architectural Improvement Request
**Issue:** ${item.title}
**Category:** ${item.category} | **Severity:** ${item.severity.toUpperCase()}
${item.file ? `**File:** \`${item.file}\`` : ''}

### Architectural Impact
${item.impact}

### Recommended Engineering Solution
${item.remediation}

### Task
Refactor the code to implement this recommendation. Follow modern Node.js server conventions for the detected runtime (Express, Fastify, Koa, Hono, Nest, or http).`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  }, []);

  const severityCount = (sev: 'all' | 'critical' | 'warning' | 'optimization') => {
    if (sev === 'all') return improvements.length;
    if (sev === 'critical') return criticalCount;
    if (sev === 'warning') return warningCount;
    return optimizationCount;
  };

  const headerMeta = [
    specialization.version ? `Node ${specialization.version}` : 'Node.js',
    runtimeLabel(specialization.runtimeStyle),
    configAudit.isEsm ? 'ESM' : null,
    specialization.entryFiles.length ? `${specialization.entryFiles.length} entry` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={`overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`border-b px-5 py-5 sm:px-6 ${border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`text-[15px] font-medium leading-snug ${title}`}>Node.js review</h2>
            <p className={`mt-1 text-[13px] ${muted}`}>{headerMeta}</p>
          </div>
          {improvements.length > 0 ? (
            <p className={`text-[13px] tabular-nums ${muted}`}>
              {criticalCount > 0 ? (
                <span className={overviewSeverityLabel(isDark, 'critical')}>{criticalCount} critical</span>
              ) : null}
              {criticalCount > 0 && warningCount > 0 ? <span> · </span> : null}
              {warningCount > 0 ? (
                <span className={overviewSeverityLabel(isDark, 'warning')}>
                  {warningCount} warning{warningCount === 1 ? '' : 's'}
                </span>
              ) : null}
              {criticalCount === 0 && warningCount === 0 ? (
                <span>
                  {improvements.length} optimization{improvements.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      <dl className={`grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-3 ${divide}`}>
        {metricCell(
          isDark,
          muted,
          'Handlers',
          routeAudit.totalHandlers,
          routeAudit.unvalidatedFilesCount > 0 || routeAudit.unprotectedFilesCount > 0 ? (
            <>
              {routeAudit.unvalidatedFilesCount > 0 ? (
                <span className={overviewSeverityLabel(isDark, 'warning')}>
                  {routeAudit.unvalidatedFilesCount} without validation
                </span>
              ) : null}
              {routeAudit.unvalidatedFilesCount > 0 && routeAudit.unprotectedFilesCount > 0 ? (
                <span> · </span>
              ) : null}
              {routeAudit.unprotectedFilesCount > 0 ? (
                <span className={overviewSeverityLabel(isDark, 'warning')}>
                  {routeAudit.unprotectedFilesCount} without auth
                </span>
              ) : null}
            </>
          ) : (
            `${routeAudit.filesCount} route module${routeAudit.filesCount === 1 ? '' : 's'}`
          ),
          routeEmphasis,
        )}
        {metricCell(
          isDark,
          muted,
          'Middleware',
          middlewareAudit.issueCount,
          middlewareAudit.missingTrustProxy ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>Missing trust proxy</span>
          ) : !middlewareAudit.helmetOrHeadersPresent ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>Missing security headers</span>
          ) : !middlewareAudit.errorMiddlewarePresent ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>No central error handler</span>
          ) : middlewareAudit.rateLimitPresent ? (
            'Helmet · CORS · rate limit signals present'
          ) : (
            'Baseline middleware reviewed'
          ),
          middlewareEmphasis,
        )}
        {metricCell(
          isDark,
          muted,
          'Resilience',
          resilienceAudit.issueCount,
          resilienceAudit.hasUnhandledRejectionHandler ? (
            resilienceAudit.hasGracefulShutdownSignal ? 'Rejection + shutdown handlers' : 'Unhandled rejection covered'
          ) : (
            <span className={overviewSeverityLabel(isDark, 'warning')}>No unhandledRejection handler</span>
          ),
          resilienceEmphasis,
        )}
        {metricCell(
          isDark,
          muted,
          'Security',
          securityAudit.issueCount + committedEnvCount,
          committedEnvCount > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'critical')}>
              {committedEnvCount} committed .env file{committedEnvCount === 1 ? '' : 's'}
            </span>
          ) : securityAudit.issueCount === 0 ? (
            'No injection, JWT, webhook, or cookie issues flagged'
          ) : criticalSecurityCount > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'critical')}>
              {criticalSecurityCount} critical signal{criticalSecurityCount === 1 ? '' : 's'}
            </span>
          ) : (securityAudit.weakJwtFiles?.length || 0) > 0 ||
            (securityAudit.webhookUnsignedFiles?.length || 0) > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>
              {(securityAudit.weakJwtFiles?.length || 0) > 0 ? 'Weak JWT' : null}
              {(securityAudit.weakJwtFiles?.length || 0) > 0 &&
              (securityAudit.webhookUnsignedFiles?.length || 0) > 0
                ? ' · '
                : null}
              {(securityAudit.webhookUnsignedFiles?.length || 0) > 0 ? 'Unsigned webhooks' : null}
            </span>
          ) : (securityAudit.weakCookieFiles?.length || 0) > 0 ||
            (securityAudit.unboundedUploadFiles?.length || 0) > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>
              {(securityAudit.weakCookieFiles?.length || 0) > 0 ? 'Weak cookies' : null}
              {(securityAudit.weakCookieFiles?.length || 0) > 0 &&
              (securityAudit.unboundedUploadFiles?.length || 0) > 0
                ? ' · '
                : null}
              {(securityAudit.unboundedUploadFiles?.length || 0) > 0 ? 'Upload limits' : null}
            </span>
          ) : (
            `${securityAudit.issueCount} security signal${securityAudit.issueCount === 1 ? '' : 's'}`
          ),
          securityEmphasis,
        )}
        {metricCell(
          isDark,
          muted,
          'Config',
          configAudit.issueCount,
          configAudit.eolNodeEngine ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>EOL Node engine</span>
          ) : committedEnvCount > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'critical')}>Env files in tree</span>
          ) : configAudit.missingTypecheckSignal ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>No typecheck signal</span>
          ) : configAudit.hasEnginesField ? (
            configAudit.isEsm ? 'engines.node · ESM' : 'engines.node set'
          ) : (
            <span className={overviewSeverityLabel(isDark, 'warning')}>No engines.node</span>
          ),
          configEmphasis,
        )}
        {metricCell(
          isDark,
          muted,
          'Data models',
          dataModelAudit?.modelCount ?? 0,
          !dataModelAudit || dataModelAudit.ormStyle === 'none' ? (
            'No Prisma/Drizzle/TypeORM/Mongoose schema found'
          ) : (dataModelAudit.modelsWithSensitiveFields.length || 0) > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>
              {dataModelAudit.modelsWithSensitiveFields.length} with sensitive fields
            </span>
          ) : dataModelAudit.issueCount > 0 ? (
            <span className={overviewSeverityLabel(isDark, 'warning')}>
              {ormLabel} · {dataModelAudit.issueCount} issue{dataModelAudit.issueCount === 1 ? '' : 's'}
            </span>
          ) : (
            `${ormLabel} · ${dataModelAudit.migrationFilesCount} migration${dataModelAudit.migrationFilesCount === 1 ? '' : 's'}`
          ),
          dataEmphasis,
        )}
        {metricCell(
          isDark,
          muted,
          'Runtime',
          runtimeLabel(specialization.runtimeStyle),
          specialization.entryFiles[0] || 'Server entry not identified',
          'neutral',
        )}
      </dl>

      {improvements.length > 0 ? (
        <div className={`border-t px-5 py-3 sm:px-6 ${border}`}>
          <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className={`text-sm font-medium ${title}`}>Findings</h3>
            <span className={`text-xs tabular-nums ${muted}`}>
              {hasActiveFilters ? (
                <>
                  <span className={`font-medium ${title}`}>{filteredImprovements.length}</span>
                  <span className="opacity-70"> / {improvements.length}</span>
                </>
              ) : (
                <span className={`font-medium ${title}`}>{improvements.length}</span>
              )}
            </span>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setSeverityFilter('all');
                }}
                className={
                  isDark
                    ? 'ml-auto text-[11px] font-medium text-slate-400 hover:text-slate-200'
                    : 'ml-auto text-[11px] font-medium text-slate-600 hover:text-slate-900'
                }
              >
                Reset filters
              </button>
            ) : null}
          </div>

          <div
            className={
              isDark
                ? 'overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2'
                : 'overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-2'
            }
          >
            <div className="flex min-w-max flex-col gap-2 sm:min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                <span className={`shrink-0 text-[11px] font-medium ${muted}`}>Category</span>
                <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter by category">
                  {visibleCategoryKeys.map(cat => {
                    const selected = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setCategoryFilter(cat)}
                        className={categoryChipClass(isDark, selected)}
                      >
                        <span>{CATEGORY_LABELS[cat]}</span>
                        <span className={`tabular-nums text-[11px] ${selected ? 'opacity-85' : 'opacity-55'}`}>
                          {categoryCounts[cat]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                <span className={`shrink-0 text-[11px] font-medium ${muted}`}>Severity</span>
                <div className="flex flex-wrap items-center gap-1" aria-label="Filter by severity">
                  {SEVERITY_KEYS.map(sev => {
                    const selected = severityFilter === sev;
                    const count = severityCount(sev);
                    return (
                      <button
                        key={sev}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSeverityFilter(sev)}
                        className={`${severityChipClass(isDark, sev, selected)} !px-2.5 !py-1 text-[12px]`}
                      >
                        {sev !== 'all' && count > 0 ? (
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severityDotClass(isDark, sev)}`} aria-hidden />
                        ) : null}
                        <span>{SEVERITY_LABELS[sev]}</span>
                        <span className={`tabular-nums text-[11px] ${selected ? 'opacity-90' : 'opacity-55'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {filteredImprovements.length > 0 ? (
        <ul className={`divide-y ${divide}`}>
          {visibleImprovements.map(item => {
            const isCopied = copiedId === item.id;
            const rowClass = overviewRowEmphasis(isDark, rowEmphasisForSeverity(item.severity));
            return (
              <li key={item.id} className={`py-5 pr-5 sm:pr-6 ${rowClass || 'px-5 sm:px-6'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-snug ${title}`}>{item.title}</p>
                    <p className={`mt-1 text-xs ${muted}`}>
                      <span className={overviewSeverityLabel(isDark, item.severity)}>{item.severity}</span>
                      <span> · {CATEGORY_LABELS[item.category]}</span>
                      {item.file ? (
                        <>
                          <span> · </span>
                          <span className="font-mono text-[11px]">{item.file}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyFixPrompt(item)}
                    className={`shrink-0 text-xs font-medium transition-colors ${
                      isCopied
                        ? isDark
                          ? 'text-emerald-400'
                          : 'text-emerald-700'
                        : isDark
                          ? 'text-blue-400 hover:text-blue-300'
                          : 'text-blue-600 hover:text-blue-800'
                    }`}
                  >
                    {isCopied ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </span>
                    ) : (
                      'Copy prompt'
                    )}
                  </button>
                </div>
                <FindingStaticCopy impact={item.impact} remediation={item.remediation} />
                <FindingAiExplanation
                  findingId={item.id}
                  frameworkLabel="Node.js"
                  title={item.title}
                  category={item.category}
                  severity={item.severity}
                  impact={item.impact}
                  remediation={item.remediation}
                  file={item.file}
                  analysis={analysis}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center sm:px-6">
          <CheckCircle2 className={`mx-auto h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <p className={`mt-2 text-sm font-medium ${title}`}>
            {improvements.length === 0 ? 'No Node.js findings' : 'Nothing in this filter'}
          </p>
          <p className={`mt-1 text-xs ${muted}`}>
            {improvements.length === 0
              ? 'Routes, middleware, resilience, config, and security checks did not flag issues in this scan.'
              : 'Try another category or severity.'}
          </p>
        </div>
      )}

      {(hiddenImprovementCount > 0 || showAllImprovements) && (
        <div className={`border-t px-5 py-3 sm:px-6 ${border}`}>
          {hiddenImprovementCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllImprovements(true)}
              className={`text-[13px] font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
            >
              Show {hiddenImprovementCount} more
            </button>
          ) : null}
          {showAllImprovements && filteredImprovements.length > IMPROVEMENTS_PREVIEW_COUNT ? (
            <button
              type="button"
              onClick={() => setShowAllImprovements(false)}
              className={
                isDark ? 'text-[13px] text-slate-500 hover:text-slate-300' : 'text-[13px] text-slate-500 hover:text-slate-700'
              }
            >
              Show fewer
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
};
