export type Theme = 'dark' | 'light';

export type PhaseTab = 'domain-intent' | 'invariants' | 'state-machine' | 'tdd-spec' | 'in-flight' | 'post-flight';

export type ArchitecturePreference = string;
export type StylingPreference = string;
export type BackendPreference = string;

export interface DomainEntity {
  id: string;
  name: string;
  description: string;
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
  description: string;
  whyReasons: string[];
  bestFor: string;
  isRecommended?: boolean;
}

export interface ProjectSpec {
  description: string;
  architecturePreference?: ArchitecturePreference;
  stylingPreference?: StylingPreference;
  backendPreference?: BackendPreference;
  targetFramework?: string;
  frameworkRecommendation?: FrameworkRecommendation;
  frameworkRecommendations?: FrameworkRecommendation[];
  coreEntities?: DomainEntity[];
  criticalWorkflows?: string[];
  nonNegotiables?: string[];
}

export interface Project {
  id: string;
  name: string;
  spec: ProjectSpec;
  createdAt: number;
  updatedAt: number;
}

