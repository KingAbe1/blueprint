import React, { useState } from 'react';
import { Check, Copy, Terminal, Play, Sparkles } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface UsefulCommandsPanelProps {
  scripts: NonNullable<CodebaseAnalysis['scripts']>;
}

const SCRIPT_PURPOSES: Record<string, { label: string; badge: string; color: string }> = {
  dev: { label: 'Start Development Server', badge: 'DEV', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  start: { label: 'Start Production Server', badge: 'PROD', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  serve: { label: 'Serve Static Bundle', badge: 'SERVE', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  build: { label: 'Build Production Assets', badge: 'BUILD', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  test: { label: 'Run Automated Test Suite', badge: 'TEST', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  lint: { label: 'Check ESLint & Code Style', badge: 'LINT', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  typecheck: { label: 'Verify TypeScript Types', badge: 'TYPES', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  check: { label: 'Run Quality Checks', badge: 'CHECK', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  'tauri:dev': { label: 'Launch Desktop Tauri App', badge: 'DESKTOP', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
};

export const UsefulCommandsPanel: React.FC<UsefulCommandsPanelProps> = ({ scripts }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';
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

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <Terminal className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Available Package Scripts & Commands
            </h2>
          </div>
        </div>
        {scripts.length > 0 && (
          <span className={`text-[10px] font-mono ${muted}`}>
            {scripts.length} declared {scripts.length === 1 ? 'script' : 'scripts'}
          </span>
        )}
      </div>

      {scripts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {scripts.map(script => {
            const runCommand = script.runCommand || `npm run ${script.name}`;
            const meta = SCRIPT_PURPOSES[script.name] || {
              label: `${script.name} script`,
              badge: 'SCRIPT',
              color: 'text-slate-400 bg-white/[0.04] border-white/[0.08]',
            };
            const isCopied = copiedCommand === runCommand;

            return (
              <div
                key={script.name}
                className={`group min-w-0 rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                  isDark
                    ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[8px] font-mono font-semibold px-1.5 py-0.2 rounded border ${meta.color}`}>
                      {meta.badge}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyCommand(runCommand)}
                      aria-label={isCopied ? `Copied ${runCommand}` : `Copy ${runCommand}`}
                      title={isCopied ? 'Copied' : 'Copy command'}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        isCopied
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : isDark
                          ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {meta.label}
                  </h4>
                </div>

                <div className="mt-3">
                  <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-[11px] border ${
                    isDark ? 'bg-black/30 border-white/[0.04] text-blue-300' : 'bg-white border-slate-200 text-blue-700'
                  }`}>
                    <code className="truncate">{runCommand}</code>
                    <Play className={`h-2.5 w-2.5 shrink-0 opacity-40 ml-2 ${muted}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={`text-xs ${muted}`}>No package scripts were detected in package.json.</p>
      )}

      {copyError && (
        <p role="status" className={`mt-3 text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
          {copyError}
        </p>
      )}
    </section>
  );
};
