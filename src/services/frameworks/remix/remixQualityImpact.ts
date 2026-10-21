import type { QualityCheck, QualityDimension, QualityFinding } from '../../../types/codebase';
import type {
  FrameworkProfile,
  RemixArchitecturalImprovement,
  RemixImprovementCategory,
  RemixSpecialization,
} from '../../../types/framework';

const SECURITY_CATEGORIES = new Set<RemixImprovementCategory>([
  'action-hygiene',
  'loader-hygiene',
  'security',
]);

export const REMIX_PRACTICES_MAX_SCORE = 15;
const MAX_QUALITY_FINDINGS = 8;

function priorityForSeverity(
  severity: RemixArchitecturalImprovement['severity'],
): QualityFinding['priority'] {
  if (severity === 'critical') return 'high';
  if (severity === 'warning') return 'medium';
  return 'low';
}

function categoryForImprovement(
  category: RemixImprovementCategory,
): NonNullable<QualityFinding['category']> {
  if (SECURITY_CATEGORIES.has(category)) return 'security';
  if (category === 'config-delivery') return 'delivery';
  if (category === 'seo-metadata') return 'documentation';
  if (category === 'route-resilience') return 'structure';
  if (category === 'data-caching') return 'performance';
  if (category === 'modernization') return 'correctness';
  return 'maintainability';
}

function pointsForSeverity(severity: RemixArchitecturalImprovement['severity']): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

export function isRemixSpecialization(
  profile: FrameworkProfile | undefined,
): profile is FrameworkProfile<RemixSpecialization> {
  return profile?.id === 'remix' && Boolean(profile.specialization);
}

export function computeRemixQualityImpact(
  profile: FrameworkProfile | undefined,
): {
  findings: QualityFinding[];
  dimension: QualityDimension;
  check: QualityCheck;
  criticalCount: number;
  warningCount: number;
  optimizationCount: number;
  totalImprovements: number;
} | undefined {
  if (!isRemixSpecialization(profile)) return undefined;
  const specialization = profile.specialization as RemixSpecialization;
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

  const cappedPenalty = Math.min(REMIX_PRACTICES_MAX_SCORE, penalty);
  const score = Math.max(0, REMIX_PRACTICES_MAX_SCORE - cappedPenalty);

  const scoreEvidence: NonNullable<QualityDimension['scoreEvidence']> = ranked.slice(0, 8).map(item => {
    const shortTitle = item.title.length > 64 ? `${item.title.slice(0, 61)}…` : item.title;
    return {
      label: shortTitle,
      points: -pointsForSeverity(item.severity),
      detail: item.file ? `${item.severity} · ${item.file}` : `${item.severity} · ${item.category.replace(/-/g, ' ')}`,
    };
  });
  if (ranked.length > 8) {
    scoreEvidence.push({
      label: `${ranked.length - 8} more Remix finding${ranked.length - 8 === 1 ? '' : 's'}`,
      points: 0,
      detail: 'See the Remix review panel for the full list.',
    });
  }

  const dimension: QualityDimension = {
    name: 'Remix practices',
    score,
    maxScore: REMIX_PRACTICES_MAX_SCORE,
    assessmentStatus: 'reviewed',
    summary:
      improvements.length === 0
        ? 'Loaders, actions, boundaries, config, security, and SEO checks found no issues.'
        : `${improvements.length} finding${improvements.length === 1 ? '' : 's'} in the Remix review (${criticalCount} critical, ${warningCount} warning, ${optimizationCount} optimization).`,
    scoreEvidence: scoreEvidence.length > 0 ? scoreEvidence : undefined,
  };

  const criticalImprovements = improvements.filter(item => item.severity === 'critical');
  const findings: QualityFinding[] = criticalImprovements.slice(0, MAX_QUALITY_FINDINGS).map(item => ({
    title: item.title,
    detail: `${item.impact} ${item.remediation}`,
    priority: priorityForSeverity(item.severity),
    category: categoryForImprovement(item.category),
    evidence: [item.file || 'Remix framework review', `category:${item.category}`, `severity:${item.severity}`],
    ruleId: `remix-${item.id}`.slice(0, 64),
    source: 'blueprint-remix',
    confidence: 'medium',
    location: item.file ? { path: item.file, line: item.line } : undefined,
  }));

  const omittedCritical = Math.max(0, criticalImprovements.length - MAX_QUALITY_FINDINGS);
  const nonCritical = warningCount + optimizationCount;
  if (omittedCritical > 0 || nonCritical > 0) {
    findings.push({
      title: 'More findings in Remix review',
      detail: [
        omittedCritical > 0 ? `${omittedCritical} additional critical item(s) omitted here.` : null,
        nonCritical > 0
          ? `${warningCount} warning and ${optimizationCount} optimization finding(s) live in the Remix review panel.`
          : null,
        'They already affect the Remix practices score.',
      ]
        .filter(Boolean)
        .join(' '),
      priority: omittedCritical > 0 || warningCount > 0 ? 'medium' : 'low',
      category: 'maintainability',
      evidence: ['See Overview → Remix review'],
      ruleId: 'remix-see-panel',
      source: 'blueprint-remix',
      confidence: 'medium',
    });
  }

  const check: QualityCheck = {
    id: 'remix-framework-review',
    name: 'Remix architecture review',
    category: criticalCount > 0 || warningCount > 0 ? 'security' : 'maintainability',
    status:
      improvements.length === 0 ? 'passed' : criticalCount > 0 || warningCount > 0 ? 'issues' : 'incomplete',
    summary:
      improvements.length === 0
        ? 'Remix practices dimension is clean (15/15).'
        : `Remix practices scored ${score}/${REMIX_PRACTICES_MAX_SCORE} from ${improvements.length} review finding${improvements.length === 1 ? '' : 's'}.`,
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
