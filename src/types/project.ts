import { CodebaseAnalysis } from './codebase';

export type Theme = 'dark' | 'light';

export type PhaseTab = 'domain-intent' | 'architecture-map' | 'in-flight';

export type ArchitecturePreference = string;
export type StylingPreference = string;
export type BackendPreference = string;
export type ArchitectureTopology = 'modular_monolith' | 'microservices' | 'serverless' | 'event_driven' | 'hybrid';
export type IDETarget = 'cursor' | 'vscode' | 'codex' | 'claude' | 'jetbrains' | 'other';

export interface HandoffFile {
  path: string;
  description: string;
  content: string;
}

export interface HandoffPackage {
  generatedAt: number;
  ide: IDETarget;
  files: HandoffFile[];
}

export interface ArchitectureMapLayout {
  /** Saved node coordinates; unset nodes use the default lane layout. */
  positions?: Record<string, { x: number; y: number }>;
  zoom?: number;
  pan?: { x: number; y: number };
}

export interface FrameworkRecommendation {
  id: string;
  name: string;
  category: string;
  architecture?: string;
  frontendStack?: string;
  backendStack?: string;
  stylingStack?: string;
  databaseStack?: string;
  deploymentTarget?: string;
  topology?: ArchitectureTopology;
  topologyRationale?: string;
  systemModules?: string[];
  description: string;
  whyReasons: string[];
  bestFor: string;
  isRecommended?: boolean;
}

export interface ArchitectureOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface ArchitectureQuestion {
  id: string;
  category:
    | 'product'
    | 'users'
    | 'platform'
    | 'approach'
    | 'ui'
    | 'access'
    | 'frontend'
    | 'topology'
    | 'backend'
    | 'api'
    | 'data'
    | 'realtime'
    | 'integrations'
    | 'security'
    | 'compliance'
    | 'scale'
    | 'reliability'
    | 'deployment'
    | 'delivery'
    | 'testing'
    | 'observability'
    | 'operations'
    | 'budget';
  question: string;
  context?: string;
  options: ArchitectureOption[];
  allowCustom?: boolean;
}

export interface ArchitectureAnswer {
  questionId: string;
  optionId?: string;
  value: string;
  label: string;
}

export interface ArchitectureFact {
  category: ArchitectureQuestion['category'];
  value: string;
  evidence?: string;
  source: 'description' | 'ai';
}

export interface ArchitecturalInterview {
  status: 'idle' | 'in_progress' | 'completed';
  currentQuestionIndex: number;
  totalEstimatedQuestions: number;
  questions: ArchitectureQuestion[];
  answers: ArchitectureAnswer[];
  inferredFacts?: ArchitectureFact[];
  providerName?: string;
  summaryInsights?: string[];
}

export interface ProjectSpec {
  description: string;
  architecturePreference?: ArchitecturePreference;
  stylingPreference?: StylingPreference;
  backendPreference?: BackendPreference;
  targetPlatforms?: string[];
  nfrPreferences?: string[];
  customRequirements?: string;
  interview?: ArchitecturalInterview;
  targetFramework?: string;
  frameworkRecommendation?: FrameworkRecommendation;
  frameworkRecommendations?: FrameworkRecommendation[];
  handoff?: HandoffPackage;
  architectureMapLayout?: ArchitectureMapLayout;
}

export interface Project {
  id: string;
  name: string;
  spec: ProjectSpec;
  codebaseAnalysis?: CodebaseAnalysis;
  createdAt: number;
  updatedAt: number;
}
