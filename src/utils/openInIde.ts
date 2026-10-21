import { resolveIdeOption } from '../constants/supportedIdes';
import { isDesktopApp } from './platform';
import { openExternalUrl } from './openExternalUrl';

export type OpenInIdeResult = { ok: true; ideName: string } | { ok: false; message: string };

/** Coerce finding line values (number or numeric string) to a 1-based line. */
export function coerceFindingLine(line: unknown): number | undefined {
  if (line == null || line === '') return undefined;
  const n = typeof line === 'number' ? line : Number(String(line).trim());
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

/**
 * Prefer the snippet focus line (exact match) over location.line (often a range start).
 * Falls back to parsing `path:123` from evidence strings.
 */
export function resolveFindingOpenLine(input: {
  line?: unknown;
  focusLine?: unknown;
  evidence?: string[];
  filePath?: string;
}): number | undefined {
  const fromFocus = coerceFindingLine(input.focusLine);
  if (fromFocus) return fromFocus;
  const fromLine = coerceFindingLine(input.line);
  if (fromLine) return fromLine;

  const file = input.filePath?.replace(/\\/g, '/');
  for (const evidence of input.evidence || []) {
    const match = evidence.match(/^(.*?):(\d+)(?:[–-]\d+)?$/);
    if (!match) continue;
    if (file && match[1].replace(/\\/g, '/') !== file && !match[1].endsWith(file)) continue;
    const parsed = coerceFindingLine(match[2]);
    if (parsed) return parsed;
  }
  return undefined;
}

/** Join a project-relative path onto the scanned root (handles / and \\ roots). */
export function resolveAbsoluteProjectPath(rootPath: string, relativeOrAbsolute: string): string | null {
  const root = rootPath.trim();
  const raw = relativeOrAbsolute.trim();
  if (!root || !raw) return null;

  // Already absolute (POSIX or Windows drive)
  if (raw.startsWith('/') || raw.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(raw)) {
    return raw;
  }

  const normalizedRoot = root.replace(/[/\\]+$/, '');
  const rel = raw.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  const useBackslash = normalizedRoot.includes('\\') && !normalizedRoot.includes('/');
  const sep = useBackslash ? '\\' : '/';
  return `${normalizedRoot}${sep}${rel.split('/').join(sep)}`;
}

function launchProtocolUrl(protocolUrl: string): void {
  try {
    const a = document.createElement('a');
    a.href = protocolUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.location.assign(protocolUrl);
  }
}

/**
 * Open a project path in the user's preferred IDE (System Settings).
 * Pass only `rootPath` to open the project folder; pass `relativePath` (+ optional line) for a file.
 *
 * Desktop (Tauri): launches the IDE CLI in a new window with the project (+ file:line),
 * then activates the app so it comes to the front (avoids buried custom-URL dialogs).
 * Browser: best-effort protocol navigation.
 */
export async function openInPreferredIde(options: {
  rootPath: string;
  relativePath?: string;
  line?: number | string;
  ideId: string;
}): Promise<OpenInIdeResult> {
  const ide = resolveIdeOption(options.ideId);
  const rootPath = options.rootPath.trim();
  if (!rootPath) {
    return { ok: false, message: 'No project path is available.' };
  }

  const absoluteFile = options.relativePath
    ? resolveAbsoluteProjectPath(rootPath, options.relativePath)
    : null;

  if (options.relativePath && !absoluteFile) {
    return { ok: false, message: 'No file path is available for this finding.' };
  }

  const line = absoluteFile ? coerceFindingLine(options.line) : undefined;

  try {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_in_ide', {
        ideId: ide.id,
        projectRoot: rootPath,
        filePath: absoluteFile,
        line: line ?? null,
      });
      return { ok: true, ideName: ide.shortName };
    }

    // Web / fallback: protocol URL (may show an OS confirmation dialog)
    const protocolTarget = absoluteFile || rootPath;
    launchProtocolUrl(ide.getProtocolUrl(protocolTarget, line));
    return { ok: true, ideName: ide.shortName };
  } catch (error) {
    const detail =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message: unknown }).message)
            : '';

    // Last resort on desktop: protocol URL if CLI invoke failed oddly
    if (isDesktopApp()) {
      try {
        const protocolTarget = absoluteFile || rootPath;
        await openExternalUrl(ide.getProtocolUrl(protocolTarget, line));
        return { ok: true, ideName: ide.shortName };
      } catch {
        // fall through
      }
    }

    return {
      ok: false,
      message:
        detail ||
        `Could not open ${ide.shortName}. Install the IDE shell command (e.g. “Install 'cursor' command”), then try again.`,
    };
  }
}
