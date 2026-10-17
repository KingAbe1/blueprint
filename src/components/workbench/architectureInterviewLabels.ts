import { ArchitectureQuestion } from '../../types/project';

export const CATEGORY_LABELS: Record<ArchitectureQuestion['category'], string> = {
  product: 'Product scope',
  users: 'Users & workflows',
  platform: 'Target platform',
  approach: 'Decision defaults',
  ui: 'User experience',
  access: 'Sign-in & access',
  frontend: 'App screens',
  topology: 'System shape',
  backend: 'Behind the scenes',
  api: 'Connections',
  data: 'Data & storage',
  realtime: 'Realtime & offline',
  integrations: 'Integrations',
  security: 'Security & privacy',
  compliance: 'Compliance',
  scale: 'Expected usage',
  reliability: 'Backups & recovery',
  deployment: 'Hosting & deployment',
  delivery: 'Releasing updates',
  testing: 'Quality checks',
  observability: 'Monitoring & alerts',
  operations: 'Team ownership',
  budget: 'Cost constraints',
};

export const DECISION_GROUPS: Array<{
  title: string;
  description: string;
  categories: ArchitectureQuestion['category'][];
}> = [
  {
    title: 'Foundation',
    description: 'Scope, users, platform, and decision principles',
    categories: ['product', 'users', 'platform', 'approach'],
  },
  {
    title: 'Experience & access',
    description: 'Interface, identity, and client technology',
    categories: ['ui', 'access', 'frontend'],
  },
  {
    title: 'Services & data',
    description: 'Backend, APIs, storage, sync, and integrations',
    categories: ['topology', 'backend', 'api', 'data', 'realtime', 'integrations'],
  },
  {
    title: 'Trust & scale',
    description: 'Security, compliance, performance, and recovery',
    categories: ['security', 'compliance', 'scale', 'reliability'],
  },
  {
    title: 'Delivery & operations',
    description: 'Hosting, releases, quality, monitoring, and cost',
    categories: ['deployment', 'delivery', 'testing', 'observability', 'operations', 'budget'],
  },
];
