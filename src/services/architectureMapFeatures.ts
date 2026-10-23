import { ArchitectureQuestion, ArchitectureTopology, FrameworkRecommendation } from '../types/project';

export interface ArchitectureDecision {
  category: ArchitectureQuestion['category'];
  value: string;
}

export interface MapFeatureCopy {
  label: string;
  detail: string;
}

export interface ArchitectureMapFeatures {
  showOperators: boolean;
  showSearch: boolean;
  showObjectStore: boolean;
  showRealtime: boolean;
  showSecrets: boolean;
  showAnalytics: boolean;
  showPayments: boolean;
  showDr: boolean;
  /** Domain modules rendered as first-class nodes (capped). */
  modules: string[];
  operators: MapFeatureCopy;
  search: MapFeatureCopy;
  objectStore: MapFeatureCopy;
  realtime: MapFeatureCopy;
  secrets: MapFeatureCopy;
  analytics: MapFeatureCopy;
  payments: MapFeatureCopy;
  dr: MapFeatureCopy;
  /** Integrations label with payment vendors removed when payments has its own node. */
  integrationsLabel: string;
  showIntegrations: boolean;
}

export const MODULE_NODE_PREFIX = 'module:';
export const MAX_MODULE_NODES_SIMPLE = 4;
export const MAX_MODULE_NODES_DETAILED = 5;

export function moduleNodeId(index: number): string {
  return `${MODULE_NODE_PREFIX}${index}`;
}

