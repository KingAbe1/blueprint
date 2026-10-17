import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { overviewBorderClass, overviewDivideClass, overviewPanelClass } from './overviewUi';

interface UsefulCommandsPanelProps {
  scripts: NonNullable<CodebaseAnalysis['scripts']>;
  embedded?: boolean;
}

const SCRIPT_PURPOSES: Record<string, string> = {
  dev: 'Start development server',
  start: 'Start production server',
  serve: 'Serve static bundle',
  build: 'Build production assets',
  test: 'Run test suite',
  lint: 'Lint and style checks',
  typecheck: 'TypeScript verification',
  check: 'Quality checks',
  'tauri:dev': 'Launch Tauri desktop app',
};

export const UsefulCommandsPanel: React.FC<UsefulCommandsPanelProps> = React.memo(({ scripts, embedded = false }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = overviewPanelClass(isDark);
  const divide = overviewDivideClass(isDark);
  const border = overviewBorderClass(isDark);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copyCommand = async (command: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 1800);
    } catch {
      setCopyError('Could not copy command to clipboard.');
    }
  };

  const shellClass = embedded ? '' : `overflow-hidden rounded-2xl border ${panel}`;
  const Shell = embedded ? 'div' : 'section';

  const list = (
    <ul className={`divide-y ${divide}`}>
      {scripts.map(script => {
        const runCommand = script.runCommand || `npm run ${script.name}`;
        const description = SCRIPT_PURPOSES[script.name] || `${script.name} script`;
        const isCopied = copiedCommand === runCommand;

        return (
          <li key={script.name} className="px-5 py-3.5 first:pt-4 last:pb-4 sm:px-6 sm:first:pt-5 sm:last:pb-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-[13px] font-medium ${title}`}>{script.name}</p>
                <p className={`mt-0.5 text-xs ${muted}`}>{description}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyCommand(runCommand)}
                aria-label={isCopied ? `Copied ${runCommand}` : `Copy ${runCommand}`}
                className={
                  isDark
                    ? 'shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300'
                    : 'shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800'
                }
              >
                {isCopied ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Copy className="h-3 w-3" />
                    Copy
                  </span>
                )}
              </button>
            </div>
            <code
              className={`mt-2 block truncate font-mono text-[11px] ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {runCommand}
            </code>
          </li>
        );
      })}
    </ul>
  );

  if (embedded) {
    return scripts.length > 0 ? (
      <div>{list}</div>
    ) : (
      <p className={`px-5 py-10 text-center text-sm sm:px-6 ${muted}`}>No package scripts in package.json.</p>
    );
  }

  return (
    <Shell className={shellClass}>
      <header className={`border-b px-5 py-4 sm:px-6 ${border}`}>
        <h2 className={`text-[15px] font-medium ${title}`}>Scripts</h2>
        <p className={`mt-0.5 text-[13px] ${muted}`}>
          {scripts.length > 0 ? `${scripts.length} npm scripts` : 'No scripts detected'}
        </p>
      </header>
      {scripts.length > 0 ? list : (
        <p className={`px-5 py-8 text-sm sm:px-6 ${muted}`}>No package scripts were detected in package.json.</p>
      )}
      {copyError ? (
        <p role="status" className={`border-t px-5 py-2 text-xs sm:px-6 ${border} ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
          {copyError}
        </p>
      ) : null}
    </Shell>
  );
});
