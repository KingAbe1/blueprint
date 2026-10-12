import React, { useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { parseProductBriefSections } from '../../services/domainExtractor';

interface ProductBriefDisplayProps {
  text: string;
  wordCount: number;
  showWordCount?: boolean;
}

export const ProductBriefDisplay: React.FC<ProductBriefDisplayProps> = ({
  text,
  wordCount,
  showWordCount = true,
}) => {
  const { isDark } = useTheme();
  const sections = useMemo(() => parseProductBriefSections(text), [text]);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';
  const sectionShell = isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200/80 bg-white/80';

  return (
    <div className={`overflow-hidden rounded-xl border ${sectionShell}`}>
      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {sections.map(section => (
          <section key={section.id} aria-labelledby={`brief-${section.id}`}>
            <h3
              id={`brief-${section.id}`}
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}
            >
              {section.title}
            </h3>
            {section.paragraphs.length > 0 && (
              <div className={`mt-2 space-y-2 text-sm leading-6 ${body}`}>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.id}-p-${index}`}>{paragraph}</p>
                ))}
              </div>
            )}
            {section.bullets.length > 0 && (
              <ul className={`mt-2 space-y-1.5 ${section.paragraphs.length > 0 ? '' : 'mt-2'}`}>
                {section.bullets.map((bullet, index) => (
                  <li key={`${section.id}-b-${index}`} className={`flex gap-2 text-sm leading-5 ${body}`}>
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {showWordCount && (
        <div className={`border-t px-4 py-2.5 sm:px-5 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
          <span className={`text-xs ${muted}`}>{wordCount} words</span>
        </div>
      )}
    </div>
  );
};