export function isModuleNodeId(id: string): boolean {
  return id.startsWith(MODULE_NODE_PREFIX);
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

export function decisionBlob(decisions: ArchitectureDecision[]): string {
  return decisions.map(decision => decision.value).join(' ').toLowerCase();
}

export function valueForDecisions(
  decisions: ArchitectureDecision[],
  ...categories: ArchitectureQuestion['category'][]
): string {
  return uniqueValues(
    decisions.filter(decision => categories.includes(decision.category)).map(decision => decision.value),
  ).join(' · ');
}

function stackBlob(recommendation: FrameworkRecommendation): string {
  return [
    recommendation.name,
    recommendation.frontendStack,
    recommendation.backendStack,
    recommendation.databaseStack,
    recommendation.deploymentTarget,
    recommendation.category,
    ...(recommendation.systemModules || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isDismissed(value: string): boolean {
  return /no required|none|not needed|out of scope|no preference|let blueprint decide|no external|n\/a|not applicable/i.test(value);
}

export function integrationsAreInScope(decisions: ArchitectureDecision[]): boolean {
  const value = valueForDecisions(decisions, 'integrations', 'api');
  if (!value) return false;
  return !isDismissed(value);
}

const PAYMENT_PATTERN = /\b(stripe|paypal|braintree|adyen|square|billing|subscription|checkout|payment|in[- ]app purchase|iap|revenuecat)\b/i;

export function paymentsAreInScope(
  decisions: ArchitectureDecision[],
  recommendation: FrameworkRecommendation,
  modules: string[],
): boolean {
  const blob = `${decisionBlob(decisions)} ${stackBlob(recommendation)} ${modules.join(' ')}`;
  return PAYMENT_PATTERN.test(blob);
}

function stripPaymentPhrases(value: string): string {
  return value
    .split(/\s*·\s*|\s*,\s*|\s*;\s*/)
    .map(part => part.trim())
    .filter(part => part && !PAYMENT_PATTERN.test(part))
    .join(' · ');
}

function fallbackModules(decisions: ArchitectureDecision[]): string[] {
  const text = decisionBlob(decisions);
  if (/fleet|vehicle|dispatch|driver/.test(text)) {
    return ['Fleet & assets', 'Live tracking', 'Dispatch', 'Drivers & attendance', 'Maintenance', 'Reporting'];
  }
  if (/catalog|cart|checkout|order|inventory|payment|store/.test(text)) {
    return ['Accounts & access', 'Catalog', 'Cart & checkout', 'Orders & inventory', 'Payments', 'Notifications'];
  }
  if (/fitness|workout|gym|trainer|coach/.test(text)) {
    return ['Accounts & access', 'Workouts', 'Progress tracking', 'Coaching', 'Notifications', 'Billing'];
  }
  return ['Accounts & access', 'Core product', 'Notifications', 'Administration'];
}

export function resolveSystemModules(
  recommendation: FrameworkRecommendation,
  decisions: ArchitectureDecision[],
): string[] {
  if (recommendation.systemModules?.length) return recommendation.systemModules.slice(0, 8);
  return fallbackModules(decisions);
}

export function resolveArchitectureMapFeatures(
  recommendation: FrameworkRecommendation,
  topology: ArchitectureTopology,
  decisions: ArchitectureDecision[],
  detailed: boolean,
): ArchitectureMapFeatures {
  const all = decisionBlob(decisions);
  const stack = stackBlob(recommendation);
  const blob = `${all} ${stack}`;
  const users = valueForDecisions(decisions, 'users');
  const realtimeAnswer = valueForDecisions(decisions, 'realtime');
  const reliability = valueForDecisions(decisions, 'reliability');
  const observability = valueForDecisions(decisions, 'observability');
  const security = valueForDecisions(decisions, 'security', 'compliance');
  const integrationsRaw = valueForDecisions(decisions, 'integrations', 'api');
  const modulesAll = resolveSystemModules(recommendation, decisions);
  const moduleCap = detailed ? MAX_MODULE_NODES_DETAILED : MAX_MODULE_NODES_SIMPLE;
  const modules = modulesAll.slice(0, moduleCap);

  const showOperators = /admin|operator|staff|support|coach|trainer|dispatcher|internal team|back[- ]?office|moderator|manager role|operations team/.test(
    `${users} ${blob}`,
  );

  const showSearch = /\b(search|elasticsearch|algolia|meilisearch|opensearch|autocomplete|full[- ]?text|\brag\b|vector|embedding|llm|ai assistant|recommendation engine|semantic)\b/.test(blob);

  const showObjectStore = /\b(image|photo|video|media|upload|attachment|file storage|object storage|s3|blob|cdn assets|progress photo|recording)\b/.test(blob)
    || /fitness|social|marketplace|content/.test(blob);

  const showRealtime = !isDismissed(realtimeAnswer)
    && (
      /\b(realtime|real[- ]time|live|websocket|presence|sync|collaborat|offline[- ]first|firestore listener|pusher|ably)\b/.test(
        `${realtimeAnswer} ${blob}`,
      )
      || topology === 'event_driven'
    );

  // Secrets: always in detailed; also when security answers imply managed secrets.
  const showSecrets = detailed
    || /\b(secret|vault|env(?:ironment)? var|credential|api key|kms|parameter store)\b/.test(`${security} ${blob}`);

  const showAnalytics = detailed
    || /\b(analytics|telemetry|product analytics|funnel|amplitude|mixpanel|posthog|segment|bigquery|event tracking|usage metrics)\b/.test(
      `${observability} ${blob}`,
    );

  const showPayments = paymentsAreInScope(decisions, recommendation, modulesAll);

  const showDr = /\b(multi[- ]?region|disaster|failover|geo(?:graphic)? redund|warm standby|hot standby|rpo|rto|cross[- ]region|active[- ]active)\b/.test(
    `${reliability} ${blob}`,
  ) || (detailed && /\b(high availability|ha\b|cannot go down|zero downtime|business critical)\b/.test(`${reliability} ${blob}`));

  const integrationsClean = showPayments ? stripPaymentPhrases(integrationsRaw) : integrationsRaw;
  const showIntegrations = Boolean(integrationsClean) && !isDismissed(integrationsClean);

  const operators: MapFeatureCopy = {
    label: users && /admin|coach|staff|operator|support|trainer/i.test(users)
      ? users.split(/\s*·\s*/).filter(part => /admin|coach|staff|operator|support|trainer|internal/i.test(part)).join(' · ') || 'Admins & operators'
      : 'Admins & operators',
    detail: 'Internal or privileged roles that configure the product, support users, or run day-to-day operations.',
  };

  const search: MapFeatureCopy = /\b(rag|vector|embedding|llm|ai assistant)\b/.test(blob)
    ? {
      label: 'Search & AI retrieval',
      detail: 'Indexes product content and optional embeddings so users can search or ask grounded questions over their data.',
    }
    : {
      label: 'Search index',
      detail: 'Full-text or faceted search so catalogs, history, and content stay findable as the dataset grows.',
    };

  const objectStore: MapFeatureCopy = {
    label: 'Files & media storage',
    detail: 'Object storage for uploads, images, video, and other large binaries kept outside the primary database.',
  };

  const realtime: MapFeatureCopy = {
    label: 'Realtime channel',
    detail: 'Live updates, presence, or offline sync so clients stay current without waiting for a full page refresh.',
  };

  const secrets: MapFeatureCopy = {
    label: 'Secrets & config',
    detail: 'Environment-specific configuration and credentials kept out of source control (vault, secret manager, or env stores).',
  };

  const analytics: MapFeatureCopy = {
    label: 'Product analytics',
    detail: 'Product usage and funnel telemetry used to understand behavior — separate from uptime monitoring.',
  };

  const payments: MapFeatureCopy = {
    label: showPayments && PAYMENT_PATTERN.test(integrationsRaw)
      ? (integrationsRaw.split(/\s*·\s*|\s*,\s*/).find(part => PAYMENT_PATTERN.test(part)) || 'Payments & billing')
      : 'Payments & billing',
    detail: 'Checkout, subscriptions, and revenue events — isolated so card data and provider webhooks stay tightly scoped.',
  };

  const dr: MapFeatureCopy = {
    label: 'Multi-region & recovery',
    detail: 'Geographic redundancy, backups, and failover so a regional outage does not take the whole product offline.',
  };

  return {
    showOperators,
    showSearch,
    showObjectStore: showObjectStore && (detailed || /upload|media|photo|video|file/.test(blob)),
    showRealtime,
    showSecrets,
    showAnalytics,
    showPayments,
    showDr,
    modules,
    operators,
    search,
    objectStore,
    realtime,
    secrets,
    analytics,
    payments,
    dr,
    integrationsLabel: integrationsClean || 'External services',
    showIntegrations,
  };
}
