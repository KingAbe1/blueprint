import type { CodebaseAnalysis, DependencyAdvisory, QualityFinding } from '../types/codebase';
import type { FrameworkId } from '../types/framework';

/** Normalized shape for anything blueprint can ask a coding agent to fix. */
export interface FixPromptItem {
  id: string;
  title: string;
  /** 'high' | 'medium' | 'low' after normalization. */
  priority: 'high' | 'medium' | 'low';
  category: string;
  impact: string;
  remediation?: string;
  file?: string;
  line?: number;
  /** Framework label (e.g. "Next.js") when the finding came from a deep framework audit. */
  frameworkLabel?: string;
  frameworkId?: FrameworkId;
  evidence?: string[];
}

interface FrameworkImprovementLike {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'optimization';
  title: string;
  impact: string;
  remediation: string;
  file?: string;
  line?: number;
}

const FRAMEWORK_GUIDANCE: Record<FrameworkId, string> = {
  nextjs: 'Follow the Next.js router this project already uses (App Router vs Pages Router) and keep server/client boundaries intact.',
  remix: 'Follow Remix conventions for loaders, actions, and error boundaries; keep data loading on the server.',
  expo: 'Follow Expo SDK and React Native conventions for navigation, SecureStore, and app config.',
  nodejs: 'Follow the existing server framework and middleware patterns in this project.',
};

const FRAMEWORK_SOURCES = new Set<QualityFinding['source']>([
  'blueprint-nextjs',
  'blueprint-remix',
  'blueprint-expo',
  'blueprint-nodejs',
]);

const PRIORITY_ORDER: Record<FixPromptItem['priority'], number> = { high: 0, medium: 1, low: 2 };

export function priorityForFrameworkSeverity(
  severity: FrameworkImprovementLike['severity'],
): FixPromptItem['priority'] {
  if (severity === 'critical') return 'high';
  if (severity === 'warning') return 'medium';
  return 'low';
}

export function frameworkImprovementToFixItem(
  item: FrameworkImprovementLike,
  framework: { id: FrameworkId; label: string },
  categoryLabel?: string,
): FixPromptItem {
  return {
    id: `${framework.id}:${item.id}`,
    title: item.title,
    priority: priorityForFrameworkSeverity(item.severity),
    category: categoryLabel || item.category.replace(/-/g, ' '),
    impact: item.impact,
    remediation: item.remediation,
    file: item.file,
    line: item.line,
    frameworkLabel: framework.label,
    frameworkId: framework.id,
  };
}

export function qualityFindingToFixItem(finding: QualityFinding, index: number): FixPromptItem {
  return {
    id: finding.id || finding.ruleId || `finding-${index}`,
    title: finding.title,
    priority: finding.priority,
    category: finding.category || 'quality',
    impact: finding.detail,
    file: finding.location?.path,
    line: finding.location?.line,
    evidence: finding.evidence,
  };
}

function severityToPriority(severity: DependencyAdvisory['severity']): FixPromptItem['priority'] {
  if (severity === 'critical' || severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

export function advisoryToFixItem(advisory: DependencyAdvisory): FixPromptItem {
  const fixed = advisory.fixedVersions.length > 0
    ? `Upgrade \`${advisory.packageName}\` to ${advisory.fixedVersions.map(v => `\`${v}\``).join(' or ')} or later.`
    : `No fixed version is published yet. Check whether \`${advisory.packageName}\` can be replaced or the vulnerable code path avoided.`;
  return {
    id: `cve:${advisory.id}:${advisory.packageName}@${advisory.version}`,
    title: `${advisory.packageName}@${advisory.version}: ${advisory.id}`,
    priority: severityToPriority(advisory.severity),
    category: `dependency (${advisory.severity})`,
    file: 'package.json',
    impact: advisory.summary,
    remediation: `${fixed} If it is a transitive dependency, update the direct dependency that pulls it in or use an override/resolution. Regenerate the lockfile.`,
    evidence: advisory.references.slice(0, 3),
  };
}

function frameworkImprovements(analysis: CodebaseAnalysis): FixPromptItem[] {
  const profile = analysis.frameworkProfile;
  const improvements = (profile?.specialization as { improvements?: FrameworkImprovementLike[] } | undefined)
    ?.improvements;
  if (!profile || !Array.isArray(improvements)) return [];
  return improvements.map(item => frameworkImprovementToFixItem(item, { id: profile.id, label: profile.name }));
}

