import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium ${muted}`}>{eyebrow}</p>
        <h1
          className={`mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem] ${
            isDark ? 'text-white' : 'text-slate-950'
          }`}
        >
          {title}
        </h1>
        <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>{description}</p>

        {steps && steps.length > 0 ? (
          <ol
            className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3"
            aria-label="Phase progress"
          >
            {steps.map((step, index) => {
              const complete = step.state === 'complete';
              const current = step.state === 'current';
              const track = isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-50';
              const completeStyles = isDark
                ? 'border-blue-500/35 bg-blue-500/10 text-blue-200'
                : 'border-blue-200 bg-blue-50 text-blue-800';
              const currentStyles = isDark
                ? 'border-blue-500/50 bg-blue-500/15 text-white'
                : 'border-blue-300 bg-white text-slate-900 shadow-sm';
              const pendingStyles = isDark
                ? 'border-transparent text-slate-500'
                : 'border-transparent text-slate-500';

              return (
                <li key={step.id} className="flex items-center gap-2 sm:gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                      complete ? completeStyles : current ? currentStyles : `${track} ${pendingStyles}`
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        complete
                          ? 'bg-blue-500 text-white'
                          : current
                            ? isDark
                              ? 'bg-blue-400 text-[#0C0D0F]'
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
                      className={`hidden h-px w-4 sm:block sm:w-6 ${
                        complete ? 'bg-blue-500/50' : isDark ? 'bg-white/[0.08]' : 'bg-slate-200'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-start lg:items-center">{actions}</div> : null}
    </div>
  );
};
