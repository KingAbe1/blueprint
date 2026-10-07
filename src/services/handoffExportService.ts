import { HandoffFile } from '../types/project';

interface BrowserDirectoryHandle {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<BrowserDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle>;
}

interface BrowserFileHandle {
  createWritable(): Promise<{
    write(content: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<BrowserDirectoryHandle>;
  }
}

export type HandoffTarget =
  | { kind: 'tauri'; path: string; name: string }
  | { kind: 'browser'; handle: BrowserDirectoryHandle; name: string };

export interface HandoffExportResult {
  written: string[];
  overwritten: string[];
}

async function browserFileExists(root: BrowserDirectoryHandle, relativePath: string) {
  const parts = relativePath.split('/').filter(Boolean);
  let directory = root;
  try {
    for (const part of parts.slice(0, -1)) {
      directory = await directory.getDirectoryHandle(part);
    }
    await directory.getFileHandle(parts.at(-1) || relativePath);
    return true;
  } catch (error: any) {
    if (error?.name === 'NotFoundError') return false;
    throw error;
  }
}

export async function chooseHandoffTarget(): Promise<HandoffTarget | null> {
  if (window.__TAURI_INTERNALS__) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Choose the project folder for this handoff',
    });
    if (!selected || Array.isArray(selected)) return null;
    const normalized = selected.replace(/[\\/]+$/, '');
    return {
      kind: 'tauri',
      path: selected,
      name: normalized.split(/[\\/]/).pop() || selected,
    };
  }

  if (window.showDirectoryPicker) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      return { kind: 'browser', handle, name: handle.name };
    } catch (error: any) {
      if (error?.name === 'AbortError') return null;
      throw error;
    }
  }

  throw new Error('Folder export is not supported in this browser. Use the Blueprint desktop app to select a project folder.');
}

export async function inspectHandoffConflicts(target: HandoffTarget, files: HandoffFile[]): Promise<string[]> {
  if (target.kind === 'tauri') {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('inspect_handoff_conflicts', {
      targetDir: target.path,
      paths: files.map(file => file.path),
    });
  }

  const checks = await Promise.all(files.map(async file => ({
    path: file.path,
    exists: await browserFileExists(target.handle, file.path),
  })));
  return checks.filter(check => check.exists).map(check => check.path);
}

export async function exportHandoffFiles(
  target: HandoffTarget,
  files: HandoffFile[],
  overwrite: boolean,
): Promise<HandoffExportResult> {
  if (target.kind === 'tauri') {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<HandoffExportResult>('export_handoff_files', {
      targetDir: target.path,
      files: files.map(file => ({ path: file.path, content: file.content })),
      overwrite,
    });
  }

  const conflicts = await inspectHandoffConflicts(target, files);
  if (conflicts.length > 0 && !overwrite) {
    throw new Error(`${conflicts.length} handoff file${conflicts.length === 1 ? '' : 's'} already exist. Review them before exporting.`);
  }

  const written: string[] = [];
  const overwritten: string[] = [];
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let directory = target.handle;
    for (const part of parts.slice(0, -1)) {
      directory = await directory.getDirectoryHandle(part, { create: true });
    }
    const existed = conflicts.includes(file.path);
    const handle = await directory.getFileHandle(parts.at(-1) || file.path, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.content);
    await writable.close();
    if (existed) overwritten.push(file.path);
    written.push(file.path);
  }
  return { written, overwritten };
}

export async function openHandoffFolder(target: HandoffTarget): Promise<boolean> {
  if (target.kind !== 'tauri') return false;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_handoff_folder', { targetDir: target.path });
  return true;
}
