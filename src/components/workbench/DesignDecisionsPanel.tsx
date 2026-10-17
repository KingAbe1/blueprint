import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ArchitecturalInterview } from '../../types/project';
import { overviewDivideClass } from '../project/overviewUi';
import { CATEGORY_LABELS, CATEGORY_MAP_NODE, DECISION_GROUPS } from './architectureInterviewLabels';
import { workbenchTheme } from './workbenchUi';

interface DesignDecisionsPanelProps {
  interview: ArchitecturalInterview;
  /** When false, content starts collapsed behind the header row. */
  defaultExpanded?: boolean;
  className?: string;
  /** When set, decision rows can focus the linked map node. */
  onFocusMapNode?: (nodeId: string) => void;
  focusedMapNodeId?: string | null;
}

export const DesignDecisionsPanel: React.FC<DesignDecisionsPanelProps> = ({
  interview,
  defaultExpanded = true,
  className = '',
  onFocusMapNode,
  focusedMapNodeId,
}) => {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { border, panel, muted, title: titleText, inner } = workbenchTheme(isDark);
  const divide = overviewDivideClass(isDark);

  if (interview.status !== 'completed') return null;

  const answerCount =
    interview.questions.length + (interview.inferredFacts?.length ?? 0);

  return (
    <section className={`overflow-hidden rounded-2xl border ${panel} ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(open => !open)}
        className={`flex w-full items-start justify-between gap-4 border-b px-5 py-4 text-left transition-colors sm:px-6 ${border} ${
          isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'
        }`}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className={`text-xs ${muted}`}>Build questions</p>
          <h3 className={`mt-0.5 text-[13px] ${titleText}`}>Design decisions</h3>
          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
            Choices and constraints that shaped the recommended stack and system map.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {answerCount} recorded
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''} ${muted}`}
            aria-hidden
          />
        </div>
      </button>

      {expanded ? (
        <div className="space-y-4 p-5 sm:p-6">
          {(interview.inferredFacts || []).length > 0 ? (
            <div className={`overflow-hidden rounded-xl border ${inner}`}>
              <div className={`border-b px-4 py-3 ${border}`}>
                <p className={`text-xs ${titleText}`}>From your brief</p>
                <p className={`mt-0.5 text-[11px] ${muted}`}>Already decided — no question asked.</p>
              </div>
              <ul className={`divide-y ${divide}`}>
                {(interview.inferredFacts || []).map(fact => (
                  <li
                    key={`${fact.category}-${fact.value}`}
                    className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3"
                  >
                    <span className={`shrink-0 text-[10px] uppercase tracking-wide ${muted}`}>
                      {CATEGORY_LABELS[fact.category]}
                    </span>
                    <span className={`text-[13px] ${titleText}`}>{fact.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {DECISION_GROUPS.map(group => {
              const groupQuestions = interview.questions.filter(question =>
                group.categories.includes(question.category),
              );
              if (groupQuestions.length === 0) return null;

              return (
                <div key={group.title} className={`overflow-hidden rounded-xl border ${inner}`}>
                  <div className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${border}`}>
                    <div className="min-w-0">
                      <p className={`text-[13px] ${titleText}`}>{group.title}</p>
                      <p className={`mt-0.5 text-[11px] leading-relaxed ${muted}`}>{group.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                        isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-white text-slate-500'
                      }`}
                    >
                      {groupQuestions.length}
                    </span>
                  </div>
                  <div className={`divide-y ${divide}`}>
                    {groupQuestions.map(question => {
                      const answer = interview.answers.find(item => item.questionId === question.id);
                      const mapNodeId = CATEGORY_MAP_NODE[question.category];
                      const isLinked = Boolean(mapNodeId && onFocusMapNode);
                      const isFocused = mapNodeId && focusedMapNodeId === mapNodeId;
                      const rowClass = `px-4 py-3 text-left w-full transition-colors ${
                        isFocused ? (isDark ? 'bg-blue-500/[0.08]' : 'bg-blue-50/80') : ''
                      } ${isLinked ? (isDark ? 'hover:bg-white/[0.03] cursor-pointer' : 'hover:bg-slate-50 cursor-pointer') : ''}`;

                      const content = (
                        <>
                          <p className={`text-[10px] uppercase tracking-wide ${muted}`}>
                            {CATEGORY_LABELS[question.category]}
                            {isLinked ? (
                              <span className={`ml-2 normal-case tracking-normal ${isDark ? 'text-blue-400/90' : 'text-blue-600'}`}>
                                · Show on map
                              </span>
                            ) : null}
                          </p>
                          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{question.question}</p>
                          <p className={`mt-2 text-[13px] ${titleText}`}>{answer?.label || 'No preference'}</p>
                        </>
                      );

                      if (isLinked && mapNodeId) {
                        return (
                          <button
                            key={question.id}
                            type="button"
                            onClick={() => onFocusMapNode?.(mapNodeId)}
                            className={rowClass}
                          >
                            {content}
                          </button>
                        );
                      }

                      return (
                        <div key={question.id} className={rowClass}>
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
};
