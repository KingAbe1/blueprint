import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  BarChart3,
  CloudCog,
  CreditCard,
  Database,
  FolderOpen,
  Globe,
  HardDrive,
  KeyRound,
  Maximize2,
  Minimize2,
  Minus,
  MonitorSmartphone,
  Move,
  Plus,
  PlugZap,
  Radio,
  RotateCcw,
  Route,
  Search,
  ServerCog,
  ShieldCheck,
  UserCog,
  UserRound,
  Wifi,
  Download,
  ImageDown,
  Boxes,
} from 'lucide-react';
import { exportArchitectureMapFile } from '../../services/architectureMapExport';
import { useNotification } from '../../context/NotificationContext';
import {
  ArchitectureMapDetailLevel,
  ArchitectureMapLayout,
  ArchitectureQuestion,
  ArchitectureTopology,
  FrameworkRecommendation,
} from '../../types/project';
import {
  ArchitectureDecision,
  decisionBlob,
  moduleNodeId,
  resolveArchitectureMapFeatures,
} from '../../services/architectureMapFeatures';
import { shouldShowSeparateIdentityNode } from './architectureInterviewLabels';
import { workbenchTheme } from './workbenchUi';

interface ArchitectureMapProps {
  projectId: string;
  recommendation: FrameworkRecommendation;
  decisions: ArchitectureDecision[];
  isDark: boolean;
  exportTitle?: string;
  highlightedNodeId?: string | null;
  onHighlightNode?: (nodeId: string | null) => void;
  persistedLayout?: ArchitectureMapLayout;
  onPersistLayout?: (layout: ArchitectureMapLayout) => void;
}

type Point = { x: number; y: number };
type MapNode = {
  id: string;
  eyebrow: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'violet' | 'emerald' | 'amber';
  hidden?: boolean;
};

type GraphEdge = {
  from: string;
  to: string;
  label: string;
  dashed?: boolean;
};

const NODE_WIDTH = 192;
const LANE_HORIZONTAL_GAP = 32;
const CANVAS_PADDING_X = 16;
const NODE_HEIGHT = 96;
const LANE_HEADER_HEIGHT = 36;
const LANE_NODE_GAP = 20;
/** Primary path sits just under the lane header band (no large empty band above nodes). */
const PRIMARY_ROW_Y = LANE_HEADER_HEIGHT + 20;
const DEFAULT_MAP_ZOOM = 1;

function canvasHeightFor(maxLaneNodes: number): number {
  const stack = Math.max(1, maxLaneNodes);
  return PRIMARY_ROW_Y + NODE_HEIGHT + (stack - 1) * (NODE_HEIGHT + LANE_NODE_GAP) + 28;
}

const PRIMARY_PATH_NODES = new Set(['people', 'experience', 'services', 'data']);

function buildLaneNodeOrder(moduleCount: number): Record<number, string[]> {
  const moduleIds = Array.from({ length: moduleCount }, (_, index) => moduleNodeId(index));
  return {
    0: ['people', 'operators'],
    1: ['experience', 'access', 'edge'],
    2: ['services', 'gateway', ...moduleIds, 'messaging', 'realtime', 'delivery'],
    3: ['data', 'cache', 'objectStore', 'search', 'integrations', 'payments', 'secrets', 'analytics', 'operations', 'dr'],
  };
}

const BASE_EDGES: GraphEdge[] = [
  { from: 'people', to: 'experience', label: 'uses' },
  { from: 'operators', to: 'experience', label: 'operates' },
  { from: 'experience', to: 'services', label: 'requests' },
  { from: 'experience', to: 'edge', label: 'loads' },
  { from: 'edge', to: 'experience', label: 'accelerates', dashed: true },
  { from: 'access', to: 'experience', label: 'signs in' },
  { from: 'access', to: 'services', label: 'authorizes' },
  { from: 'access', to: 'gateway', label: 'authorizes' },
  { from: 'experience', to: 'gateway', label: 'requests' },
  { from: 'gateway', to: 'services', label: 'routes' },
  { from: 'services', to: 'data', label: 'stores' },
  { from: 'services', to: 'cache', label: 'caches' },
  { from: 'cache', to: 'data', label: 'backs', dashed: true },
  { from: 'services', to: 'messaging', label: 'publishes' },
  { from: 'messaging', to: 'services', label: 'triggers', dashed: true },
  { from: 'services', to: 'realtime', label: 'streams' },
  { from: 'realtime', to: 'experience', label: 'pushes', dashed: true },
  { from: 'services', to: 'integrations', label: 'connects' },
  { from: 'services', to: 'payments', label: 'charges' },
  { from: 'payments', to: 'services', label: 'webhooks', dashed: true },
  { from: 'services', to: 'objectStore', label: 'stores files' },
  { from: 'services', to: 'search', label: 'indexes' },
  { from: 'experience', to: 'search', label: 'queries', dashed: true },
  { from: 'services', to: 'secrets', label: 'reads', dashed: true },
  { from: 'services', to: 'analytics', label: 'emits' },
  { from: 'services', to: 'operations', label: 'health' },
  { from: 'data', to: 'dr', label: 'replicates', dashed: true },
  { from: 'operations', to: 'dr', label: 'failovers', dashed: true },
  { from: 'delivery', to: 'experience', label: 'releases', dashed: true },
  { from: 'delivery', to: 'services', label: 'deploys', dashed: true },
  { from: 'delivery', to: 'edge', label: 'publishes', dashed: true },
];

function buildGraphEdges(moduleCount: number): GraphEdge[] {
  const moduleEdges: GraphEdge[] = [];
  for (let index = 0; index < moduleCount; index += 1) {
    const id = moduleNodeId(index);
    moduleEdges.push({ from: 'services', to: id, label: 'owns' });
    moduleEdges.push({ from: id, to: 'data', label: 'reads/writes' });
    if (index === 0) {
      moduleEdges.push({ from: id, to: 'integrations', label: 'uses', dashed: true });
    }
  }
  return [...BASE_EDGES, ...moduleEdges];
}

