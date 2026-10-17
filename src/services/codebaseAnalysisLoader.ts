import type { CodebaseAnalysis, DependencyRiskAssessment } from '../types/codebase';

/** Loads the heavy codebase analysis module on demand (keeps TypeScript off the greenfield path). */
async function loadCodebaseAnalysisService() {
  return import('./codebaseAnalysisService');
}

export async function chooseAndAnalyzeCodebase(): Promise<CodebaseAnalysis | null> {
  const mod = await loadCodebaseAnalysisService();
  return mod.chooseAndAnalyzeCodebase();
}

export async function reanalyzeCodebase(
  analysis: CodebaseAnalysis,
): Promise<CodebaseAnalysis | null> {
  const mod = await loadCodebaseAnalysisService();
  return mod.reanalyzeCodebase(analysis);
}

export async function ensureAnalysisDependencyAudit(
  analysis: CodebaseAnalysis,
): Promise<CodebaseAnalysis> {
  const mod = await loadCodebaseAnalysisService();
  return mod.ensureAnalysisDependencyAudit(analysis);
}

export async function recalculateQualityWithDependencyRisk(
  analysis: CodebaseAnalysis,
  dependencyRisk: DependencyRiskAssessment,
): Promise<CodebaseAnalysis> {
  const mod = await loadCodebaseAnalysisService();
  return mod.recalculateQualityWithDependencyRisk(analysis, dependencyRisk);
}
