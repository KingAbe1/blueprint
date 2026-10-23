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

/** Map build-question categories to architecture map node ids (for “show on map”). */
export const CATEGORY_MAP_NODE: Partial<Record<ArchitectureQuestion['category'], string>> = {
  product: 'people',
  users: 'people',
  platform: 'experience',
  ui: 'experience',
  frontend: 'experience',
  access: 'access',
  security: 'access',
  topology: 'services',
  backend: 'services',
  api: 'services',
  approach: 'services',
  scale: 'services',
  compliance: 'services',
  data: 'data',
  realtime: 'realtime',
  integrations: 'integrations',
  deployment: 'delivery',
  delivery: 'delivery',
  budget: 'delivery',
  testing: 'operations',
  observability: 'operations',
  reliability: 'operations',
  operations: 'operations',
};

/**
 * Show Identity & access as its own map node only when answers imply a dedicated
 * or managed identity boundary. Self-managed / in-app auth folds into Application.
 */
export function shouldShowSeparateIdentityNode(
  accessAndSecurityText: string,
  allDecisionText = '',
): boolean {
  const blob = `${accessAndSecurityText} ${allDecisionText}`.toLowerCase();
  if (!blob.trim()) return false;

  if (/no (sign[- ]?in|login|accounts?)|public only|anonymous only|without (accounts?|sign[- ]?in|login)|open to everyone/.test(blob)) {
    return false;
  }

  if (
    /manage (auth|identity|sign[- ]?in|it) (my|our)sel|build(ing)? (our |my |the )?(own|in[- ]house)|in[- ]app (auth|sign[- ]?in)|part of the (app|backend|product|monolith)|same (app|backend|codebase)|roll our own|handle (auth|sign[- ]?in) (ourselves|in[- ]house|inside)|simple (email|password) (in|inside)|auth (lives|stays) in/.test(blob)
  ) {
    return false;
  }

  if (
    /\bsso\b|single sign[- ]?on|auth0|clerk\.|clerk |firebase auth|cognito|okta|workos|supabase auth|identity provider|\bidp\b|managed (auth|identity)|separate (identity|auth)|third[- ]party (auth|identity|idp)|external (auth|identity)|dedicated (auth|identity)|saml|oidc|open ?id|enterprise directory|active directory/.test(blob)
  ) {
    return true;
  }

  // Vague “no preference” → keep the map simple; auth lives with the application.
  if (/no preference|let blueprint decide|not sure|no strong preference/.test(accessAndSecurityText.toLowerCase())) {
    return false;
  }

  // A concrete access policy without naming a separate IdP still deserves a node
  // when roles, invites, or org boundaries are the focus of the answer.
  if (accessAndSecurityText.trim() && /roles?|permissions?|rbac|invit|organization|tenant|admin access|who can/.test(accessAndSecurityText.toLowerCase())) {
    return true;
  }

  return false;
}

export function mapNodeIdForCategory(
  category: ArchitectureQuestion['category'],
  options?: {
    separateIdentity?: boolean;
    showRealtime?: boolean;
    showAnalytics?: boolean;
    showDr?: boolean;
  },
): string | undefined {
  if ((category === 'access' || category === 'security') && options?.separateIdentity === false) {
    return 'services';
  }
  if (category === 'realtime' && options?.showRealtime === false) {
    return 'services';
  }
  if (category === 'observability' && options?.showAnalytics) {
    return 'analytics';
  }
  if (category === 'reliability' && options?.showDr) {
    return 'dr';
  }
  return CATEGORY_MAP_NODE[category];
}

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

export function parseStoredOptionIds(optionId?: string): string[] {
  if (!optionId?.trim()) return [];
  return optionId.split(',').map(id => id.trim()).filter(Boolean);
}

export function isExclusivePreferenceLabel(label: string): boolean {
  return /let blueprint decide|no preference|not sure|either is fine|doesn't matter/i.test(label);
}