const PRIMARY_FLOW: Array<[string, string]> = [
  ['people', 'experience'],
  ['experience', 'services'],
  ['services', 'data'],
];

const LANE_SPECS = [
  { width: 252, label: 'People' },
  { width: 264, label: 'Experience' },
  { width: 300, label: 'Application' },
  { width: 268, label: 'Platform' },
] as const;

const FLOW_LANES = LANE_SPECS.reduce<Array<{ x: number; width: number; label: string }>>((lanes, spec, index) => {
  const x = index === 0
    ? CANVAS_PADDING_X
    : lanes[index - 1].x + lanes[index - 1].width + LANE_HORIZONTAL_GAP;
  lanes.push({ x, width: spec.width, label: spec.label });
  return lanes;
}, []);

const CANVAS_WIDTH = FLOW_LANES[FLOW_LANES.length - 1].x + FLOW_LANES[FLOW_LANES.length - 1].width + CANVAS_PADDING_X;

const toneStyles = {
  blue: {
    icon: 'bg-blue-500/10 text-blue-500',
    border: 'border-blue-500/40',
    glow: 'shadow-[0_0_0_1px_rgba(59,130,246,0.15)]',
  },
  violet: {
    icon: 'bg-slate-500/10 text-slate-500',
    border: 'border-slate-400/35',
    glow: 'shadow-[0_0_0_1px_rgba(148,163,184,0.12)]',
  },
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-600',
    border: 'border-emerald-500/35',
    glow: 'shadow-[0_0_0_1px_rgba(16,185,129,0.12)]',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-600',
    border: 'border-amber-500/35',
    glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.12)]',
  },
} as const;

const topologyMeta: Record<ArchitectureTopology, { label: string; description: string }> = {
  modular_monolith: {
    label: 'Modular monolith',
    description: 'One deployable application with clear internal product modules. It keeps delivery simple while preserving boundaries for future growth.',
  },
  microservices: {
    label: 'Independent microservices',
    description: 'Separately deployed services allow product areas to be owned, released, scaled, and recovered independently.',
  },
  serverless: {
    label: 'Managed serverless functions',
    description: 'Small managed functions run on demand, reducing infrastructure work and scaling uneven workloads independently.',
  },
  event_driven: {
    label: 'Event-driven system',
    description: 'Product areas communicate through events so background workflows can continue reliably without blocking the user.',
  },
  hybrid: {
    label: 'Hybrid core and services',
    description: 'One coordinated core handles most work while selected high-risk or high-scale capabilities remain independently deployable.',
  },
};

function recommendationTopology(recommendation: FrameworkRecommendation): ArchitectureTopology {
  if (recommendation.topology) return recommendation.topology;
  const value = `${recommendation.architecture || ''} ${recommendation.category || ''}`.toLowerCase();
  if (/microservice/.test(value)) return 'microservices';
  if (/serverless/.test(value)) return 'serverless';
  if (/event[- ]driven/.test(value)) return 'event_driven';
  if (/hybrid/.test(value)) return 'hybrid';
  return 'modular_monolith';
}

function stackBlob(recommendation: FrameworkRecommendation): string {
  return [
    recommendation.name,
    recommendation.frontendStack,
    recommendation.backendStack,
    recommendation.databaseStack,
    recommendation.deploymentTarget,
    recommendation.category,
  ].filter(Boolean).join(' ').toLowerCase();
}

function isCliOnlyProduct(decisions: ArchitectureDecision[]): boolean {
  return /\bcli\b|command[- ]line|terminal only/.test(decisionBlob(decisions))
    && !/\bweb\b|mobile|ios|android|desktop|browser/.test(decisionBlob(decisions));
}

/** Which infra nodes belong on the detailed map for this stack and topology. */
function resolveDetailedInfra(
  recommendation: FrameworkRecommendation,
  topology: ArchitectureTopology,
  decisions: ArchitectureDecision[],
): {
  showEdge: boolean;
  showCache: boolean;
  showMessaging: boolean;
  showGateway: boolean;
  edge: { label: string; detail: string };
  cache: { label: string; detail: string };
  messaging: { label: string; detail: string };
  gateway: { label: string; detail: string };
} {
  const stack = stackBlob(recommendation);
  const answers = decisionBlob(decisions);
  const isFirebase = /firebase|firestore/.test(stack);
  const isSupabase = /supabase/.test(stack);
  const wantsRealtime = /realtime|live|sync|push|offline|websocket|instant/.test(`${answers} ${stack}`);
  const scaleHeavy = /10×|10x|thousands|millions|high traffic|scale|fast under load|doubling/.test(answers);
  const showGateway = topology === 'microservices' || topology === 'hybrid'
    || /api gateway|bff|separate.*(api|backend)/.test(`${stack} ${answers}`);
  // Detailed view always surfaces cache, async work, and edge (when not CLI-only).
  const showMessaging = true;
  const showEdge = !isCliOnlyProduct(decisions);
  const showCache = true;

  const edge = /mobile|ios|android|play store|app store|expo|flutter|react native/.test(stack)
    ? {
      label: 'CDN & media edge',
      detail: 'Caches images, static assets, and downloadable content close to users so the app feels fast worldwide.',
    }
    : {
      label: 'CDN & edge delivery',
      detail: 'Serves static assets and often API responses from the edge to cut latency and shield the origin.',
    };

  let cache: { label: string; detail: string };
  if (isFirebase) {
    cache = {
      label: 'Client & query cache',
      detail: 'Firestore persistence and in-memory query caching reduce reads and keep the UI responsive offline or on poor networks. Add Redis only if a custom backend needs shared server-side cache.',
    };
  } else if (isSupabase) {
    cache = {
      label: 'Edge + Redis cache',
      detail: 'Cache hot reads at the edge or in Redis so dashboards and feeds stay fast without hitting Postgres on every request.',
    };
  } else if (/redis/.test(stack)) {
    cache = {
      label: 'Redis cache',
      detail: 'Shared in-memory cache for sessions, rate limits, and hot product reads.',
    };
  } else if (scaleHeavy || wantsRealtime) {
    cache = {
      label: 'Redis / in-memory cache',
      detail: 'Keeps hot reads, sessions, and rate limits out of the primary database so growth and live updates stay snappy.',
    };
  } else {
    cache = {
      label: 'Redis / application cache',
      detail: 'Optional shared cache for sessions, rate limits, and frequently read product data as traffic grows.',
    };
  }

  let messaging: { label: string; detail: string };
  if (isFirebase) {
    messaging = {
      label: 'Push, jobs & events',
      detail: 'FCM push, scheduled Cloud Functions, and event triggers for reminders, sync, and background workflows.',
    };
  } else if (topology === 'event_driven') {
    messaging = {
      label: 'Event bus & queues',
      detail: 'Durable events and workers keep long-running work reliable without blocking the user-facing path.',
    };
  } else {
    messaging = {
      label: 'Queues & background jobs',
      detail: 'Async workers for notifications, imports, billing hooks, and other work that should not block the main request path.',
    };
  }

  const gateway = {
    label: 'API gateway / BFF',
    detail: 'Single entry for clients: auth checks, routing to services, and aggregation so apps do not call every service directly.',
  };

  return {
    showEdge,
    showCache,
    showMessaging,
    showGateway,
    edge,
    cache,
    messaging,
    gateway,
  };
}

