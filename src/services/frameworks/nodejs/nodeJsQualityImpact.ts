import type { QualityCheck, QualityDimension, QualityFinding } from '../../../types/codebase';
import type {
  FrameworkProfile,
  NodeJsArchitecturalImprovement,
  NodeJsImprovementCategory,
  NodeJsSpecialization,
} from '../../../types/framework';

const SECURITY_CATEGORIES = new Set<NodeJsImprovementCategory>(['route-hygiene', 'middleware', 'security']);

export const NODEJS_PRACTICES_MAX_SCORE = 15;
const MAX_QUALITY_FINDINGS = 8;

function priorityForSeverity(
  severity: NodeJsArchitecturalImprovement['severity'],
): QualityFinding['priority'] {
  if (severity === 'critical') return 'high';
  if (severity === 'warning') return 'medium';
  return 'low';
}

function categoryForImprovement(
  category: NodeJsImprovementCategory,
): NonNullable<QualityFinding['category']> {
  if (SECURITY_CATEGORIES.has(category)) return 'security';
  if (category === 'config-delivery') return 'delivery';
  if (category === 'error-handling') return 'correctness';
  if (category === 'async-hygiene') return 'maintainability';
  if (category === 'data-modeling') return 'structure';
  if (category === 'modernization') return 'correctness';
  return 'maintainability';
}

function pointsForSeverity(severity: NodeJsArchitecturalImprovement['severity']): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

export function isNodeJsSpecialization(
  profile: FrameworkProfile | undefined,
): profile is FrameworkProfile<NodeJsSpecialization> {
  return profile?.id === 'nodejs' && Boolean(profile.specialization);
}

export function computeNodeJsQualityImpact(
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
  if (!isNodeJsSpecialization(profile)) return undefined;
  const specialization = profile.specialization as NodeJsSpecialization;
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

  const cappedPenalty = Math.min(NODEJS_PRACTICES_MAX_SCORE, penalty);
  const score = Math.max(0, NODEJS_PRACTICES_MAX_SCORE - cappedPenalty);

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
      label: `${ranked.length - 8} more Node.js finding${ranked.length - 8 === 1 ? '' : 's'}`,
      points: 0,
      detail: 'See the Node.js review panel for the full list.',
    });
  }

  const dimension: QualityDimension = {
    name: 'Node.js practices',
    score,
    maxScore: NODEJS_PRACTICES_MAX_SCORE,
    assessmentStatus: 'reviewed',
    summary:
      improvements.length === 0
        ? 'Routes, middleware, data models, resilience, config, and security checks found no issues.'
        : `${improvements.length} finding${improvements.length === 1 ? '' : 's'} in the Node.js review (${criticalCount} critical, ${warningCount} warning, ${optimizationCount} optimization).`,
    scoreEvidence: scoreEvidence.length > 0 ? scoreEvidence : undefined,
  };

  const criticalImprovements = improvements.filter(item => item.severity === 'critical');
  const findings: QualityFinding[] = criticalImprovements.slice(0, MAX_QUALITY_FINDINGS).map(item => ({
    title: item.title,
    detail: `${item.impact} ${item.remediation}`,
    priority: priorityForSeverity(item.severity),
    category: categoryForImprovement(item.category),
    evidence: [item.file || 'Node.js framework review', `category:${item.category}`, `severity:${item.severity}`],
    ruleId: `nodejs-${item.id}`.slice(0, 64),
    source: 'blueprint-nodejs',
    confidence: 'medium',
    location: item.file ? { path: item.file, line: item.line } : undefined,
  }));

  const omittedCritical = Math.max(0, criticalImprovements.length - MAX_QUALITY_FINDINGS);
  const nonCritical = warningCount + optimizationCount;
  if (omittedCritical > 0 || nonCritical > 0) {
    findings.push({
      title: 'More findings in Node.js review',
      detail: [
        omittedCritical > 0 ? `${omittedCritical} additional critical item(s) omitted here.` : null,
        nonCritical > 0
          ? `${warningCount} warning and ${optimizationCount} optimization finding(s) live in the Node.js review panel.`
          : null,
        'They already affect the Node.js practices score.',
      ]
        .filter(Boolean)
        .join(' '),
      priority: omittedCritical > 0 || warningCount > 0 ? 'medium' : 'low',
      category: 'maintainability',
      evidence: ['See Overview → Node.js review'],
      ruleId: 'nodejs-see-panel',
      source: 'blueprint-nodejs',
      confidence: 'medium',
    });
  }

  const check: QualityCheck = {
    id: 'nodejs-framework-review',
    name: 'Node.js architecture review',
    category: criticalCount > 0 || warningCount > 0 ? 'security' : 'maintainability',
    status:
      improvements.length === 0 ? 'passed' : criticalCount > 0 || warningCount > 0 ? 'issues' : 'incomplete',
    summary:
      improvements.length === 0
        ? 'Node.js practices dimension is clean (15/15).'
        : `Node.js practices scored ${score}/${NODEJS_PRACTICES_MAX_SCORE} from ${improvements.length} review finding${improvements.length === 1 ? '' : 's'}.`,
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
