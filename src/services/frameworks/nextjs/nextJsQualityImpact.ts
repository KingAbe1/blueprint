import type { QualityCheck, QualityDimension, QualityFinding } from '../../../types/codebase';
import type {
  FrameworkProfile,
  NextJsArchitecturalImprovement,
  NextJsImprovementCategory,
  NextJsSpecialization,
} from '../../../types/framework';

const SECURITY_CATEGORIES = new Set<NextJsImprovementCategory>([
  'action-hygiene',
  'api-hygiene',
  'security',
]);

/** Max points for the dedicated Next.js practices dimension. */
export const NEXT_JS_PRACTICES_MAX_SCORE = 15;

/** Cap how many Next.js items appear in the shared Quality findings list. */
const MAX_QUALITY_FINDINGS = 8;

function priorityForSeverity(
  severity: NextJsArchitecturalImprovement['severity'],
): QualityFinding['priority'] {
  if (severity === 'critical') return 'high';
  if (severity === 'warning') return 'medium';
  return 'low';
}

function categoryForImprovement(
  category: NextJsImprovementCategory,
): NonNullable<QualityFinding['category']> {
  if (SECURITY_CATEGORIES.has(category)) return 'security';
  if (category === 'config-delivery') return 'delivery';
  if (category === 'seo-metadata') return 'documentation';
  if (category === 'route-resilience') return 'structure';
  if (category === 'data-caching' || category === 'modernization') return 'correctness';
  return 'maintainability';
}

function pointsForSeverity(severity: NextJsArchitecturalImprovement['severity']): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

export function isNextJsSpecialization(
  profile: FrameworkProfile | undefined,
): profile is FrameworkProfile<NextJsSpecialization> {
  return profile?.id === 'nextjs' && Boolean(profile.specialization);
}

export function nextJsImprovementsToQualityFindings(
  improvements: NextJsArchitecturalImprovement[],
): QualityFinding[] {
  return improvements.map(item => {
    const evidence = [
      item.file ? `${item.file}` : 'Next.js framework review',
      `category:${item.category}`,
      `severity:${item.severity}`,
    ];
    return {
      title: item.title,
      detail: `${item.impact} ${item.remediation}`,
      priority: priorityForSeverity(item.severity),
      category: categoryForImprovement(item.category),
      evidence,
      ruleId: `nextjs-${item.id}`.slice(0, 64),
      source: 'blueprint-nextjs',
      confidence: item.severity === 'optimization' ? 'low' : 'medium',
      location: item.file ? { path: item.file, line: item.line } : undefined,
    } satisfies QualityFinding;
  });
}

export interface NextJsQualityImpact {
  /** High-severity subset for the shared Quality findings list (avoids duplicating the full Next.js panel). */
  findings: QualityFinding[];
  dimension: QualityDimension;
  check: QualityCheck;
  criticalCount: number;
  warningCount: number;
  optimizationCount: number;
  totalImprovements: number;
}

