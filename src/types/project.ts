export type Theme = 'dark' | 'light';

export type PhaseTab = 'domain-intent' | 'invariants' | 'state-machine' | 'tdd-spec' | 'in-flight' | 'post-flight';

export interface DomainEntity {
  id: string;
  name: string;
  description: string;
}

export interface ProjectSpec {
  description: string;
  coreEntities: DomainEntity[];
  criticalWorkflows: string[];
  nonNegotiables: string[];
}

export interface Project {
  id: string;
  name: string;
  spec: ProjectSpec;
  createdAt: number;
  updatedAt: number;
}
