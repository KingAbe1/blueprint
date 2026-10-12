import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, Cloud, Database, Layers, MonitorSmartphone, Server, Sparkles } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { isDesktopApp } from '../../utils/platform';
import { ArchitectureQuestion, ArchitectureTopology } from '../../types/project';
import { ArchitectureMap } from './ArchitectureMap';
import { WorkbenchPhaseHeader } from './WorkbenchPhaseHeader';

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
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();
  const interview = activeProject?.spec.interview;
  const recommendation = activeProject?.spec.frameworkRecommendation || activeProject?.spec.frameworkRecommendations?.[0];
  const ready = interview?.status === 'completed' && Boolean(recommendation);
  const desktop = isDesktopApp();
  const cardRadius = desktop ? 'rounded-lg' : 'rounded-2xl';

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
  const pagePadding = desktop
    ? 'w-full px-6 py-7 lg:px-8 xl:px-10'
    : 'w-full px-5 py-7 sm:px-6 lg:px-10 lg:py-8 xl:px-12';

  const stackLayers = useMemo(() => {
    if (!recommendation) return [];
    const topology = recommendation.topology || 'modular_monolith';
    return [
      { id: 'shape', label: 'System shape', value: TOPOLOGY_LABELS[topology], icon: Layers },
      { id: 'frontend', label: 'Frontend', value: recommendation.frontendStack, icon: MonitorSmartphone },
      { id: 'backend', label: 'Backend', value: recommendation.backendStack, icon: Server },
      { id: 'data', label: 'Data', value: recommendation.databaseStack, icon: Database },
      { id: 'deploy', label: 'Deployment', value: recommendation.deploymentTarget, icon: Cloud },
    ].filter(layer => Boolean(layer.value));
  }, [recommendation]);

  if (!activeProject) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={pagePadding}>
        <WorkbenchPhaseHeader
          eyebrow={
            ready
              ? `${activeProject.name} · Step 2 of 3 · Stack ready`
              : `${activeProject.name} · Step 2 of 3 · Finish build questions first`
          }
          title="Architecture map"
          description={
            ready
              ? 'See how users, apps, data, and delivery connect—then open build handoff when you’re ready to implement.'
              : 'Blueprint turns your product brief and answers into an interactive system map.'
          }
          actions={
            ready ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onEditDecisions} className="btn-secondary-accent flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit decisions
                </button>
                <button type="button" onClick={onProceedToHandoff} className="btn-primary-blue flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white">
                  Prepare build handoff
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : undefined
          }
        />

        {!ready || !recommendation ? (
          <section className={`mx-auto mt-8 max-w-lg border p-8 text-center ${cardRadius} ${surface}`}>
            <div className={`mx-auto flex h-12 w-12 items-center justify-center ${cardRadius} ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>Finish build questions first</h2>
            <p className={`mx-auto mt-2 text-sm leading-6 ${muted}`}>
              Answer the tailored question set on the product blueprint tab. The map and stack recommendation appear when you’re done.
            </p>
            <button type="button" onClick={onEditDecisions} className="btn-primary-blue mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white">
              Go to product blueprint
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        ) : (
          <div className="space-y-5">
            <section className={`border p-5 sm:p-6 ${cardRadius} ${surface}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                    Recommended stack
                  </p>
                  <h2 className={`mt-2 text-xl font-semibold tracking-tight sm:text-2xl ${isDark ? 'text-white' : 'text-slate-950'}`}>
                    {recommendation.name}
                  </h2>
                  {recommendation.category && (
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {recommendation.category}
                    </span>
                  )}
                  <p className={`mt-3 max-w-3xl text-sm leading-6 ${muted}`}>{recommendation.description}</p>
                </div>
                {recommendation.bestFor && (
                  <p className={`lg:max-w-xs lg:border-l lg:pl-6 text-xs leading-5 ${muted} ${isDark ? 'lg:border-white/[0.08]' : 'lg:border-slate-200'}`}>
                    <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Good fit when </span>
                    {recommendation.bestFor}
                  </p>
                )}
              </div>

              {stackLayers.length > 0 && (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {stackLayers.map(layer => {
                    const Icon = layer.icon;
                    return (
                      <div
                        key={layer.id}
                        className={`min-w-0 rounded-xl border p-3.5 ${isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200/90 bg-slate-50/80'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${muted}`}>{layer.label}</span>
                        </div>
                        <p
                          className={`mt-2 text-xs font-medium leading-5 line-clamp-3 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                          title={layer.value}
                        >
                          {layer.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <ArchitectureMap
              projectId={activeProject.id}
              recommendation={recommendation}
              decisions={decisions}
              isDark={isDark}
              persistedLayout={activeProject.spec.architectureMapLayout}
              onPersistLayout={layout => updateProjectSpec(activeProject.id, { architectureMapLayout: layout })}
            />

            {recommendation.whyReasons && recommendation.whyReasons.length > 0 && (
              <section className={`border p-5 sm:p-6 ${cardRadius} ${surface}`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>Why this stack fits your project</h3>
                <p className={`mt-1 text-xs ${muted}`}>Grounded in your brief, build-question answers, and the topology choice above.</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendation.whyReasons.slice(0, 6).map(reason => (
                    <li
                      key={reason}
                      className={`flex gap-2.5 rounded-xl border p-3.5 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200/90 bg-slate-50/60'}`}
                    >
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{reason}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
