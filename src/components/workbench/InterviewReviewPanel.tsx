import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ArchitecturalInterview } from '../../types/project';
import { CATEGORY_LABELS } from './architectureInterviewLabels';
import { workbenchTheme } from './workbenchUi';
import { overviewDivideClass } from '../project/overviewUi';

interface InterviewReviewPanelProps {
  interview: ArchitecturalInterview;
  onBack: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export const InterviewReviewPanel: React.FC<InterviewReviewPanelProps> = ({
  interview,
  onBack,
  onConfirm,
  isSubmitting = false,
}) => {
  const { isDark } = useTheme();
  const { border, panel, muted, title: titleText, inner } = workbenchTheme(isDark);
  const divide = overviewDivideClass(isDark);

  return (
    <div className={`overflow-hidden rounded-2xl border ${panel}`}>
      <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
        <p className={`text-xs ${muted}`}>Before architecture</p>
        <h3 className={`mt-0.5 text-[15px] font-medium ${titleText}`}>Review your answers</h3>
        <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
          Confirm everything looks right. blueprint studio will pick a stack and build your architecture map from these choices.
        </p>
      </div>
      <ul className={`max-h-[min(50vh,420px)] divide-y overflow-y-auto ${divide}`}>
        {interview.questions.map(question => {
          const answer = interview.answers.find(item => item.questionId === question.id);
          return (
            <li key={question.id} className="px-5 py-3.5 sm:px-6">
              <p className={`text-[10px] uppercase tracking-wide ${muted}`}>{CATEGORY_LABELS[question.category]}</p>
              <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{question.question}</p>
              <p className={`mt-2 text-[13px] ${titleText}`}>{answer?.label || 'No preference'}</p>
            </li>
          );
        })}
      </ul>
      <div className={`flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-between sm:px-6 ${border} ${inner}`}>
        <button type="button" onClick={onBack} className="btn-secondary flex items-center justify-center gap-2 px-3 py-2 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to last question
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="btn-primary-blue flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Building architecture…' : (
            <>
              <Check className="h-3.5 w-3.5" />
              Build final architecture
            </>
          )}
        </button>
      </div>
    </div>
  );
};
