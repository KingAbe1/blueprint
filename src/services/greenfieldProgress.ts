import { PhaseTab, Project } from '../types/project';

export type GreenfieldPhaseId = PhaseTab;

export type GreenfieldPhaseState = 'complete' | 'current' | 'upcoming' | 'locked';

export interface GreenfieldPhaseProgress {
  id: GreenfieldPhaseId;
  label: string;
  shortLabel: string;
  state: GreenfieldPhaseState;
}

export function getGreenfieldPhaseProgress(
  project: Project | undefined,
  activeTab: PhaseTab,
): GreenfieldPhaseProgress[] {
  const interview = project?.spec.interview;
  const recommendation = project?.spec.frameworkRecommendation || project?.spec.frameworkRecommendations?.[0];
  const questionsComplete = interview?.status === 'completed';
  const mapReady = questionsComplete && Boolean(recommendation);
  const handoffReady = mapReady;

  const blueprintDone = questionsComplete;
  const mapDone = mapReady;

  const phases: Array<{ id: PhaseTab; label: string; shortLabel: string; done: boolean; locked?: boolean }> = [
    { id: 'domain-intent', label: 'Product blueprint', shortLabel: 'brief', done: blueprintDone },
    {
      id: 'architecture-map',
      label: 'Architecture map',
      shortLabel: 'Map',
      done: mapDone,
      locked: !questionsComplete && !mapReady,
    },
    {
      id: 'in-flight',
      label: 'Build handoff',
      shortLabel: 'Handoff',
      done: false,
      locked: !handoffReady,
    },
  ];

  return phases.map(phase => {
    let state: GreenfieldPhaseState = 'upcoming';
    if (phase.locked) state = 'locked';
    else if (phase.id === activeTab) state = 'current';
    else if (phase.done) state = 'complete';
    return { id: phase.id, label: phase.label, shortLabel: phase.shortLabel, state };
  });
}

/** Short status line for home / recent project rows. */
export function getBlueprintHubStatus(project: Project): string {
  const interview = project.spec.interview;
  const recommendation = project.spec.frameworkRecommendation || project.spec.frameworkRecommendations?.[0];
  const handoff = project.spec.handoff;

  if (handoff?.files?.length) {
    return 'Handoff package ready';
  }
  if (interview?.status === 'completed' && recommendation) {
    return 'Architecture map ready';
  }
  if (interview?.status === 'in_progress') {
    const total = interview.questions.length;
    const index = Math.min(interview.currentQuestionIndex + 1, total);
    return total > 0 ? `Build questions · ${index}/${total}` : 'Build questions in progress';
  }
  if (interview?.status === 'completed' && !recommendation) {
    return 'Generating architecture…';
  }
  const words = project.spec.description?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  if (words >= 5) {
    return 'Product brief started';
  }
  return 'New · start product brief';
}
