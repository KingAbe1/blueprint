import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, Layers, Sparkles } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { ArchitectureQuestion, ArchitectureTopology } from '../../types/project';
import { ArchitectureMap } from './ArchitectureMap';

interface ArchitectureMapViewProps {
  onEditDecisions: () => void;
  onProceedToHandoff: () => void;
}

const TOPOLOGY_LABELS: Record<ArchitectureTopology, string> = {
  modular_monolith: 'Modular monolith',
  microservices: 'Independent services',
  serverless: 'Managed serverless',
  event_driven: 'Event-driven system',
  hybrid: 'Hybrid architecture',
};

export const ArchitectureMapView: React.FC<ArchitectureMapViewProps> = ({ onEditDecisions, onProceedToHandoff }) => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();
  const interview = activeProject?.spec.interview;
  const recommendation = activeProject?.spec.frameworkRecommendation || activeProject?.spec.frameworkRecommendations?.[0];
  const ready = interview?.status === 'completed' && Boolean(recommendation);

  const decisions = useMemo(() => {
    if (interview?.status !== 'completed') return [];
    return [
      ...(interview.inferredFacts || []).map(fact => ({ category: fact.category, value: fact.value })),
      ...interview.questions.map(question => {
        const answer = interview.answers.find(item => item.questionId === question.id);
        return {
          category: question.category as ArchitectureQuestion['category'],
          value: answer?.label || 'No preference',
        };
      }),
    ];
  }, [interview]);

  const surface = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  if (!activeProject) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-5 py-7 sm:px-6 lg:px-10 lg:py-8 xl:px-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className={`mb-2 text-xs font-medium ${muted}`}>System design</div>
            <h1 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Architecture map</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>Explore how the chosen architecture fits together, from the people using the product to its services, data, and delivery.</p>
          </div>
          {ready && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              <button type="button" onClick={onEditDecisions} className={`flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-colors ${isDark ? 'border-white/[0.09] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Edit decisions
              </button>
              <button type="button" onClick={onProceedToHandoff} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
                Prepare build handoff
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {!ready || !recommendation ? (
          <section className={`mx-auto mt-12 max-w-2xl rounded-2xl border p-8 text-center ${surface}`}>
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-600'}`}>
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>Finish the build questions first</h2>
            <p className={`mx-auto mt-2 max-w-lg text-sm leading-6 ${muted}`}>Blueprint will create an interactive map from your product brief and your answers. You can return here once every question is answered.</p>
            <button type="button" onClick={onEditDecisions} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
              Go to product blueprint
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        ) : (
          <>
            <ArchitectureMap recommendation={recommendation} decisions={decisions} isDark={isDark} />

            <section className={`mt-5 rounded-2xl border p-5 sm:p-6 ${isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white'}`}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.8fr)]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Chosen architecture</span>
                  </div>
                  <h2 className={`mt-3 text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>{recommendation.name}</h2>
                  <p className={`mt-2 max-w-3xl text-sm leading-6 ${muted}`}>{recommendation.description}</p>
                  <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
                    {[
                      ['System shape', TOPOLOGY_LABELS[recommendation.topology || 'modular_monolith']],
                      ['Frontend', recommendation.frontendStack],
                      ['Backend', recommendation.backendStack],
                      ['Data', recommendation.databaseStack],
                      ['Deployment', recommendation.deploymentTarget],
                    ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                      <div key={label} className={`border-b py-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                        <div className={`text-xs font-medium ${muted}`}>{label}</div>
                        <div className={`mt-1 text-sm font-medium leading-5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {recommendation.whyReasons?.length > 0 && (
                  <div className={`lg:border-l lg:pl-6 ${isDark ? 'lg:border-white/[0.08]' : 'lg:border-slate-200'}`}>
                    <div className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Why this fits</div>
                    <div className="mt-3 space-y-4">
                      {recommendation.whyReasons.slice(0, 3).map(reason => (
                        <div key={reason} className="flex gap-2.5">
                          <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} />
                          <p className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

          </>
        )}
      </div>
    </div>
  );
};
