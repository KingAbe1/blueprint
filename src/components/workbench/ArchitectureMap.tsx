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
} from 'lucide-react';
import { ArchitectureQuestion, ArchitectureTopology, FrameworkRecommendation } from '../../types/project';

interface ArchitectureDecision {
  category: ArchitectureQuestion['category'];
  value: string;
}

interface ArchitectureMapProps {
  recommendation: FrameworkRecommendation;
  decisions: ArchitectureDecision[];
  isDark: boolean;
}

type Point = { x: number; y: number };
type MapNode = {
  id: string;
  eyebrow: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'violet' | 'emerald' | 'amber';
};

type GraphEdge = {
  from: string;
  to: string;
  label: string;
  dashed?: boolean;
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 600;
const NODE_WIDTH = 192;
const NODE_HEIGHT = 96;

const DEFAULT_POSITIONS: Record<string, Point> = {
  people: { x: 34, y: 225 },
  experience: { x: 292, y: 92 },
  access: { x: 292, y: 358 },
  services: { x: 550, y: 225 },
  data: { x: 838, y: 55 },
  integrations: { x: 838, y: 205 },
  operations: { x: 838, y: 355 },
  delivery: { x: 550, y: 475 },
};

const EDGES: GraphEdge[] = [
  { from: 'people', to: 'experience', label: 'uses' },
  { from: 'experience', to: 'services', label: 'requests' },
  { from: 'access', to: 'experience', label: 'signs in' },
  { from: 'access', to: 'services', label: 'authorizes' },
  { from: 'services', to: 'data', label: 'reads & writes' },
  { from: 'services', to: 'integrations', label: 'connects' },
  { from: 'services', to: 'operations', label: 'reports health' },
  { from: 'delivery', to: 'experience', label: 'releases', dashed: true },
  { from: 'delivery', to: 'services', label: 'deploys', dashed: true },
];

const toneStyles = {
  blue: { icon: 'bg-blue-500/12 text-blue-500', border: 'border-blue-400', glow: 'shadow-blue-500/10' },
  violet: { icon: 'bg-violet-500/12 text-violet-500', border: 'border-violet-400', glow: 'shadow-violet-500/10' },
  emerald: { icon: 'bg-emerald-500/12 text-emerald-500', border: 'border-emerald-400', glow: 'shadow-emerald-500/10' },
  amber: { icon: 'bg-amber-500/12 text-amber-500', border: 'border-amber-400', glow: 'shadow-amber-500/10' },
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
  if (/catalog|cart|checkout|order|inventory|payment|store/.test(text)) {
    return ['Accounts & access', 'Catalog', 'Cart & checkout', 'Orders & inventory', 'Payments', 'Notifications'];
  }
  return ['Accounts & access', 'Core product', 'Notifications', 'Administration'];
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

export const ArchitectureMap: React.FC<ArchitectureMapProps> = ({ recommendation, decisions, isDark }) => {
  const valueFor = (...categories: ArchitectureQuestion['category'][]) => {
    const matches = uniqueValues(
      decisions.filter(decision => categories.includes(decision.category)).map(decision => decision.value),
    );
    return matches.join(' · ');
  };

  const topology = recommendationTopology(recommendation);
  const selectedTopology = topologyMeta[topology];
  const systemModules = recommendation.systemModules?.length ? recommendation.systemModules : fallbackModules(decisions);

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
  ], [recommendation, decisions, selectedTopology]);

  const [positions, setPositions] = useState<Record<string, Point>>(() => ({ ...DEFAULT_POSITIONS }));
  const [activeNodeId, setActiveNodeId] = useState('services');
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: Point } | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Point } | null>(null);

  const activeNode = nodes.find(node => node.id === activeNodeId) || nodes[1];
  const ActiveIcon = activeNode.icon;
  const nodeSurface = isDark
    ? 'border-white/[0.12] bg-[#17191e]/95 hover:border-white/[0.22]'
    : 'border-slate-200 bg-white/95 hover:border-slate-300';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  const centerMap = (nextZoom = zoom, nextPositions = positions) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const points = Object.values(nextPositions);
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x + NODE_WIDTH));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y + NODE_HEIGHT));
    setPan({
      x: viewport.clientWidth / 2 - ((minX + maxX) / 2) * nextZoom,
      y: viewport.clientHeight / 2 - ((minY + maxY) / 2) * nextZoom,
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => centerMap());
    return () => cancelAnimationFrame(frame);
  // Recenter when the canvas switches between embedded and expanded sizes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
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
    const nextX = drag.origin.x + (event.clientX - drag.startX) / zoom;
    const nextY = drag.origin.y + (event.clientY - drag.startY) / zoom;
    setPositions(current => ({ ...current, [drag.id]: { x: nextX, y: nextY } }));
  };

  const stopDragging = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
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
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  const changeZoom = (delta: number) => {
    const viewport = viewportRef.current;
    const nextZoom = Math.min(1.3, Math.max(0.35, Number((zoom + delta).toFixed(2))));
    if (!viewport || nextZoom === zoom) return;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const ratio = nextZoom / zoom;
    setPan(current => ({
      x: centerX - (centerX - current.x) * ratio,
      y: centerY - (centerY - current.y) * ratio,
    }));
    setZoom(nextZoom);
  };

  const resetView = () => {
    const defaultPositions = { ...DEFAULT_POSITIONS };
    const defaultZoom = 0.75;
    setPositions(defaultPositions);
    setZoom(defaultZoom);
    setActiveNodeId('services');
    requestAnimationFrame(() => centerMap(defaultZoom, defaultPositions));
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
    <section className={`${isExpanded ? 'flex h-full min-h-0 flex-col shadow-2xl' : 'relative'} overflow-hidden rounded-xl border lg:rounded-2xl ${
      isDark ? 'border-white/[0.08] bg-[#101216]' : 'border-slate-200 bg-slate-50'
    }`}>
      <div className={`shrink-0 flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4 ${isDark ? 'border-white/[0.07] bg-black/15' : 'border-slate-200 bg-white/80'}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>System flow</div>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${isDark ? 'bg-violet-500/12 text-violet-200' : 'bg-violet-100 text-violet-700'}`}>{selectedTopology.label}</span>
          </div>
          <p className={`mt-1 text-xs ${muted}`}>Click a node for details · drag to rearrange · pan the canvas</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => changeZoom(-0.1)} className="btn-secondary p-2" title="Zoom out" aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className={`min-w-11 text-center text-[10px] font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.1)} className="btn-secondary p-2" title="Zoom in" aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={resetView} className="btn-secondary p-2" title="Reset layout" aria-label="Reset layout">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setIsExpanded(value => !value)} className="btn-secondary-accent p-2" title={isExpanded ? 'Exit full screen' : 'Expand map'} aria-label={isExpanded ? 'Exit full screen' : 'Expand map'}>
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
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
            ? 'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)'
            : 'radial-gradient(circle, rgba(100,116,139,0.22) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
          <div
            className="absolute left-0 top-0 overflow-visible"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
              <defs>
                <marker id="architecture-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill={isDark ? '#64748b' : '#94a3b8'} />
                </marker>
              </defs>
              {EDGES.map(edge => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                const path = edgePath(from, to);
                const labelX = (from.x + NODE_WIDTH / 2 + to.x + NODE_WIDTH / 2) / 2;
                const labelY = (from.y + NODE_HEIGHT / 2 + to.y + NODE_HEIGHT / 2) / 2 - 7;
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke={isDark ? '#64748b' : '#94a3b8'}
                      strokeWidth="1.5"
                      strokeDasharray={edge.dashed ? '6 6' : undefined}
                      markerEnd="url(#architecture-arrow)"
                    />
                    <rect x={labelX - 34} y={labelY - 8} width="68" height="16" rx="8" fill={isDark ? '#101216' : '#f8fafc'} />
                    <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill={isDark ? '#94a3b8' : '#64748b'}>{edge.label}</text>
                  </g>
                );
              })}
            </svg>

            {nodes.map(node => {
              const Icon = node.icon;
              const position = positions[node.id];
              const selected = node.id === activeNode.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveNodeId(node.id)}
                  onPointerDown={event => onPointerDown(event, node.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={stopDragging}
                  onPointerCancel={stopDragging}
                  className={`absolute flex h-24 w-48 touch-none cursor-grab flex-col rounded-2xl border p-3 text-left shadow-lg backdrop-blur-sm transition-[border-color,box-shadow] active:cursor-grabbing ${nodeSurface} ${
                    selected ? `${toneStyles[node.tone].border} ${toneStyles[node.tone].glow} shadow-xl` : ''
                  }`}
                  style={{ left: position.x, top: position.y }}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneStyles[node.tone].icon}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] ${muted}`}>
                        <span>{node.eyebrow}</span>
                        <Move className="h-3 w-3 shrink-0 opacity-50" />
                      </div>
                      <div className={`mt-1 line-clamp-3 text-[11px] font-semibold leading-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{node.label}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
      </div>

      <div className={`shrink-0 flex items-start gap-3 border-t px-4 py-4 sm:px-5 ${isDark ? 'border-white/[0.07] bg-[#141518]/90' : 'border-slate-200 bg-white'}`}>
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneStyles[activeNode.tone].icon}`}>
          <ActiveIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${muted}`}>{activeNode.eyebrow}</p>
          <p className={`mt-1 text-sm font-semibold leading-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeNode.label}</p>
          <p className={`mt-1.5 text-xs leading-5 ${muted}`}>{activeNode.detail}</p>
          {activeNode.id === 'services' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {systemModules.map(module => (
                <span key={module} className={`rounded-md border px-2 py-1 text-[9px] font-medium ${
                  isDark ? 'border-white/[0.08] bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
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
