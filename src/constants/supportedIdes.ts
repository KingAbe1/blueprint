export interface IdeOption {
  id: string;
  name: string;
  shortName: string;
  /** Absolute file or folder path. Optional 1-based line when opening a file. */
  getProtocolUrl: (path: string, line?: number) => string;
  getCliCommand: (path: string, line?: number) => string;
}

function withLineSuffix(path: string, line?: number): string {
  if (line == null || !Number.isFinite(line) || line < 1) return path;
  return `${path}:${Math.floor(line)}`;
}

function vscodeFamilyUrl(scheme: string, path: string, line?: number): string {
  return `${scheme}://file/${encodeURI(withLineSuffix(path, line))}`;
}

function jetbrainsUrl(scheme: string, path: string, line?: number): string {
  const base = `${scheme}://open?file=${encodeURI(path)}`;
  if (line == null || !Number.isFinite(line) || line < 1) return base;
  return `${base}&line=${Math.floor(line)}`;
}

export const SUPPORTED_IDES: IdeOption[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    shortName: 'VS Code',
    getProtocolUrl: (path, line) => vscodeFamilyUrl('vscode', path, line),
    getCliCommand: (path, line) =>
      line != null && line >= 1
        ? `code -n -g "${path}:${Math.floor(line)}"`
        : `code -n "${path}"`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    shortName: 'Cursor',
    getProtocolUrl: (path, line) => vscodeFamilyUrl('cursor', path, line),
    getCliCommand: (path, line) =>
      line != null && line >= 1
        ? `cursor -n -g "${path}:${Math.floor(line)}"`
        : `cursor -n "${path}"`,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    shortName: 'Windsurf',
    getProtocolUrl: (path, line) => vscodeFamilyUrl('windsurf', path, line),
    getCliCommand: (path, line) =>
      line != null && line >= 1
        ? `windsurf -n -g "${path}:${Math.floor(line)}"`
        : `windsurf -n "${path}"`,
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    shortName: 'WebStorm',
    getProtocolUrl: (path, line) => jetbrainsUrl('webstorm', path, line),
    getCliCommand: (path, line) =>
      line != null && line >= 1 ? `webstorm --line ${Math.floor(line)} "${path}"` : `webstorm "${path}"`,
  },
  {
    id: 'idea',
    name: 'IntelliJ IDEA',
    shortName: 'IntelliJ',
    getProtocolUrl: (path, line) => jetbrainsUrl('idea', path, line),
    getCliCommand: (path, line) =>
      line != null && line >= 1 ? `idea --line ${Math.floor(line)} "${path}"` : `idea "${path}"`,
  },
  {
    id: 'zed',
    name: 'Zed',
    shortName: 'Zed',
    getProtocolUrl: (path, line) => `zed://file/${encodeURI(withLineSuffix(path, line))}`,
    getCliCommand: (path, line) => `zed "${withLineSuffix(path, line)}"`,
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    shortName: 'Sublime',
    getProtocolUrl: (path, line) => {
      const base = `subl://open?url=file://${encodeURI(path)}`;
      if (line == null || !Number.isFinite(line) || line < 1) return base;
      return `${base}&line=${Math.floor(line)}`;
    },
    getCliCommand: (path, line) => `subl "${withLineSuffix(path, line)}"`,
  },
];

export function resolveIdeOption(id: string): IdeOption {
  return SUPPORTED_IDES.find(ide => ide.id === id) ?? SUPPORTED_IDES[0];
}