function isPrimaryEdge(from: string, to: string): boolean {
  return PRIMARY_FLOW.some(([a, b]) => a === from && b === to);
}

function laneCenterX(laneIndex: number): number {
  const lane = FLOW_LANES[laneIndex];
  return lane.x + (lane.width - NODE_WIDTH) / 2;
}

/** Snap visible nodes into swim lanes; primary path shares one horizontal row. */
function computeLaneLayout(
  visibleIds: Set<string>,
  laneOrder: Record<number, string[]>,
): Record<string, Point> {
  const positions: Record<string, Point> = {};

  for (let laneIndex = 0; laneIndex < FLOW_LANES.length; laneIndex += 1) {
    const ordered = (laneOrder[laneIndex] || []).filter(id => visibleIds.has(id));
    if (ordered.length === 0) continue;

    const x = laneCenterX(laneIndex);
    const anchor = ordered.find(id => PRIMARY_PATH_NODES.has(id));
    const rest = ordered.filter(id => id !== anchor);

    if (anchor) {
      positions[anchor] = { x, y: PRIMARY_ROW_Y };
    }

    rest.forEach((id, index) => {
      const y = anchor
        ? PRIMARY_ROW_Y + (NODE_HEIGHT + LANE_NODE_GAP) * (index + 1)
        : PRIMARY_ROW_Y + (NODE_HEIGHT + LANE_NODE_GAP) * index;
      positions[id] = { x, y };
    });
  }

  return positions;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function edgePath(from: Point, to: Point) {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;

  if (endX > startX + 24) {
    const curve = Math.max(42, (endX - startX) * 0.5);
    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
  }

  const fromCenterX = from.x + NODE_WIDTH / 2;
  const toCenterX = to.x + NODE_WIDTH / 2;
  const flowsDown = to.y > from.y;
  const verticalStartY = flowsDown ? from.y + NODE_HEIGHT : from.y;
  const verticalEndY = flowsDown ? to.y : to.y + NODE_HEIGHT;
  const direction = flowsDown ? 1 : -1;
  const curve = Math.max(42, Math.abs(verticalEndY - verticalStartY) * 0.45);
  return `M ${fromCenterX} ${verticalStartY} C ${fromCenterX} ${verticalStartY + direction * curve}, ${toCenterX} ${verticalEndY - direction * curve}, ${toCenterX} ${verticalEndY}`;
}

function readSavedPositions(persisted?: ArchitectureMapLayout): Record<string, Point> {
  if (persisted?.positions && Object.keys(persisted.positions).length > 0) {
    return { ...persisted.positions };
  }
  return {};
}

/**
 * Use a custom layout only when every visible node has a saved position for this
 * exact set. Otherwise fall back to the lane stack — partial saves from an older,
 * smaller map stack new nodes on top of old ones.
 */
function mergeNodePositions(
  laneLayout: Record<string, Point>,
  saved: Record<string, Point>,
  visibleIds: Set<string>,
): Record<string, Point> {
  const ids = [...visibleIds];
  if (ids.length === 0) return { ...laneLayout };
  const complete = ids.every(id => Boolean(saved[id]));
  if (!complete) return { ...laneLayout };
  return Object.fromEntries(ids.map(id => [id, { ...saved[id] }]));
}

/** Push overlapping nodes in the same lane apart (safety net after restores). */
function separateOverlappingPositions(
  positions: Record<string, Point>,
  laneOrder: Record<number, string[]>,
  visibleIds: Set<string>,
): Record<string, Point> {
  const next = { ...positions };
  const minGap = NODE_HEIGHT + LANE_NODE_GAP;

  for (let laneIndex = 0; laneIndex < FLOW_LANES.length; laneIndex += 1) {
    const ordered = (laneOrder[laneIndex] || []).filter(id => visibleIds.has(id) && next[id]);
    if (ordered.length < 2) continue;

    ordered.sort((a, b) => next[a].y - next[b].y);
    for (let index = 1; index < ordered.length; index += 1) {
      const prev = ordered[index - 1];
      const current = ordered[index];
      const minY = next[prev].y + minGap;
      if (next[current].y < minY) {
        next[current] = { x: next[current].x, y: minY };
      }
    }
  }

  return next;
}

function seedLayoutState(persisted?: ArchitectureMapLayout): {
  nodePositions: Record<string, Point>;
  zoom: number;
  pan: Point;
  detailLevel: ArchitectureMapDetailLevel;
} {
  return {
    nodePositions: readSavedPositions(persisted),
    zoom: persisted?.zoom ?? DEFAULT_MAP_ZOOM,
    pan: persisted?.pan ? { ...persisted.pan } : { x: 0, y: 0 },
    detailLevel: persisted?.detailLevel === 'detailed' ? 'detailed' : 'simple',
  };
}

export const ArchitectureMap: React.FC<ArchitectureMapProps> = ({
  projectId,
  recommendation,
  decisions,
  isDark,
  exportTitle = 'Architecture map',
  highlightedNodeId,
  onHighlightNode,
  persistedLayout,
  onPersistLayout,
}) => {
  const { notify } = useNotification();
  const topology = recommendationTopology(recommendation);
  const selectedTopology = topologyMeta[topology];
  const [detailLevel, setDetailLevel] = useState<ArchitectureMapDetailLevel>(
    () => seedLayoutState(persistedLayout).detailLevel,
  );
  const detailLevelRef = useRef(detailLevel);
  const detailed = detailLevel === 'detailed';

  const valueFor = (...categories: ArchitectureQuestion['category'][]) => {
    const matches = uniqueValues(
      decisions.filter(decision => categories.includes(decision.category)).map(decision => decision.value),
    );
    return matches.join(' · ');
  };

  const features = useMemo(
    () => resolveArchitectureMapFeatures(recommendation, topology, decisions, detailed),
    [recommendation, topology, decisions, detailed],
  );
  const accessDecisionText = valueFor('access', 'security');
  const showSeparateIdentity = shouldShowSeparateIdentityNode(
    accessDecisionText,
    decisionBlob(decisions),
  );
  const infra = useMemo(
    () => resolveDetailedInfra(recommendation, topology, decisions),
    [recommendation, topology, decisions],
  );
  const laneOrder = useMemo(
    () => buildLaneNodeOrder(features.modules.length),
    [features.modules.length],
  );
  const graphEdges = useMemo(
    () => buildGraphEdges(features.modules.length),
    [features.modules.length],
  );

  const servicesDetail = (() => {
    const base = recommendation.topologyRationale || selectedTopology.description;
    if (showSeparateIdentity || !accessDecisionText) return base;
    if (/no (sign[- ]?in|login|accounts?)|public only|anonymous only/i.test(accessDecisionText)) {
      return `${base} Sign-in is not a separate system for this product.`;
    }
    return `${base} Sign-in and access are handled inside the application (not a separate identity service).`;
  })();

  const operationsLabel = (() => {
    if (features.showDr && features.showAnalytics) {
      return valueFor('observability') || 'Uptime monitoring';
    }
    if (features.showDr) {
      return valueFor('observability') || 'Monitoring and alerts';
    }
    return valueFor('observability', 'reliability') || 'Monitoring and recovery';
  })();

  const nodes = useMemo<MapNode[]>(() => {
    const moduleNodes: MapNode[] = features.modules.map((moduleName, index) => ({
      id: moduleNodeId(index),
      eyebrow: 'Domain module',
      label: moduleName,
      detail: `Owns the behavior and data for ${moduleName.toLowerCase()}. Talks to other modules through explicit boundaries.`,
      icon: Boxes,
      tone: 'blue' as const,
    }));

    return [
      {
        id: 'people',
        eyebrow: 'People',
        label: valueFor('users') || 'Product users',
        detail: 'The people and roles that enter the product and start its main workflows.',
        icon: UserRound,
        tone: 'blue',
      },
      {
        id: 'operators',
        eyebrow: 'Internal',
        label: features.operators.label,
        detail: features.operators.detail,
        icon: UserCog,
        tone: 'violet',
        hidden: !features.showOperators,
      },
      {
        id: 'experience',
        eyebrow: 'Product experience',
        label: recommendation.frontendStack || recommendation.name,
        detail: 'The customer-facing application where people complete tasks and interact with the product.',
        icon: MonitorSmartphone,
        tone: 'violet',
      },
      {
        id: 'services',
        eyebrow: selectedTopology.label,
        label: recommendation.backendStack || recommendation.architecture || 'Application backend',
        detail: servicesDetail,
        icon: ServerCog,
        tone: 'blue',
      },
      ...moduleNodes,
      {
        id: 'data',
        eyebrow: 'Product data',
        label: recommendation.databaseStack || valueFor('data') || 'Primary data store',
        detail: 'The durable source of truth for accounts, content, transactions, and product history.',
        icon: Database,
        tone: 'emerald',
      },
      {
        id: 'access',
        eyebrow: 'Identity & access',
        label: accessDecisionText || 'Protected access',
        detail: 'A dedicated identity boundary: sign-in, sessions, and who can access which parts of the product.',
        icon: ShieldCheck,
        tone: 'emerald',
        hidden: !showSeparateIdentity,
      },
      {
        id: 'integrations',
        eyebrow: 'External services',
        label: features.integrationsLabel,
        detail: features.showPayments
          ? 'Outside platforms for messaging, content, maps, or other business workflows (payments are shown separately).'
          : 'Outside platforms used for messaging, content, or other business workflows.',
        icon: PlugZap,
        tone: 'amber',
        hidden: !features.showIntegrations,
      },
      {
        id: 'payments',
        eyebrow: 'Billing',
        label: features.payments.label,
        detail: features.payments.detail,
        icon: CreditCard,
        tone: 'amber',
        hidden: !features.showPayments,
      },
      {
        id: 'delivery',
        eyebrow: 'Delivery',
        label: recommendation.deploymentTarget || valueFor('deployment', 'delivery') || 'Production deployment',
        detail: 'How releases are built, hosted, and delivered safely to the people using the product.',
        icon: CloudCog,
        tone: 'violet',
      },
      {
        id: 'operations',
        eyebrow: 'Health',
        label: operationsLabel,
        detail: features.showDr
          ? 'How the team detects incidents and understands live system health. Geographic recovery is shown on Multi-region & recovery.'
          : 'How the team detects problems, understands system health, and restores service after failures.',
        icon: Activity,
        tone: 'blue',
      },
      {
        id: 'edge',
        eyebrow: 'Edge',
        label: infra.edge.label,
        detail: infra.edge.detail,
        icon: Globe,
        tone: 'violet',
        hidden: !detailed || !infra.showEdge,
      },
      {
        id: 'cache',
        eyebrow: 'Cache',
        label: infra.cache.label,
        detail: infra.cache.detail,
        icon: HardDrive,
        tone: 'amber',
        hidden: !detailed || !infra.showCache,
      },
      {
        id: 'messaging',
        eyebrow: 'Async',
        label: infra.messaging.label,
        detail: infra.messaging.detail,
        icon: Radio,
        tone: 'amber',
        hidden: !detailed || !infra.showMessaging,
      },
      {
        id: 'gateway',
        eyebrow: 'Gateway',
        label: infra.gateway.label,
        detail: infra.gateway.detail,
        icon: Route,
        tone: 'blue',
        hidden: !detailed || !infra.showGateway,
      },
      {
        id: 'realtime',
        eyebrow: 'Realtime',
        label: features.realtime.label,
        detail: features.realtime.detail,
        icon: Wifi,
        tone: 'violet',
        hidden: !features.showRealtime,
      },
      {
        id: 'search',
        eyebrow: 'Discovery',
        label: features.search.label,
        detail: features.search.detail,
        icon: Search,
        tone: 'emerald',
        hidden: !features.showSearch,
      },
      {
        id: 'objectStore',
        eyebrow: 'Media',
        label: features.objectStore.label,
        detail: features.objectStore.detail,
        icon: FolderOpen,
        tone: 'emerald',
        hidden: !features.showObjectStore,
      },
      {
        id: 'secrets',
        eyebrow: 'Config',
        label: features.secrets.label,
        detail: features.secrets.detail,
        icon: KeyRound,
        tone: 'amber',
        hidden: !features.showSecrets,
      },
      {
        id: 'analytics',
        eyebrow: 'Analytics',
        label: features.analytics.label,
        detail: features.analytics.detail,
        icon: BarChart3,
        tone: 'violet',
        hidden: !features.showAnalytics,
      },
      {
        id: 'dr',
        eyebrow: 'Resilience',
        label: features.dr.label,
        detail: features.dr.detail,
        icon: Globe,
        tone: 'blue',
        hidden: !features.showDr,
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation, decisions, selectedTopology, detailed, infra, showSeparateIdentity, accessDecisionText, servicesDetail, features, operationsLabel]);

  const visibleNodes = useMemo(() => nodes.filter(node => !node.hidden), [nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    const gatewayVisible = visibleNodeIds.has('gateway');
    return graphEdges.filter(edge => {
      if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) return false;
      // Prefer gateway hop over a direct client→services link when the gateway is shown.
      if (gatewayVisible && edge.from === 'experience' && edge.to === 'services') return false;
      // When modules are visible, keep the high-level services→data link only if no modules shown.
      if (features.modules.length > 0 && edge.from === 'services' && edge.to === 'data') return false;
      return true;
    });
  }, [visibleNodeIds, graphEdges, features.modules.length]);

  const laneLayout = useMemo(
    () => computeLaneLayout(visibleNodeIds, laneOrder),
    [visibleNodeIds, laneOrder],
  );
  const canvasHeight = useMemo(() => {
    let maxStack = 1;
    for (let laneIndex = 0; laneIndex < FLOW_LANES.length; laneIndex += 1) {
      const count = (laneOrder[laneIndex] || []).filter(id => visibleNodeIds.has(id)).length;
      maxStack = Math.max(maxStack, count);
    }
    return canvasHeightFor(maxStack);
  }, [visibleNodeIds, laneOrder]);
  const [nodePositions, setNodePositions] = useState<Record<string, Point>>(
    () => seedLayoutState(persistedLayout).nodePositions,
  );
  const positions = useMemo(() => {
    const merged = mergeNodePositions(laneLayout, nodePositions, visibleNodeIds);
    return separateOverlappingPositions(merged, laneOrder, visibleNodeIds);
  }, [laneLayout, nodePositions, visibleNodeIds, laneOrder]);
  const hasCompleteSavedLayout = useMemo(() => {
    const ids = [...visibleNodeIds];
    return ids.length > 0 && ids.every(id => Boolean(nodePositions[id]));
  }, [visibleNodeIds, nodePositions]);
  const [activeNodeId, setActiveNodeId] = useState('people');
  const [zoom, setZoom] = useState(() => seedLayoutState(persistedLayout).zoom);
  const [pan, setPan] = useState<Point>(() => seedLayoutState(persistedLayout).pan);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: Point } | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Point } | null>(null);
  const nodePositionsRef = useRef(nodePositions);
  const zoomRef = useRef(zoom);
  const panStateRef = useRef(pan);

  useEffect(() => {
    nodePositionsRef.current = nodePositions;
  }, [nodePositions]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panStateRef.current = pan;
  }, [pan]);
  useEffect(() => {
    detailLevelRef.current = detailLevel;
  }, [detailLevel]);

  const activeNode = visibleNodes.find(node => node.id === activeNodeId) || visibleNodes[0];
  const ActiveIcon = activeNode.icon;
  const { border, panel, muted, title: titleText, inner } = workbenchTheme(isDark);
  const nodeSurface = isDark
    ? 'border-white/[0.08] bg-[#131417]/95 hover:border-white/[0.14]'
    : 'border-slate-200/90 bg-white hover:border-slate-300';

  const persistLayoutRef = useRef(onPersistLayout);
  persistLayoutRef.current = onPersistLayout;

  const commitLayout = (overrides: Partial<ArchitectureMapLayout> = {}) => {
    const next: ArchitectureMapLayout = {
      zoom: overrides.zoom ?? zoomRef.current,
      pan: overrides.pan ?? panStateRef.current,
      detailLevel: overrides.detailLevel ?? detailLevelRef.current,
    };
    if ('positions' in overrides) {
      if (overrides.positions && Object.keys(overrides.positions).length > 0) {
        next.positions = overrides.positions;
      }
    } else if (Object.keys(nodePositionsRef.current).length > 0) {
      next.positions = nodePositionsRef.current;
    }
    persistLayoutRef.current?.(next);
  };

  const setDetailLevelAndPersist = (next: ArchitectureMapDetailLevel) => {
    if (next === detailLevelRef.current) return;
    setDetailLevel(next);
    detailLevelRef.current = next;
    // Drop custom positions so new infra nodes land on the default lane layout.
    setNodePositions({});
    nodePositionsRef.current = {};
    commitLayout({ detailLevel: next, positions: {} });
  };

  // Drop stale partial layouts when the visible node set changes (e.g. modules / Detailed).
  const visibleLayoutKey = useMemo(
    () => `${detailLevel}:${[...visibleNodeIds].sort().join('|')}`,
    [detailLevel, visibleNodeIds],
  );
  const visibleLayoutKeyRef = useRef(visibleLayoutKey);
  useEffect(() => {
    if (visibleLayoutKeyRef.current === visibleLayoutKey) return;
    visibleLayoutKeyRef.current = visibleLayoutKey;
    const saved = nodePositionsRef.current;
    const ids = [...visibleNodeIds];
    const complete = ids.length > 0 && ids.every(id => Boolean(saved[id]));
    if (complete) return;
    if (Object.keys(saved).length === 0) return;
    setNodePositions({});
    nodePositionsRef.current = {};
    commitLayout({ positions: {} });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLayoutKey]);

  useEffect(() => {
    const seeded = seedLayoutState(persistedLayout);
    setNodePositions(seeded.nodePositions);
    nodePositionsRef.current = seeded.nodePositions;
    setZoom(seeded.zoom);
    zoomRef.current = seeded.zoom;
    setPan(seeded.pan);
    panStateRef.current = seeded.pan;
    setDetailLevel(seeded.detailLevel);
    detailLevelRef.current = seeded.detailLevel;
    setActiveNodeId('people');
    // Force the visible-set effect to re-evaluate stale positions for this project.
    visibleLayoutKeyRef.current = '';
  // Restore saved map view when switching projects only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const skipDetailRefitRef = useRef(true);
  // Refit when switching simple ↔ detailed so new nodes stay in frame.
  useEffect(() => {
    if (skipDetailRefitRef.current) {
      skipDetailRefitRef.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => {
      const fitted = fitMapInView(mergeNodePositions(laneLayout, {}, visibleNodeIds), DEFAULT_MAP_ZOOM);
      if (!fitted) return;
      setZoom(fitted.zoom);
      zoomRef.current = fitted.zoom;
      setPan(fitted.pan);
      panStateRef.current = fitted.pan;
      commitLayout({ zoom: fitted.zoom, pan: fitted.pan, detailLevel: detailLevelRef.current });
    });
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailLevel]);

  useEffect(() => {
    skipDetailRefitRef.current = true;
  }, [projectId]);

  useEffect(() => {
    if (!highlightedNodeId) return;
    if (visibleNodeIds.has(highlightedNodeId)) {
      setActiveNodeId(highlightedNodeId);
    }
  }, [highlightedNodeId, visibleNodeIds]);

  const exportMap = async (format: 'svg' | 'png') => {
    if (isExporting) return;
    const safeName = exportTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'architecture-map';
    const filename = `${safeName}.${format}`;
    const scene = {
      width: CANVAS_WIDTH,
      height: canvasHeight,
      title: exportTitle,
      isDark,
      nodes: visibleNodes.map(node => ({ id: node.id, eyebrow: node.eyebrow, label: node.label })),
      positions,
      edges: visibleEdges,
    };

    setIsExporting(true);
    try {
      const saved = await exportArchitectureMapFile({
        format,
        filename,
        scene,
      });
      if (saved) {
        notify.success(`${format.toUpperCase()} export ready`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      notify.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  /** Frame the full map (lane headers + nodes), not just node bounds. */
  const fitMapInView = (nextPositions = positions, fixedZoom?: number): { zoom: number; pan: Point } | null => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const points = Object.values(nextPositions);
    const nodeMaxY = points.length ? Math.max(...points.map(point => point.y + NODE_HEIGHT)) : canvasHeight;

    const minX = 0;
    const maxX = CANVAS_WIDTH;
    const minY = Math.max(0, (points.length ? Math.min(...points.map(point => point.y)) : PRIMARY_ROW_Y) - 12);
    const maxY = (points.length ? nodeMaxY : PRIMARY_ROW_Y + NODE_HEIGHT) + 20;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const nextZoom = fixedZoom ?? DEFAULT_MAP_ZOOM;

    const contentCenterX = minX + contentW / 2;
    const contentCenterY = minY + contentH / 2;
    const nextPan = {
      x: viewport.clientWidth / 2 - contentCenterX * nextZoom,
      y: viewport.clientHeight / 2 - LANE_HEADER_HEIGHT / 2 - contentCenterY * nextZoom,
    };

    setZoom(nextZoom);
    setPan(nextPan);
    return { zoom: nextZoom, pan: nextPan };
  };

  useEffect(() => {
    if (hasCompleteSavedLayout) return;
    const frame = requestAnimationFrame(() => {
      fitMapInView(laneLayout, DEFAULT_MAP_ZOOM);
    });
    return () => cancelAnimationFrame(frame);
  // Refit when the canvas switches between embedded and expanded sizes or lane layout changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, hasCompleteSavedLayout, laneLayout, canvasHeight]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (Object.keys(nodePositionsRef.current).length === 0) {
      const seeded = mergeNodePositions(laneLayout, {}, visibleNodeIds);
      nodePositionsRef.current = seeded;
      setNodePositions(seeded);
    }

    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: positions[id],
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.origin.x + (event.clientX - drag.startX) / zoomRef.current;
    const nextY = drag.origin.y + (event.clientY - drag.startY) / zoomRef.current;
    setNodePositions(current => {
      const next = { ...current, [drag.id]: { x: nextX, y: nextY } };
      nodePositionsRef.current = next;
      return next;
    });
  };

  const stopDragging = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextX = drag.origin.x + (event.clientX - drag.startX) / zoomRef.current;
    const nextY = drag.origin.y + (event.clientY - drag.startY) / zoomRef.current;
    const nextPositions = { ...nodePositionsRef.current, [drag.id]: { x: nextX, y: nextY } };
    nodePositionsRef.current = nextPositions;
    setNodePositions(nextPositions);
    dragRef.current = null;
    commitLayout({ positions: nextPositions });
  };

  const startPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pan,
    };
  };

  const moveCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    const activePan = panRef.current;
    if (!activePan || activePan.pointerId !== event.pointerId) return;
    setPan({
      x: activePan.origin.x + event.clientX - activePan.startX,
      y: activePan.origin.y + event.clientY - activePan.startY,
    });
  };

  const stopPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      commitLayout();
    }
  };

  const changeZoom = (delta: number) => {
    const viewport = viewportRef.current;
    const nextZoom = Math.min(1.3, Math.max(0.35, Number((zoom + delta).toFixed(2))));
    if (!viewport || nextZoom === zoom) return;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const ratio = nextZoom / zoom;
    setPan(current => {
      const nextPan = {
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      };
      panStateRef.current = nextPan;
      commitLayout({ zoom: nextZoom, pan: nextPan });
      return nextPan;
    });
    setZoom(nextZoom);
    zoomRef.current = nextZoom;
  };

  const resetView = () => {
    requestAnimationFrame(() => {
      const fitted = fitMapInView(positions, DEFAULT_MAP_ZOOM);
      if (fitted) {
        panStateRef.current = fitted.pan;
        zoomRef.current = fitted.zoom;
        commitLayout({ zoom: fitted.zoom, pan: fitted.pan });
      }
    });
  };

  useEffect(() => {
    if (!isExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isExpanded]);

  const mapContent = (
    <section className={`${isExpanded ? 'flex h-full min-h-0 flex-col shadow-2xl' : 'relative'} overflow-hidden rounded-2xl border ${panel}`}>
      <div className={`shrink-0 flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${border}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-xs ${muted}`}>Interactive map</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {selectedTopology.label}
            </span>
          </div>
          <h3 className={`mt-0.5 text-[13px] ${titleText}`}>System flow</h3>
          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
            {detailed
              ? 'Detailed adds cache, edge, async, gateway, secrets, and analytics when relevant · modules and payments appear from your decisions'
              : 'Modules, payments, realtime, and admin roles appear when your decisions need them · switch to Detailed for infra depth'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div
            className={`mr-1 flex items-center rounded-lg border p-0.5 ${border} ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}
            role="group"
            aria-label="Map detail level"
          >
            <button
              type="button"
              onClick={() => setDetailLevelAndPersist('simple')}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                !detailed
                  ? isDark
                    ? 'bg-white/[0.1] text-white'
                    : 'bg-white text-slate-900 shadow-sm'
                  : muted
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setDetailLevelAndPersist('detailed')}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                detailed
                  ? isDark
                    ? 'bg-white/[0.1] text-white'
                    : 'bg-white text-slate-900 shadow-sm'
                  : muted
              }`}
            >
              Detailed
            </button>
          </div>
          <button type="button" onClick={() => changeZoom(-0.1)} className="btn-secondary p-2" title="Zoom out" aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className={`min-w-11 text-center text-[10px] font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.1)} className="btn-secondary p-2" title="Zoom in" aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={resetView} className="btn-secondary p-2" title="Reset zoom and pan" aria-label="Reset zoom and pan">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setIsExpanded(value => !value)} className="btn-secondary-accent p-2" title={isExpanded ? 'Exit full screen' : 'Expand map'} aria-label={isExpanded ? 'Exit full screen' : 'Expand map'}>
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={event => {
              event.stopPropagation();
              void exportMap('svg');
            }}
            className="btn-secondary p-2 disabled:opacity-40"
            title="Download SVG"
            aria-label="Download SVG"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={event => {
              event.stopPropagation();
              void exportMap('png');
            }}
            className="btn-secondary p-2 disabled:opacity-40"
            title="Download PNG"
            aria-label="Download PNG"
          >
            <ImageDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={startPanning}
        onPointerMove={moveCanvas}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        className={`relative touch-none overflow-hidden ${panRef.current ? 'cursor-grabbing' : 'cursor-grab'} ${isExpanded ? 'min-h-0 flex-1' : 'h-[min(52vh,520px)] min-h-[420px]'}`}
        style={{
          backgroundImage: isDark
            ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)'
            : 'radial-gradient(circle, rgba(100,116,139,0.16) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y + LANE_HEADER_HEIGHT}px`,
        }}
      >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 border-b ${border} ${isDark ? 'bg-[#0E0F12]/95' : 'bg-[#F6F7F9]/95'}`}
            style={{ height: LANE_HEADER_HEIGHT }}
            aria-hidden="true"
          >
            {FLOW_LANES.map(lane => (
              <div
                key={lane.label}
                className="absolute top-0 flex h-full items-center justify-center px-1"
                style={{
                  left: pan.x + lane.x * zoom,
                  width: lane.width * zoom,
                }}
              >
                <span className={`truncate text-[10px] uppercase tracking-wide ${muted}`}>
                  {lane.label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute inset-0 z-0"
            aria-hidden="true"
          >
            {FLOW_LANES.map(lane => (
              <div
                key={`${lane.label}-guide`}
                className={`absolute rounded-b-xl border-x border-b ${isDark ? 'border-white/[0.05] bg-white/[0.015]' : 'border-slate-200/70 bg-white/40'}`}
                style={{
                  left: pan.x + lane.x * zoom,
                  width: lane.width * zoom,
                  top: LANE_HEADER_HEIGHT,
                  bottom: 0,
                }}
              />
            ))}
          </div>

          <div
            className="absolute left-0 top-0 overflow-visible"
            style={{
              width: CANVAS_WIDTH,
              height: canvasHeight,
              transform: `translate(${pan.x}px, ${pan.y + LANE_HEADER_HEIGHT}px) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={CANVAS_WIDTH} height={canvasHeight} viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`} aria-hidden="true">
              <defs>
                <marker id="architecture-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill={isDark ? '#64748b' : '#94a3b8'} />
                </marker>
                <marker id="architecture-arrow-primary" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill={isDark ? '#60a5fa' : '#2563eb'} />
                </marker>
              </defs>
              {visibleEdges.map(edge => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                if (!from || !to) return null;
                const path = edgePath(from, to);
                const labelX = (from.x + NODE_WIDTH / 2 + to.x + NODE_WIDTH / 2) / 2;
                const labelY = (from.y + NODE_HEIGHT / 2 + to.y + NODE_HEIGHT / 2) / 2 - 7;
                const primary = isPrimaryEdge(edge.from, edge.to);
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke={primary ? (isDark ? '#60a5fa' : '#2563eb') : isDark ? '#64748b' : '#94a3b8'}
                      strokeWidth={primary ? 2.25 : 1.5}
                      strokeOpacity={primary ? 0.95 : 0.85}
                      strokeDasharray={edge.dashed ? '6 6' : undefined}
                      markerEnd={primary ? 'url(#architecture-arrow-primary)' : 'url(#architecture-arrow)'}
                    />
                    <rect
                      x={labelX - 34}
                      y={labelY - 8}
                      width="68"
                      height="16"
                      rx="8"
                      fill={primary ? (isDark ? '#1e3a5f' : '#eff6ff') : isDark ? '#101216' : '#f8fafc'}
                    />
                    <text
                      x={labelX}
                      y={labelY + 3}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="600"
                      fill={primary ? (isDark ? '#93c5fd' : '#1d4ed8') : isDark ? '#94a3b8' : '#64748b'}
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {visibleNodes.map(node => {
              const Icon = node.icon;
              const position = positions[node.id] ?? laneLayout[node.id];
              if (!position) return null;
              const selected = node.id === activeNode.id;
              const highlighted = node.id === highlightedNodeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setActiveNodeId(node.id);
                    onHighlightNode?.(node.id);
                  }}
                  onPointerDown={event => onPointerDown(event, node.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={stopDragging}
                  onPointerCancel={stopDragging}
                  className={`absolute flex h-24 w-48 touch-none cursor-grab flex-col rounded-xl border p-3 text-left shadow-sm backdrop-blur-sm transition-[border-color,box-shadow] active:cursor-grabbing ${nodeSurface} ${
                    selected || highlighted ? `${toneStyles[node.tone].border} ${toneStyles[node.tone].glow}` : ''
                  } ${highlighted && !selected ? 'ring-2 ring-blue-500/40' : ''}`}
                  style={{ left: position.x, top: position.y }}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${toneStyles[node.tone].icon}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`flex items-center justify-between gap-2 text-[9px] uppercase tracking-wide ${muted}`}>
                        <span>{node.eyebrow}</span>
                        <Move className="h-3 w-3 shrink-0 opacity-40" />
                      </div>
                      <div className={`mt-1 line-clamp-3 text-[11px] leading-4 ${titleText}`}>{node.label}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
      </div>

      <div className={`shrink-0 flex items-start gap-3 border-t px-5 py-4 sm:px-6 ${border} ${inner}`}>
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneStyles[activeNode.tone].icon}`}>
          <ActiveIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] uppercase tracking-wide ${muted}`}>{activeNode.eyebrow}</p>
          <p className={`mt-0.5 text-[13px] ${titleText}`}>{activeNode.label}</p>
          <p className={`mt-1.5 text-xs leading-relaxed ${muted}`}>{activeNode.detail}</p>
          {activeNode.id === 'services' && features.modules.length > 0 ? (
            <p className={`mt-2 text-[11px] leading-relaxed ${muted}`}>
              Domain modules appear as nodes on the map ({features.modules.join(', ')}).
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );

  if (!isExpanded) return mapContent;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] p-3 backdrop-blur-sm sm:p-5 ${isDark ? 'bg-black/70' : 'bg-slate-900/35'}`}>
      {mapContent}
    </div>,
    document.body,
  );
};
