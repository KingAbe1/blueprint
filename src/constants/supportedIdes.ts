export interface IdeOption {
  id: string;
  name: string;
  shortName: string;
  getProtocolUrl: (path: string) => string;
  getCliCommand: (path: string) => string;
}

export const SUPPORTED_IDES: IdeOption[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    shortName: 'VS Code',
    getProtocolUrl: path => `vscode://file/${encodeURI(path)}`,
    getCliCommand: path => `code "${path}"`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    shortName: 'Cursor',
    getProtocolUrl: path => `cursor://file/${encodeURI(path)}`,
    getCliCommand: path => `cursor "${path}"`,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    shortName: 'Windsurf',
    getProtocolUrl: path => `windsurf://file/${encodeURI(path)}`,
    getCliCommand: path => `windsurf "${path}"`,
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    shortName: 'WebStorm',
    getProtocolUrl: path => `webstorm://open?file=${encodeURI(path)}`,
    getCliCommand: path => `webstorm "${path}"`,
  },
  {
    id: 'idea',
    name: 'IntelliJ IDEA',
    shortName: 'IntelliJ',
    getProtocolUrl: path => `idea://open?file=${encodeURI(path)}`,
    getCliCommand: path => `idea "${path}"`,
  },
  {
    id: 'zed',
    name: 'Zed',
    shortName: 'Zed',
    getProtocolUrl: path => `zed://file/${encodeURI(path)}`,
    getCliCommand: path => `zed "${path}"`,
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    shortName: 'Sublime',
    getProtocolUrl: path => `subl://open?url=file://${encodeURI(path)}`,
    getCliCommand: path => `subl "${path}"`,
  },
];

export function resolveIdeOption(id: string): IdeOption {
  return SUPPORTED_IDES.find(ide => ide.id === id) ?? SUPPORTED_IDES[0];
}
