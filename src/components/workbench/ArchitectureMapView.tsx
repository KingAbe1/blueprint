import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Cloud, Database, Layers, Map, MonitorSmartphone, Server } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { isDesktopApp } from '../../utils/platform';
import { ArchitectureQuestion, ArchitectureTopology } from '../../types/project';
import { ArchitectureMap } from './ArchitectureMap';
import { resolveArchitectureMapFeatures } from '../../services/architectureMapFeatures';
import { shouldShowSeparateIdentityNode } from './architectureInterviewLabels';
import { WorkbenchPhaseHeader } from './WorkbenchPhaseHeader';
import { workbenchCanvasClass, workbenchPagePadding, workbenchTheme } from './workbenchUi';
import { DesignDecisionsPanel } from './DesignDecisionsPanel';

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
  const { border, panel, muted, title: titleText, inner } = workbenchTheme(isDark);
  const [focusedMapNodeId, setFocusedMapNodeId] = useState<string | null>(null);

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

  const separateIdentityNode = useMemo(() => {
    const accessBits = decisions
      .filter(decision => decision.category === 'access' || decision.category === 'security')
      .map(decision => decision.value)
      .join(' · ');
    const allBits = decisions.map(decision => decision.value).join(' ');
    return shouldShowSeparateIdentityNode(accessBits, allBits);
  }, [decisions]);

  const mapFeatures = useMemo(() => {
    if (!recommendation) return null;
    const topology = recommendation.topology || 'modular_monolith';
    const simple = resolveArchitectureMapFeatures(recommendation, topology, decisions, false);
    const detailedView = resolveArchitectureMapFeatures(recommendation, topology, decisions, true);
    return {
      showRealtime: simple.showRealtime || detailedView.showRealtime,
      showAnalytics: simple.showAnalytics || detailedView.showAnalytics,
      showDr: simple.showDr || detailedView.showDr,
    };
  }, [recommendation, decisions]);

  if (!activeProject) return null;

  return (
    <div className={`flex-1 overflow-y-auto ${workbenchCanvasClass(isDark)}`}>
      <div className={workbenchPagePadding(desktop)}>
        <WorkbenchPhaseHeader
          eyebrow={
            ready
              ? `${activeProject.name} · Step 2 of 3 · Stack ready`
              : `${activeProject.name} · Step 2 of 3 · Finish build questions first`
          }
          title="Architecture map"
          description={
            ready
              ? 'See how users, apps, data, and delivery connect. Switch to Detailed for cache, edge, and async layers - then open build handoff when you’re ready.'
              : 'blueprint studio turns your product brief and answers into an interactive system map.'
          }
          actions={
            ready ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onEditDecisions} className="btn-secondary-accent flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit decisions
                </button>
                <button type="button" onClick={onProceedToHandoff} className="btn-primary-blue flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white">
                  Prepare build handoff
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : undefined
          }
        />

        {!ready || !recommendation ? (
          <section className={`mx-auto mt-2 max-w-lg overflow-hidden rounded-2xl border ${panel}`}>
            <div className="px-6 py-10 text-center">
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border ${border} ${inner}`}>
                <Map className="h-5 w-5 text-blue-500" strokeWidth={1.75} />
              </div>
              <h2 className={`mt-4 text-[15px] font-medium ${titleText}`}>Finish build questions first</h2>
              <p className={`mx-auto mt-2 max-w-sm text-[13px] leading-relaxed ${muted}`}>
                Answer the tailored question set on the product blueprint tab. The map and stack recommendation appear when you’re done.
              </p>
              <button type="button" onClick={onEditDecisions} className="btn-primary-blue mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white">
                Go to product blueprint
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <section className={`overflow-hidden rounded-2xl border ${panel}`}>
              <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
                <p className={`text-xs ${muted}`}>Recommended stack</p>
                <h2 className={`mt-0.5 text-[15px] font-medium ${titleText}`}>{recommendation.name}</h2>
                {recommendation.category ? (
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {recommendation.category}
                  </span>
                ) : null}
                <p className={`mt-2 max-w-3xl text-[13px] leading-relaxed ${muted}`}>{recommendation.description}</p>
                {recommendation.bestFor ? (
                  <p className={`mt-3 text-xs leading-relaxed ${muted}`}>
                    <span className={titleText}>Good fit when </span>
                    {recommendation.bestFor}
                  </p>
                ) : null}
              </div>

              {stackLayers.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-5">
                  {stackLayers.map(layer => {
                    const Icon = layer.icon;
                    return (
                      <div key={layer.id} className={`min-w-0 rounded-xl border p-3.5 ${inner}`}>
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${border} ${isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-white text-slate-500'}`}>
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                          <span className={`text-[10px] uppercase tracking-wide ${muted}`}>{layer.label}</span>
                        </div>
                        <p className={`mt-2 text-xs leading-5 line-clamp-3 ${titleText}`} title={layer.value}>
                          {layer.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <ArchitectureMap
              projectId={activeProject.id}
              recommendation={recommendation}
              decisions={decisions}
              isDark={isDark}
              exportTitle={`${activeProject.name} architecture map`}
              highlightedNodeId={focusedMapNodeId}
              onHighlightNode={setFocusedMapNodeId}
              persistedLayout={activeProject.spec.architectureMapLayout}
              onPersistLayout={layout => updateProjectSpec(activeProject.id, { architectureMapLayout: layout })}
            />

            {interview?.status === 'completed' ? (
              <DesignDecisionsPanel
                interview={interview}
                focusedMapNodeId={focusedMapNodeId}
                onFocusMapNode={nodeId => setFocusedMapNodeId(nodeId)}
                separateIdentityNode={separateIdentityNode}
                showRealtimeNode={mapFeatures?.showRealtime}
                showAnalyticsNode={mapFeatures?.showAnalytics}
                showDrNode={mapFeatures?.showDr}
              />
            ) : null}

            {recommendation.whyReasons && recommendation.whyReasons.length > 0 && (
              <section className={`overflow-hidden rounded-2xl border ${panel}`}>
                <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
                  <h3 className={`text-[13px] ${titleText}`}>Why this stack fits your project</h3>
                  <p className={`mt-1 text-xs ${muted}`}>Grounded in your brief, build-question answers, and the topology choice above.</p>
                </div>
                <ul className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                  {recommendation.whyReasons.slice(0, 6).map(reason => (
                    <li key={reason} className={`flex gap-2.5 rounded-xl border p-3.5 ${inner}`}>
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
