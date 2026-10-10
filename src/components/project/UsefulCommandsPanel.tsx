import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface UsefulCommandsPanelProps { scripts: NonNullable<CodebaseAnalysis['scripts']>; }

const SCRIPT_PURPOSES: Record<string, string> = {
  dev: 'Start development', start: 'Start application', serve: 'Serve application',
  build: 'Build project', test: 'Run tests', lint: 'Check code style',
  typecheck: 'Check types', check: 'Run checks', 'tauri:dev': 'Run desktop app',
};

export const UsefulCommandsPanel: React.FC<UsefulCommandsPanelProps> = ({ scripts }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copyCommand = async (command: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
    } catch {
      setCopyError('Could not copy the command. You can select and copy it instead.');
    }
  };

  return <section className={`rounded-xl border p-4 ${isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Useful commands</h2>
        <p className={`mt-1 text-xs ${muted}`}>Copy a command and run it from the project folder.</p>
      </div>
      {scripts.length > 0 && <span className={`text-[10px] ${muted}`}>{scripts.length} shown</span>}
    </div>
    {scripts.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {scripts.map(script => {
        const runCommand = script.runCommand || `npm run ${script.name}`;
        const purpose = SCRIPT_PURPOSES[script.name] || 'Project script';
        const isCopied = copiedCommand === runCommand;
        return <div key={script.name} className={`min-w-0 rounded-xl border p-3.5 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{purpose}</p>
              <p className={`mt-0.5 text-[10px] ${muted}`}>{script.name} script</p>
            </div>
            <button type="button" onClick={() => void copyCommand(runCommand)} aria-label={isCopied ? `Copied ${runCommand}` : `Copy ${runCommand}`} title={isCopied ? 'Copied' : 'Copy command'} className={`shrink-0 rounded-md p-1.5 transition-colors ${isDark ? 'text-slate-400 hover:bg-white/[0.08] hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-900'}`}>
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <code className={`block overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-[11px] ${isDark ? 'bg-black/25 text-blue-200' : 'bg-white text-blue-700'}`}>{runCommand}</code>
        </div>;
      })}
    </div> : <p className={`mt-3 text-xs ${muted}`}>No package scripts were found in package.json.</p>}
    {copyError && <p role="status" className={`mt-3 text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{copyError}</p>}
  </section>;
};
