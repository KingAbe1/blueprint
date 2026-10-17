import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { workbenchTheme } from './workbenchUi';

export type WorkbenchStepState = 'pending' | 'current' | 'complete';

export interface WorkbenchStep {
  id: string;
  label: string;
  state: WorkbenchStepState;
}

interface WorkbenchPhaseHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  steps?: WorkbenchStep[];
  actions?: React.ReactNode;
}

export const WorkbenchPhaseHeader: React.FC<WorkbenchPhaseHeaderProps> = ({
  eyebrow,
  title,
  description,
  steps,
  actions,
}) => {
  const { isDark } = useTheme();
  const { border, panel, muted, title: titleText } = workbenchTheme(isDark);

  return (
    <div className={`mb-6 overflow-hidden rounded-2xl border ${panel}`}>
      <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className={`text-xs ${muted}`}>{eyebrow}</p>
            <h1 className={`mt-0.5 text-[15px] font-medium sm:text-base ${titleText}`}>{title}</h1>
            <p className={`mt-1.5 max-w-2xl text-[13px] leading-relaxed ${muted}`}>{description}</p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {steps && steps.length > 0 ? (
          <ol className="mt-4 flex flex-wrap items-center gap-2" aria-label="Phase progress">
            {steps.map((step, index) => {
              const complete = step.state === 'complete';
              const current = step.state === 'current';
              const base = `inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] sm:text-xs ${
                complete
                  ? isDark
                    ? 'border-blue-500/25 bg-blue-500/[0.06] text-blue-200'
                    : 'border-blue-200/90 bg-blue-50/60 text-blue-900'
                  : current
                    ? isDark
                      ? 'border-blue-500/35 bg-blue-500/[0.08] text-slate-100'
                      : 'border-blue-300/80 bg-white text-slate-900'
                    : isDark
                      ? 'border-white/[0.06] bg-white/[0.02] text-slate-500'
                      : 'border-slate-200/90 bg-slate-50/80 text-slate-500'
              }`;

              return (
                <li key={step.id} className="flex items-center gap-2">
                  <span className={base}>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        complete
                          ? 'bg-blue-500 text-white'
                          : current
                            ? isDark
                              ? 'bg-blue-400/90 text-[#0C0D0F]'
                              : 'bg-blue-600 text-white'
                            : isDark
                              ? 'bg-white/[0.08] text-slate-400'
                              : 'bg-slate-200 text-slate-600'
                      }`}
                      aria-hidden
                    >
                      {complete ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : index + 1}
                    </span>
                    {step.label}
                  </span>
                  {index < steps.length - 1 ? (
                    <span
                      className={`hidden h-px w-3 sm:block ${complete ? 'bg-blue-500/40' : isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`}
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
};
