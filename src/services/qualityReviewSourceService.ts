import type { CodebaseAnalysis, QualityFinding } from '../types/codebase';
import { BrowserDirectoryHandle, BrowserFileHandle, isDirectoryHandle, loadDirectoryHandle } from './browserDirectoryAccess';
import { IGNORED_DIRECTORIES } from './codebaseAnalysisConstants';

export interface QualityReviewSourceFile {
  path: string;
  content: string;
  truncated: boolean;
}

const QUALITY_REVIEW_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
  '.json',
  '.prisma',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.php',
  '.rb',
  '.cs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.sql',
]);
const QUALITY_REVIEW_MAX_FILES = 6;
const QUALITY_REVIEW_MAX_FILE_CHARS = 6000;
const QUALITY_REVIEW_MAX_TOTAL_CHARS = 24000;

function isQualityReviewSourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  return QUALITY_REVIEW_SOURCE_EXTENSIONS.has(`.${lower.split('.').pop() || ''}`)
    && !lower.split('/').some(segment => IGNORED_DIRECTORIES.has(segment) || segment.startsWith('.env'));
}

/** Paths tied to a static quality finding (location + line evidence). */
export function pathsFromQualityFinding(finding: QualityFinding): string[] {
  const out: string[] = [];
  const add = (path?: string) => {
    if (path && !out.includes(path)) out.push(path);
  };
  add(finding.location?.path);
  for (const evidence of finding.evidence) {
    add(evidence.match(/^(.*?):\d+(?:[–-]\d+)?$/)?.[1]);
  }
  for (const evidence of finding.evidence) {
    if (evidence.includes(' lines')) add(evidence.split(' · ')[0]);
  }
  return out;
}

const staticCodeFindingsFilter = (finding: QualityFinding) =>
  !finding.ruleId?.startsWith('cve-') && !finding.title.toLowerCase().startsWith('vulnerable package');

function collectFindingLinkedReviewPaths(analysis: CodebaseAnalysis, limit?: number): string[] {
  const structure = new Set(analysis.structurePaths || []);
  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  const findings = (analysis.quality?.findings || [])
    .filter(staticCodeFindingsFilter)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    for (const path of pathsFromQualityFinding(finding)) {
      if (seen.has(path) || !structure.has(path) || !isQualityReviewSourcePath(path)) continue;
      seen.add(path);
      ordered.push(path);
      if (limit !== undefined && ordered.length >= limit) return ordered;
    }
  }
  return ordered;
}

/** Every unique reviewable path referenced by static findings (priority order). */
export function getAllFindingLinkedReviewPaths(analysis: CodebaseAnalysis): string[] {
  return collectFindingLinkedReviewPaths(analysis);
}

/** Up to `limit` reviewable paths from static findings, highest priority first (AI review cap). */
export function getSuggestedPathsFromQualityFindings(analysis: CodebaseAnalysis, limit = QUALITY_REVIEW_MAX_FILES): string[] {
  return collectFindingLinkedReviewPaths(analysis, limit);
}

export function getQualityReviewMaxFiles(): number {
  return QUALITY_REVIEW_MAX_FILES;
}

export function getQualityReviewCandidatePaths(analysis: CodebaseAnalysis): string[] {
  const paths = (analysis.structurePaths || []).filter(isQualityReviewSourcePath);
  const available = new Set(paths);
  const prioritized: string[] = [];
  const add = (path?: string) => { if (path && available.has(path) && !prioritized.includes(path)) prioritized.push(path); };
  for (const entry of analysis.entryPoints) add(entry);
  for (const finding of analysis.quality?.findings || []) {
    for (const path of pathsFromQualityFinding(finding)) add(path);
  }
  for (const path of paths) add(path);
  return prioritized;
}

function capQualityReviewFiles(files: QualityReviewSourceFile[]): QualityReviewSourceFile[] {
  let remaining = QUALITY_REVIEW_MAX_TOTAL_CHARS;
  const result: QualityReviewSourceFile[] = [];
  for (const file of files.slice(0, QUALITY_REVIEW_MAX_FILES)) {
    if (remaining <= 0) break;
    const take = Math.min(QUALITY_REVIEW_MAX_FILE_CHARS, remaining);
    const content = file.content.slice(0, take);
    result.push({ path: file.path, content, truncated: file.truncated || content.length < file.content.length });
    remaining -= content.length;
  }
  return result;
}

async function findBrowserFile(root: BrowserDirectoryHandle, relativePath: string): Promise<BrowserFileHandle | null> {
  let directory = root;
  const segments = relativePath.split('/').filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    let found: BrowserFileHandle | BrowserDirectoryHandle | undefined;
    for await (const [name, entry] of directory.entries()) {
      if (name === segments[index]) { found = entry; break; }
    }
    if (!found) return null;
    if (index === segments.length - 1) return isDirectoryHandle(found) ? null : found;
    if (!isDirectoryHandle(found)) return null;
    directory = found;
  }
  return null;
}

export async function readQualityReviewSources(analysis: CodebaseAnalysis, selectedPaths: string[]): Promise<QualityReviewSourceFile[]> {
  const scannedPaths = new Set(analysis.structurePaths || []);
  const safePaths = [...new Set(selectedPaths)].filter(path => scannedPaths.has(path) && !path.startsWith('/') && !path.split('/').includes('..')
    && QUALITY_REVIEW_SOURCE_EXTENSIONS.has(`.${path.toLowerCase().split('.').pop() || ''}`)
    && !path.toLowerCase().split('/').some(segment => IGNORED_DIRECTORIES.has(segment) || segment.startsWith('.env'))).slice(0, QUALITY_REVIEW_MAX_FILES);
  if (!safePaths.length) throw new Error('Select at least one supported source file for AI review.');

  if (window.__TAURI_INTERNALS__) {
    const { invoke } = await import('@tauri-apps/api/core');
    const files = await invoke<QualityReviewSourceFile[]>('read_codebase_files', { rootPath: analysis.rootPath, relativePaths: safePaths });
    return capQualityReviewFiles(files);
  }

  if (!analysis.directoryHandleId) throw new Error('This saved scan has no reusable folder permission. Re-analyze the codebase to enable local file selection.');
  const root = await loadDirectoryHandle(analysis.directoryHandleId);
  if (!root) throw new Error('blueprint studio can no longer access this folder. Re-analyze the codebase to restore local folder access.');
  let permission = await root.queryPermission?.({ mode: 'read' });
  if (!permission || permission === 'prompt') permission = await root.requestPermission?.({ mode: 'read' });
  if (permission !== 'granted' && (root.queryPermission || root.requestPermission)) throw new Error('Folder access was not granted. blueprint studio has not sent any code.');

  const files: QualityReviewSourceFile[] = [];
  for (const path of safePaths) {
    const fileHandle = await findBrowserFile(root, path);
    if (!fileHandle) continue;
    const file = await fileHandle.getFile();
    if (file.size > 256 * 1024) {
      files.push({ path, content: (await file.slice(0, QUALITY_REVIEW_MAX_FILE_CHARS * 4).text()), truncated: true });
    } else files.push({ path, content: await file.text(), truncated: false });
  }
  return capQualityReviewFiles(files);
}