/** Every actionable item from a scan: framework audits, static findings, and dependency advisories, deduplicated. */
export function collectFixItems(analysis: CodebaseAnalysis): FixPromptItem[] {
  const framework = frameworkImprovements(analysis);
  const staticFindings = (analysis.quality?.findings || [])
    // Framework findings are capped copies of the full improvement list above.
    .filter(f => !(framework.length > 0 && FRAMEWORK_SOURCES.has(f.source)))
    // CVE findings are covered with richer data from dependencyRisk.
    .filter(f => !f.ruleId?.startsWith('cve-') && !f.title.toLowerCase().startsWith('vulnerable package'))
    .map(qualityFindingToFixItem);
  const advisories = (analysis.dependencyRisk?.advisories || []).map(advisoryToFixItem);

  const seen = new Set<string>();
  return [...framework, ...staticFindings, ...advisories]
    .filter(item => {
      const key = `${item.title}|${item.file || ''}|${item.line || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/** Script commands the agent should run to verify its change (typecheck, lint, test). */
export function verificationCommands(analysis?: CodebaseAnalysis): string[] {
  const scripts = analysis?.scripts || [];
  const wanted = ['typecheck', 'type-check', 'lint', 'test'];
  const picked = wanted
    .map(name => scripts.find(s => s.name === name))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map(s => s.runCommand || s.name);
  if (picked.length === 0) {
    const build = scripts.find(s => s.name === 'build');
    if (build) picked.push(build.runCommand || build.name);
  }
  return picked;
}

function locationLabel(item: FixPromptItem): string | undefined {
  if (!item.file) return undefined;
  return item.line ? `${item.file}:${item.line}` : item.file;
}

/** One self-contained prompt to paste into Cursor, Claude Code, Codex, etc. */
export function buildFixPrompt(item: FixPromptItem, analysis?: CodebaseAnalysis): string {
  const location = locationLabel(item);
  const checks = verificationCommands(analysis);
  const frameworkLine = item.frameworkId ? FRAMEWORK_GUIDANCE[item.frameworkId] : undefined;

  const lines = [
    `Fix this issue found by a blueprint studio scan${analysis?.rootName ? ` of \`${analysis.rootName}\`` : ''}.`,
    '',
    `## Issue`,
    `**${item.title}**`,
    `- Priority: ${item.priority}`,
    `- Category: ${item.category}${item.frameworkLabel ? ` (${item.frameworkLabel})` : ''}`,
    location ? `- Location: \`${location}\`` : '- Location: project-wide (find the relevant files first)',
    '',
    `## Why it matters`,
    item.impact,
  ];

  if (item.remediation) {
    lines.push('', '## Suggested fix', item.remediation);
  }
  if (item.evidence && item.evidence.length > 0) {
    lines.push('', '## Evidence', ...item.evidence.slice(0, 5).map(e => `- ${e}`));
  }

  lines.push(
    '',
    '## How to work',
    location
      ? `1. Open \`${location}\` and confirm the issue is real. If it is a false positive, stop and explain why instead of changing code.`
      : '1. Find where this applies in the codebase and confirm the issue is real. If it is a false positive, stop and explain why.',
    '2. Make the smallest change that fixes it. Keep existing behavior and public APIs unless the fix requires otherwise.',
    frameworkLine ? `3. ${frameworkLine}` : '3. Match the conventions already used in this codebase.',
    checks.length > 0
      ? `4. Verify with: ${checks.map(c => `\`${c}\``).join(', ')}.`
      : '4. Verify the change builds and, if there are tests, that they pass.',
    '5. Summarize what you changed and why.',
  );

  return lines.join('\n');
}

/** A checklist file the agent can work through: `blueprint/FIXES.md`. */
export function buildFixesMarkdown(analysis: CodebaseAnalysis, items = collectFixItems(analysis)): string {
  const checks = verificationCommands(analysis);
  const counts = {
    high: items.filter(i => i.priority === 'high').length,
    medium: items.filter(i => i.priority === 'medium').length,
    low: items.filter(i => i.priority === 'low').length,
  };

  const header = [
    `# Fixes for ${analysis.rootName}`,
    '',
    `Generated by blueprint studio on ${new Date().toLocaleString()} from a scan with health score ${analysis.quality?.score ?? 'n/a'}/100.`,
    `${items.length} item${items.length === 1 ? '' : 's'}: ${counts.high} high, ${counts.medium} medium, ${counts.low} low.`,
    '',
    '## Instructions for the coding agent',
    '',
    '- Work through the unchecked items from top to bottom (highest priority first).',
    '- Before changing code, confirm each issue is real. If it is a false positive, check it off anyway and append `(false positive: <reason>)` to the line.',
    '- Make the smallest change that fixes each item and keep existing behavior.',
    checks.length > 0
      ? `- After each item, verify with: ${checks.map(c => `\`${c}\``).join(', ')}.`
      : '- After each item, make sure the project still builds and tests pass.',
    '- Check off each item (`- [x]`) when it is done, then move to the next one.',
    '- Do one item per commit if you are committing.',
  ];

  const sections: string[] = [];
  for (const priority of ['high', 'medium', 'low'] as const) {
    const group = items.filter(i => i.priority === priority);
    if (group.length === 0) continue;
    sections.push('', `## ${priority[0].toUpperCase()}${priority.slice(1)} priority (${group.length})`, '');
    group.forEach(item => {
      const location = locationLabel(item);
      sections.push(`- [ ] **${item.title}**${location ? ` — \`${location}\`` : ''}`);
      sections.push(`  - Category: ${item.category}${item.frameworkLabel ? ` (${item.frameworkLabel})` : ''}`);
      sections.push(`  - Why: ${item.impact.replace(/\s*\n\s*/g, ' ')}`);
      if (item.remediation) sections.push(`  - Fix: ${item.remediation.replace(/\s*\n\s*/g, ' ')}`);
    });
  }

  if (items.length === 0) {
    sections.push('', 'No actionable findings in this scan.');
  }

  if ((analysis.quality?.findingsOmitted || 0) > 0) {
    sections.push('', `_${analysis.quality!.findingsOmitted} lower-signal findings were omitted from the scan results._`);
  }

  return [...header, ...sections, ''].join('\n');
}

export const FIXES_FILE_PATH = 'blueprint/FIXES.md';
