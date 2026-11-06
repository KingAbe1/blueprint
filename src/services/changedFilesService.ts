import type { FixPromptItem } from './fixPromptService';
import { isDesktopApp } from '../utils/platform';

export type ChangeScope = 'all' | 'uncommitted' | 'branch';

export interface ChangedFiles {
  scope: Exclude<ChangeScope, 'all'>;
  /** Ref the branch is compared against, e.g. "origin/main". */
  base?: string;
  branch?: string;
  /** Paths relative to the scanned folder. */
  files: string[];
}

const DEPENDENCY_FILES = /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock)$/i;

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

/** Changed-file scopes need git, which only the desktop app can run. */
export function canListChangedFiles(rootPath: string | undefined, gitTracked: boolean | undefined): boolean {
  return Boolean(isDesktopApp() && rootPath && isAbsolutePath(rootPath) && gitTracked);
}

export async function listChangedFiles(rootPath: string, scope: Exclude<ChangeScope, 'all'>): Promise<ChangedFiles> {
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<{ scope: ChangedFiles['scope']; base?: string | null; branch?: string | null; files: string[] }>(
    'git_changed_files',
    { rootPath, scope },
  );
  return {
    scope: result.scope,
    base: result.base ?? undefined,
    branch: result.branch ?? undefined,
    files: result.files,
  };
}

/**
 * Keep the fix items that touch a changed file. Dependency advisories have no source file,
 * so they count as "in scope" when a manifest or lockfile changed (a dependency was added or bumped).
 */
export function filterItemsToChangedFiles(items: FixPromptItem[], changed: ChangedFiles): FixPromptItem[] {
  const files = new Set(changed.files);
  const dependenciesChanged = changed.files.some(path => DEPENDENCY_FILES.test(path));
  return items.filter(item => {
    if (item.id.startsWith('cve:')) return dependenciesChanged;
    return Boolean(item.file && files.has(item.file));
  });
}

export function describeScope(changed: ChangedFiles): string {
  if (changed.scope === 'uncommitted') return 'uncommitted changes';
  return changed.base ? `changes since ${changed.base}` : 'changes on this branch';
}
