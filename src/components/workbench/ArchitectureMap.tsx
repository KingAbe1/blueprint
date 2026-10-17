import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  CloudCog,
  Database,
  Maximize2,
  Minimize2,
  Minus,
  MonitorSmartphone,
  Move,
  Plus,
  PlugZap,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  UserRound,
  Download,
  ImageDown,
} from 'lucide-react';
import { exportArchitectureMapFile } from '../../services/architectureMapExport';
import { useNotification } from '../../context/NotificationContext';
import {
  ArchitectureMapLayout,
  ArchitectureQuestion,
  ArchitectureTopology,
  FrameworkRecommendation,
} from '../../types/project';
import { workbenchTheme } from './workbenchUi';

interface ArchitectureDecision {
  category: ArchitectureQuestion['category'];
  value: string;
}

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
/** Tall enough for a three-node lane stack plus bottom breathing room. */
const CANVAS_HEIGHT = PRIMARY_ROW_Y + NODE_HEIGHT + 2 * (NODE_HEIGHT + LANE_NODE_GAP) + 28;
const DEFAULT_MAP_ZOOM = 1;

/** Vertical stacking order within each lane (primary path nodes first). */
const LANE_NODE_ORDER: Record<number, string[]> = {
  0: ['people'],
  1: ['experience', 'access'],
  2: ['services', 'delivery'],
  3: ['data', 'integrations', 'operations'],
};

const PRIMARY_PATH_NODES = new Set(['people', 'experience', 'services', 'data']);

const EDGES: GraphEdge[] = [
  { from: 'people', to: 'experience', label: 'uses' },
  { from: 'experience', to: 'services', label: 'requests' },
  { from: 'access', to: 'experience', label: 'signs in' },
  { from: 'access', to: 'services', label: 'authorizes' },
  { from: 'services', to: 'data', label: 'stores' },
  { from: 'services', to: 'integrations', label: 'connects' },
  { from: 'services', to: 'operations', label: 'health' },
  { from: 'delivery', to: 'experience', label: 'releases', dashed: true },
  { from: 'delivery', to: 'services', label: 'deploys', dashed: true },
];

const PRIMARY_FLOW: Array<[string, string]> = [
  ['people', 'experience'],
  ['experience', 'services'],
  ['services', 'data'],
];

