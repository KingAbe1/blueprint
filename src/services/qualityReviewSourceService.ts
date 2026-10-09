import type { CodebaseAnalysis } from '../types/codebase';
import { BrowserDirectoryHandle, BrowserFileHandle, isDirectoryHandle, loadDirectoryHandle } from './browserDirectoryAccess';
import { IGNORED_DIRECTORIES } from './codebaseAnalysisConstants';

export interface QualityReviewSourceFile {
  path: string;
  content: string;
  truncated: boolean;
}

const QUALITY_REVIEW_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.py', '.rs', '.go', '.java', '.kt', '.swift', '.php', '.rb', '.cs', '.c', '.cpp', '.h', '.hpp', '.sql']);
const QUALITY_REVIEW_MAX_FILES = 6;
const QUALITY_REVIEW_MAX_FILE_CHARS = 6000;
const QUALITY_REVIEW_MAX_TOTAL_CHARS = 24000;

export function getQualityReviewCandidatePaths(analysis: CodebaseAnalysis): string[] {
  const paths = (analysis.structurePaths || []).filter(path => {
    const lower = path.toLowerCase();
    return QUALITY_REVIEW_SOURCE_EXTENSIONS.has(`.${lower.split('.').pop() || ''}`)
      && !lower.split('/').some(segment => IGNORED_DIRECTORIES.has(segment) || segment.startsWith('.env'));
  });
  const available = new Set(paths);
  const prioritized: string[] = [];
  const add = (path?: string) => { if (path && available.has(path) && !prioritized.includes(path)) prioritized.push(path); };
  for (const entry of analysis.entryPoints) add(entry);
  for (const finding of analysis.quality?.findings || []) {
    add(finding.location?.path);
    for (const evidence of finding.evidence) add(evidence.match(/^(.*?):\d+(?:[–-]\d+)?$/)?.[1]);
  }
  for (const file of analysis.quality?.findings.flatMap(finding => finding.evidence).filter(item => item.includes(' lines')) || []) {
    add(file.split(' · ')[0]);
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
  if (!root) throw new Error('Blueprint can no longer access this folder. Re-analyze the codebase to restore local folder access.');
  let permission = await root.queryPermission?.({ mode: 'read' });
  if (!permission || permission === 'prompt') permission = await root.requestPermission?.({ mode: 'read' });
  if (permission !== 'granted' && (root.queryPermission || root.requestPermission)) throw new Error('Folder access was not granted. Blueprint has not sent any code.');

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