export function computeNextJsQualityImpact(
  profile: FrameworkProfile | undefined,
): NextJsQualityImpact | undefined {
  if (!isNextJsSpecialization(profile)) return undefined;
  const specialization = profile.specialization as NextJsSpecialization;
  const improvements = specialization.improvements || [];

  let criticalCount = 0;
  let warningCount = 0;
  let optimizationCount = 0;
  let penalty = 0;

  const ranked = [...improvements].sort((a, b) => {
    const rank = { critical: 0, warning: 1, optimization: 2 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  for (const item of improvements) {
    penalty += pointsForSeverity(item.severity);
    if (item.severity === 'critical') criticalCount += 1;
    else if (item.severity === 'warning') warningCount += 1;
    else optimizationCount += 1;
  }

  const cappedPenalty = Math.min(NEXT_JS_PRACTICES_MAX_SCORE, penalty);
  const score = Math.max(0, NEXT_JS_PRACTICES_MAX_SCORE - cappedPenalty);

  // Per-finding evidence for the score modal (cap list length for readability).
  const scoreEvidence: NonNullable<QualityDimension['scoreEvidence']> = ranked.slice(0, 8).map(item => {
    const points = -pointsForSeverity(item.severity);
    const shortTitle = item.title.length > 64 ? `${item.title.slice(0, 61)}…` : item.title;
    return {
      label: shortTitle,
      points,
      detail: item.file
        ? `${item.severity} · ${item.file}`
        : `${item.severity} · ${item.category.replace(/-/g, ' ')}`,
    };
  });
  if (ranked.length > 8) {
    const omitted = ranked.slice(8);
    const omittedPts = omitted.reduce((sum, item) => sum + pointsForSeverity(item.severity), 0);
    scoreEvidence.push({
      label: `${omitted.length} more Next.js finding${omitted.length === 1 ? '' : 's'}`,
      points: -Math.min(omittedPts, Math.max(0, cappedPenalty - ranked.slice(0, 8).reduce((s, i) => s + pointsForSeverity(i.severity), 0))),
      detail: 'See the Next.js review panel for the full list.',
    });
  }

  const dimension: QualityDimension = {
    name: 'Next.js practices',
    score,
    maxScore: NEXT_JS_PRACTICES_MAX_SCORE,
    assessmentStatus: 'reviewed',
    summary:
      improvements.length === 0
        ? 'Actions, APIs, config, caching, security, SEO, and resilience checks found no issues.'
        : `${improvements.length} finding${improvements.length === 1 ? '' : 's'} in the Next.js review (${criticalCount} critical, ${warningCount} warning, ${optimizationCount} optimization). Full list is in the Next.js panel.`,
    scoreEvidence: scoreEvidence.length > 0 ? scoreEvidence : undefined,
  };

  // Quality findings: critical only (capped), plus one pointer when more exist in the panel.
  const criticalImprovements = improvements.filter(item => item.severity === 'critical');
  const findings = nextJsImprovementsToQualityFindings(criticalImprovements.slice(0, MAX_QUALITY_FINDINGS));

  const omittedCritical = Math.max(0, criticalImprovements.length - MAX_QUALITY_FINDINGS);
  const nonCritical = warningCount + optimizationCount;
  if (omittedCritical > 0 || nonCritical > 0) {
    findings.push({
      title: 'More findings in Next.js review',
      detail:
        [
          omittedCritical > 0
            ? `${omittedCritical} additional critical item${omittedCritical === 1 ? '' : 's'} omitted here.`
            : null,
          nonCritical > 0
            ? `${warningCount} warning and ${optimizationCount} optimization finding${nonCritical === 1 ? '' : 's'} live in the Next.js review panel.`
            : null,
          'They already affect the Next.js practices score.',
        ]
          .filter(Boolean)
          .join(' '),
      priority: omittedCritical > 0 || warningCount > 0 ? 'medium' : 'low',
      category: 'maintainability',
      evidence: ['See Overview → Next.js review'],
      ruleId: 'nextjs-see-panel',
      source: 'blueprint-nextjs',
      confidence: 'medium',
    });
  }

  const check: QualityCheck = {
    id: 'nextjs-framework-review',
    name: 'Next.js architecture review',
    category: criticalCount > 0 || warningCount > 0 ? 'security' : 'maintainability',
    status:
      improvements.length === 0
        ? 'passed'
        : criticalCount > 0
          ? 'issues'
          : warningCount > 0
            ? 'issues'
            : 'incomplete',
    summary:
      improvements.length === 0
        ? 'Next.js practices dimension is clean (15/15).'
        : `Next.js practices scored ${score}/${NEXT_JS_PRACTICES_MAX_SCORE} from ${improvements.length} review finding${improvements.length === 1 ? '' : 's'}.`,
    findingCount: improvements.length,
  };

  return {
    findings,
    dimension,
    check,
    criticalCount,
    warningCount,
    optimizationCount,
    totalImprovements: improvements.length,
  };
}
