import { FrameworkRecommendation } from '../types/project';

/** Handoff adds Next.js-specific docs only when the selected greenfield stack is Next.js. */
export function isNextJsGreenfieldStack(recommendation?: FrameworkRecommendation): boolean {
  if (!recommendation) return false;
  const haystack = `${recommendation.id} ${recommendation.name} ${recommendation.frontendStack || ''}`.toLowerCase();
  return recommendation.id === 'nextjs' || recommendation.id.startsWith('nextjs-') || /\bnext\.?js\b/.test(haystack);
}
