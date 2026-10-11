import { FrameworkAnalyzer, FrameworkProfile } from '../../types/framework';
import { nextJsAnalyzer } from './nextjs/nextJsAnalyzer';

// Extensible registry of framework analyzers.
// To add support for a new framework (e.g. Remix, Vite/React, Express, FastAPI, NestJS, Go Fiber),
// simply implement FrameworkAnalyzer<T> and add it to this array.
const FRAMEWORK_ANALYZERS: FrameworkAnalyzer[] = [
  nextJsAnalyzer as FrameworkAnalyzer,
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
