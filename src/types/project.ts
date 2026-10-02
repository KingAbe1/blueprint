export type Theme = 'dark' | 'light';

export type PhaseTab = 'pre-flight' | 'in-flight' | 'post-flight';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}
