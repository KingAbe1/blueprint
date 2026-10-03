export type Theme = 'dark' | 'light';

export type PhaseTab = 'domain-intent' | 'invariants' | 'state-machine' | 'tdd-spec' | 'in-flight' | 'post-flight';

export interface DomainEntity {
  id: string;
  name: string;
  description: string;
}

export interface FrameworkRecommendation {
  id: string;
  name: string;
  category: 'Full-Stack Web' | 'Frontend SPA' | 'Desktop App' | 'Backend API' | 'Mobile App';
  description: string;
  whyReasons: string[];
  bestFor: string;
  isRecommended?: boolean;
}

export interface ProjectSpec {
  description: string;
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
