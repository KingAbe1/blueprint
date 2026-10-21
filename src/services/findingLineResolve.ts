import { isDesktopApp } from '../utils/platform';
import { coerceFindingLine, resolveFindingOpenLine } from '../utils/openInIde';

function lineAtIndex(content: string, index: number): number {
  return content.slice(0, Math.max(0, index)).split(/\r\n|\n|\r/).length;
}

/** First 1-based line where `pattern` matches in `content`. */
export function firstMatchLine(content: string, pattern: RegExp): number | undefined {
  if (!content) return undefined;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  re.lastIndex = 0;
  const match = re.exec(content);
  if (!match || match.index < 0) return undefined;
  return lineAtIndex(content, match.index);
}

function collectNeedles(title?: string, impact?: string, category?: string): string[] {
  const text = `${title || ''}\n${impact || ''}`;
  const needles: string[] = [];
  const add = (value?: string) => {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length >= 3 && !needles.includes(trimmed)) needles.push(trimmed);
  };

  for (const match of text.matchAll(/`([^`{][^`]{0,120})`/g)) add(match[1]);
  for (const match of text.matchAll(/\bprocess\.env\.[A-Z0-9_]+\b/g)) add(match[0]);
  for (const match of text.matchAll(/['"](use (?:client|server))['"]/gi)) add(`'${match[1]}'`);
  for (const match of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) add(match[1]);
  for (const match of text.matchAll(/\b(export\s+(?:async\s+)?function\s+[A-Za-z0-9_]+)/g)) add(match[1]);

  const categoryKey = (category || '').toLowerCase();
  if (categoryKey.includes('api') || categoryKey.includes('action')) {
    add('request.json');
    add('req.body');
    add('export async function POST');
    add('export async function PUT');
    add('export async function DELETE');
  }
  if (categoryKey.includes('security') || /secret|credential|token/i.test(text)) {
    add('process.env');
    add('NEXT_PUBLIC_');
  }
  if (/client component|use client/i.test(text)) add("'use client'");
  if (/server-only|node\/fs|from 'fs'/i.test(text)) add("from 'fs'");

  return needles;
}

/** Best-effort line guess from finding copy when audits omitted `line`. */
export function guessLineFromFindingText(
  content: string,
  options: { title?: string; impact?: string; category?: string },
): number | undefined {
  if (!content) return undefined;

  for (const needle of collectNeedles(options.title, options.impact, options.category)) {
    const index = content.indexOf(needle);
    if (index >= 0) return lineAtIndex(content, index);
    // Case-insensitive fallback for short needles
    if (needle.length >= 6) {
      const lower = content.toLowerCase();
      const at = lower.indexOf(needle.toLowerCase());
      if (at >= 0) return lineAtIndex(content, at);
    }
  }

  return undefined;
}

async function readProjectFileContent(
  rootPath: string,
  relativePath: string,
  sourceContents?: Record<string, string>,
): Promise<string | undefined> {
  const direct = sourceContents?.[relativePath] || sourceContents?.[relativePath.replace(/\\/g, '/')];
  if (direct) return direct;

  if (!isDesktopApp()) return undefined;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const files = await invoke<Array<{ path: string; content: string }>>('read_codebase_files', {
      rootPath,
      relativePaths: [relativePath],
    });
    return files[0]?.content;
  } catch {
    return undefined;
  }
}

/**
 * Fill missing `line` on framework improvements after audits, using file contents.
 * Applies to Next.js / Remix / Node.js / Expo so Open in IDE can jump accurately after rescan.
 */
export function attachMissingImprovementLines<
  T extends { file?: string; line?: number; title: string; impact: string; category?: string },
>(improvements: T[], sourceContents: Record<string, string>): T[] {
  if (!improvements.length || !sourceContents) return improvements;
  return improvements.map(item => {
    if (!item.file || (item.line != null && item.line >= 1)) return item;
    const content =
      sourceContents[item.file] ||
      sourceContents[item.file.replace(/\\/g, '/')] ||
      Object.entries(sourceContents).find(([path]) => path.endsWith(item.file!))?.[1];
    if (!content) return item;
    const line = guessLineFromFindingText(content, {
      title: item.title,
      impact: item.impact,
      category: item.category,
    });
    return line ? { ...item, line } : item;
  });
}

/** Resolve the best 1-based line to open for a finding (explicit → evidence → file guess). */
export async function resolveLineForIdeOpen(options: {
  rootPath: string;
  relativePath: string;
  line?: unknown;
  focusLine?: unknown;
  evidence?: string[];
  title?: string;
  impact?: string;
  category?: string;
  sourceContents?: Record<string, string>;
}): Promise<number | undefined> {
  const known = resolveFindingOpenLine({
    focusLine: options.focusLine,
    line: options.line,
    evidence: options.evidence,
    filePath: options.relativePath,
  });
  if (known) return known;

  const content = await readProjectFileContent(
    options.rootPath,
    options.relativePath,
    options.sourceContents,
  );
  if (!content) return undefined;

  return (
    guessLineFromFindingText(content, {
      title: options.title,
      impact: options.impact,
      category: options.category,
    }) || coerceFindingLine(options.line)
  );
}