const LANE_SPECS = [
  { width: 252, label: 'People' },
  { width: 264, label: 'Experience' },
  { width: 284, label: 'Application' },
  { width: 244, label: 'Platform' },
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

function fallbackModules(decisions: ArchitectureDecision[]) {
  const text = decisions.map(decision => decision.value).join(' ').toLowerCase();
  if (/fleet|vehicle|dispatch|driver/.test(text)) {
    return ['Fleet & assets', 'Live tracking', 'Dispatch', 'Drivers & attendance', 'Maintenance', 'Reporting'];
  }
  if (/catalog|cart|checkout|order|inventory|payment|store/.test(text)) {
    return ['Accounts & access', 'Catalog', 'Cart & checkout', 'Orders & inventory', 'Payments', 'Notifications'];
  }
  return ['Accounts & access', 'Core product', 'Notifications', 'Administration'];
}

function integrationsAreInScope(decisions: ArchitectureDecision[], valueFor: (...categories: ArchitectureQuestion['category'][]) => string): boolean {
  const value = valueFor('integrations', 'api');
  if (!value) return false;
  return !/no required|none|not needed|out of scope|no preference|let blueprint decide|no external/i.test(value.toLowerCase());
}

function isPrimaryEdge(from: string, to: string): boolean {
  return PRIMARY_FLOW.some(([a, b]) => a === from && b === to);
}

function laneCenterX(laneIndex: number): number {
  const lane = FLOW_LANES[laneIndex];
  return lane.x + (lane.width - NODE_WIDTH) / 2;
}

/** Snap visible nodes into swim lanes; primary path shares one horizontal row. */
function computeLaneLayout(visibleIds: Set<string>): Record<string, Point> {
  const positions: Record<string, Point> = {};

  for (let laneIndex = 0; laneIndex < FLOW_LANES.length; laneIndex += 1) {
    const ordered = LANE_NODE_ORDER[laneIndex].filter(id => visibleIds.has(id));
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

function mergeNodePositions(
  laneLayout: Record<string, Point>,
  saved: Record<string, Point>,
  visibleIds: Set<string>,
): Record<string, Point> {
  const merged = { ...laneLayout };
  for (const id of visibleIds) {
    if (saved[id]) merged[id] = saved[id];
  }
  return merged;
}

function seedLayoutState(persisted?: ArchitectureMapLayout): {
  nodePositions: Record<string, Point>;
  zoom: number;
  pan: Point;
} {
  return {
    nodePositions: readSavedPositions(persisted),
    zoom: persisted?.zoom ?? DEFAULT_MAP_ZOOM,
    pan: persisted?.pan ? { ...persisted.pan } : { x: 0, y: 0 },
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
  const systemModules = recommendation.systemModules?.length ? recommendation.systemModules : fallbackModules(decisions);

  const valueFor = (...categories: ArchitectureQuestion['category'][]) => {
    const matches = uniqueValues(
      decisions.filter(decision => categories.includes(decision.category)).map(decision => decision.value),
    );
    return matches.join(' · ');
  };

  const showIntegrations = integrationsAreInScope(decisions, valueFor);

  const nodes = useMemo<MapNode[]>(() => [
    {
      id: 'people',
      eyebrow: 'People',
      label: valueFor('users') || 'Product users',
      detail: 'The people and roles that enter the product and start its main workflows.',
      icon: UserRound,
      tone: 'blue',
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
      detail: recommendation.topologyRationale || selectedTopology.description,
      icon: ServerCog,
      tone: 'blue',
    },
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
      label: valueFor('access') || valueFor('security') || 'Protected access',
      detail: 'Controls who can enter the product and which information or actions each role can access.',
      icon: ShieldCheck,
      tone: 'emerald',
    },
    {
      id: 'integrations',
      eyebrow: 'External services',
      label: valueFor('integrations') || valueFor('api') || 'No required external services',
      detail: 'Outside platforms used for payments, messaging, content, or other business workflows.',
      icon: PlugZap,
      tone: 'amber',
      hidden: !showIntegrations,
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
      eyebrow: 'Health & recovery',
      label: valueFor('observability', 'reliability') || 'Monitoring and recovery',
      detail: 'How the team detects problems, understands system health, and restores service after failures.',
      icon: Activity,
      tone: 'blue',
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [recommendation, decisions, selectedTopology, showIntegrations]);

  const visibleNodes = useMemo(() => nodes.filter(node => !node.hidden), [nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => EDGES.filter(edge => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
    [visibleNodeIds],
  );

  const laneLayout = useMemo(() => computeLaneLayout(visibleNodeIds), [visibleNodeIds]);
  const [nodePositions, setNodePositions] = useState<Record<string, Point>>(
    () => seedLayoutState(persistedLayout).nodePositions,
  );
  const positions = useMemo(
    () => mergeNodePositions(laneLayout, nodePositions, visibleNodeIds),
    [laneLayout, nodePositions, visibleNodeIds],
  );
  const hasSavedNodePositions = Object.keys(nodePositions).length > 0;
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

  const activeNode = visibleNodes.find(node => node.id === activeNodeId) || visibleNodes[0];
  const ActiveIcon = activeNode.icon;
  const { border, panel, muted, title: titleText, inner } = workbenchTheme(isDark);
  const nodeSurface = isDark
    ? 'border-white/[0.08] bg-[#131417]/95 hover:border-white/[0.14]'
    : 'border-slate-200/90 bg-white hover:border-slate-300';

  const persistLayoutRef = useRef(onPersistLayout);
  persistLayoutRef.current = onPersistLayout;

  const commitLayout = (overrides: Partial<ArchitectureMapLayout> = {}) => {
    const savedPositions = overrides.positions ?? nodePositionsRef.current;
    const next: ArchitectureMapLayout = {
      zoom: overrides.zoom ?? zoomRef.current,
      pan: overrides.pan ?? panStateRef.current,
    };
    if (Object.keys(savedPositions).length > 0) {
      next.positions = savedPositions;
    }
    persistLayoutRef.current?.(next);
  };

  useEffect(() => {
    const seeded = seedLayoutState(persistedLayout);
    setNodePositions(seeded.nodePositions);
    nodePositionsRef.current = seeded.nodePositions;
    setZoom(seeded.zoom);
    zoomRef.current = seeded.zoom;
    setPan(seeded.pan);
    panStateRef.current = seeded.pan;
    setActiveNodeId('people');
  // Restore saved map view when switching projects only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      height: CANVAS_HEIGHT,
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
    const nodeMaxY = points.length ? Math.max(...points.map(point => point.y + NODE_HEIGHT)) : CANVAS_HEIGHT;

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
    if (hasSavedNodePositions) return;
    const frame = requestAnimationFrame(() => {
      fitMapInView(laneLayout, DEFAULT_MAP_ZOOM);
    });
    return () => cancelAnimationFrame(frame);
  // Refit when the canvas switches between embedded and expanded sizes or lane layout changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, hasSavedNodePositions, laneLayout]);

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
            Drag nodes to rearrange · positions save automatically · follow the blue path · click a node for detail
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
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
              height: CANVAS_HEIGHT,
              transform: `translate(${pan.x}px, ${pan.y + LANE_HEADER_HEIGHT}px) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
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
              const position = positions[node.id];
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
          {activeNode.id === 'services' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {systemModules.map(module => (
                <span key={module} className={`rounded-md border px-2 py-1 text-[10px] ${border} ${
                  isDark ? 'bg-white/[0.03] text-slate-300' : 'bg-white text-slate-600'
                }`}>{module}</span>
              ))}
            </div>
          )}
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
