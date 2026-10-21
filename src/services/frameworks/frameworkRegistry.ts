import { FrameworkAnalyzer, FrameworkProfile } from '../../types/framework';
import { expoAnalyzer } from './expo/expoAnalyzer';
import { nextJsAnalyzer } from './nextjs/nextJsAnalyzer';
import { nodeJsAnalyzer } from './nodejs/nodeJsAnalyzer';
import { remixAnalyzer } from './remix/remixAnalyzer';

// Extensible registry of framework analyzers.
// Order matters: first match wins (Next.js → Remix → Expo → Node.js).
const FRAMEWORK_ANALYZERS: FrameworkAnalyzer[] = [
  nextJsAnalyzer as FrameworkAnalyzer,
  remixAnalyzer as FrameworkAnalyzer,
  expoAnalyzer as FrameworkAnalyzer,
  nodeJsAnalyzer as FrameworkAnalyzer,
];

/**
 * Register an additional framework analyzer at runtime.
 */
export function registerFrameworkAnalyzer(analyzer: FrameworkAnalyzer): void {
  const existingIndex = FRAMEWORK_ANALYZERS.findIndex(a => a.id === analyzer.id);
  if (existingIndex >= 0) {
    FRAMEWORK_ANALYZERS[existingIndex] = analyzer;
  } else {
    FRAMEWORK_ANALYZERS.push(analyzer);
  }
}

/**
 * Evaluates the codebase and runs the first matching specialized framework analyzer.
 */
export function detectAndAnalyzeFramework(source: {
  paths: string[];
  manifests: Record<string, string>;
  sourceContents?: Record<string, string>;
}): FrameworkProfile | undefined {
  for (const analyzer of FRAMEWORK_ANALYZERS) {
    if (analyzer.detect(source)) {
      try {
        return analyzer.analyze(source);
      } catch (err) {
        console.warn(`[FrameworkAnalyzer] Failed analyzing framework "${analyzer.name}":`, err);
      }
    }
  }
  return undefined;
}
