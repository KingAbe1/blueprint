import React, { useState } from 'react';
import { 
  Globe, 
  Server, 
  Database, 
  ShieldCheck, 
  ArrowRight, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  Code2, 
  HardDrive, 
  Network, 
  Lock, 
  Zap, 
  Bot,
  Activity,
  Play,
  Pause,
  FileJson,
  CheckCircle2,
  Workflow,
  Sparkles,
  ShieldAlert,
  Key,
  Layers
} from 'lucide-react';
import { FrameworkRecommendation } from '../../types/project';

interface SystemArchitectureDiagramProps {
  recommendation: FrameworkRecommendation;
  isDark: boolean;
  projectName?: string;
}

interface NodeDetail {
  id: string;
  title: string;
  category: string;
  tech: string;
  role: string;
  protocol: string;
  latencyExpectation: string;
  concurrencyModel: string;
  securityGuardrails: string[];
  zodSnippet?: string;
}

export const SystemArchitectureDiagram: React.FC<SystemArchitectureDiagramProps> = ({
  recommendation,
  isDark,
  projectName = 'Application'
}) => {
  const [selectedNode, setSelectedNode] = useState<string>('compute');
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSimulatingTraffic, setIsSimulatingTraffic] = useState(true);
  const [viewFilter, setViewFilter] = useState<'all' | 'security' | 'performance' | 'flow'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'security' | 'spec'>('overview');

  // Derive architectural properties from recommendation
  const frontend = recommendation.frontendStack || 'Modern Web UI (React 19 / TypeScript)';
  const backend = recommendation.backendStack || 'High-Throughput API Engine';
  const styling = recommendation.stylingStack || 'Tailwind CSS v4';
  const database = recommendation.databaseStack || 'PostgreSQL + Connection Pool';
  const deployment = recommendation.deploymentTarget || 'Cloud Distributed Compute / Edge';

  const isMobile = (recommendation.deploymentTarget || '').toLowerCase().includes('mobile') ||
                   (recommendation.name || '').toLowerCase().includes('expo') ||
                   (recommendation.name || '').toLowerCase().includes('native');

  const isDesktop = (recommendation.deploymentTarget || '').toLowerCase().includes('desktop') ||
                    (recommendation.name || '').toLowerCase().includes('tauri') ||
                    (recommendation.name || '').toLowerCase().includes('electron');

  const isCLI = (recommendation.deploymentTarget || '').toLowerCase().includes('cli') ||
                (recommendation.deploymentTarget || '').toLowerCase().includes('terminal');

  const isAIApp = (recommendation.name || '').toLowerCase().includes('agent') ||
                  (recommendation.name || '').toLowerCase().includes('rag') ||
                  (recommendation.description || '').toLowerCase().includes('ai');

  // Mermaid representation for clipboard export
  const generateMermaidCode = () => {
    return `graph TD
    %% Blueprint Architectural Topology Diagram
    %% Project: ${projectName}
    %% Stack: ${recommendation.name}

    subgraph ClientTier ["1. Client & Ingress Tier"]
        Client["🖥️ Client (${frontend})<br/>🎨 Styling: ${styling}"]
    end

    subgraph EdgeTier ["2. Gateway & Edge Security"]
        Gateway["⚡ API Gateway / Reverse Proxy<br/>🔒 TLS 1.3 | Rate Limiting | JWT"]
    end

    subgraph ComputeTier ["3. Application & Compute Engine"]
        API["⚙️ Core Backend (${backend})<br/>🛡️ Domain Invariants & Validation"]
        ${isAIApp ? 'AgentEngine["🤖 AI Inference & Orchestration"]' : 'WorkerQueue["🔄 Async Task & Job Worker"]'}
    end

    subgraph DataTier ["4. Persistence & Storage Layer"]
        DB[("🗄️ Primary Storage (${database})")]
        Cache[("⚡ In-Memory Cache / KV")]
        ${isAIApp ? 'VectorDB[("🧠 Vector Embeddings")]' : 'BlobStore[("📦 Object Storage")]'}
    end

    subgraph ExternalTier ["5. External Ecosystem"]
        ExtAPI["🌐 External Services & Webhooks"]
    end

    Client -->|HTTPS / WSS| Gateway
    Gateway -->|Validated IPC / HTTP| API
    API -->|Async Dispatch| ${isAIApp ? 'AgentEngine' : 'WorkerQueue'}
    API -->|Read / Write Pool| DB
    API -->|Query Cache| Cache
    ${isAIApp ? 'AgentEngine -->|Similarity Search| VectorDB' : 'WorkerQueue -->|Persist Artifacts| BlobStore'}
    API -.->|Outbound Calls| ExtAPI

    classDef client fill:#3b82f620,stroke:#3b82f6,stroke-width:2px;
    classDef compute fill:#8b5cf620,stroke:#8b5cf6,stroke-width:2px;
    classDef data fill:#10b98120,stroke:#10b981,stroke-width:2px;
    class Client client;
    class API compute;
    class DB data;`;
  };

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(generateMermaidCode());
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const handleCopyJsonSpec = () => {
    const jsonSpec = {
      projectName,
      recommendation: recommendation.name,
      tiers: {
        presentation: { stack: frontend, styling, target: deployment },
        ingress: { protocol: 'TLS 1.3', authentication: 'Bearer JWT', ddosProtection: true },
        compute: { primaryBackend: backend, asyncEngine: isAIApp ? 'Streaming LLM' : 'Async Worker' },
        persistence: { primaryDb: database, cache: 'In-Memory LRU / Redis' }
      }
    };
    navigator.clipboard.writeText(JSON.stringify(jsonSpec, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Detailed technical profiles for each architectural node
  const nodeDetailsMap: Record<string, NodeDetail> = {
    client: {
      id: 'client',
      title: 'Client Application & Presentation Tier',
      category: 'Client Presentation',
      tech: `${frontend} + ${styling}`,
      role: 'Handles user interactions, UI state management, optimistic client caching, and secure JWT token storage.',
      protocol: isDesktop ? 'Native IPC / Rust Bridge' : isCLI ? 'Standard I/O Streams' : 'HTTPS / WSS (TLS 1.3)',
      latencyExpectation: '< 16ms (60fps render loop)',
      concurrencyModel: 'Event-driven UI Main Thread + Web Workers / Background Isolates',
      securityGuardrails: [
        'Strict Content Security Policy (CSP) headers',
        'Zero sensitive API keys embedded in client bundle',
        'Automatic XSS sanitization & HTML input encoding',
        'HttpOnly SameSite cookies for Auth sessions'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const ClientStateSchema = z.object({\n  sessionToken: z.string().jwt(),\n  userRole: z.enum(['admin', 'member', 'viewer']),\n  theme: z.enum(['dark', 'light']),\n  optimisticQueue: z.array(z.record(z.unknown()))\n});`
    },
    gateway: {
      id: 'gateway',
      title: 'Gateway, Edge & Security Ingress',
      category: 'Ingress & Security Proxy',
      tech: isDesktop ? 'Tauri IPC Bridge / Rust Security Kernel' : isCLI ? 'CLI Argument Parser' : 'Cloudflare Edge / Reverse Proxy Guard',
      role: 'Terminates SSL/TLS, enforces IP rate limiting, validates JWT tokens, and routes sanitized requests to compute workers.',
      protocol: 'HTTPS / HTTP/2 & HTTP/3 (TLS 1.3)',
      latencyExpectation: '< 10ms Edge Turnaround',
      concurrencyModel: 'Globally distributed non-blocking edge event workers',
      securityGuardrails: [
        'DDoS mitigation & adaptive token bucket rate limiting',
        'Automated CORS origin whitelist validation',
        'Cryptographic JWT payload & signature verification',
        'Payload size capping (Max 10MB per body)'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const IngressRequestHeaderSchema = z.object({\n  authorization: z.string().regex(/^Bearer\\s+[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*$/),\n  'x-request-id': z.string().uuid(),\n  'x-forwarded-for': z.string().ip()\n});`
    },
    compute: {
      id: 'compute',
      title: 'Core Application & Compute Engine',
      category: 'Business Domain & Services',
      tech: backend,
      role: 'Executes transactional business domain logic, enforces data invariants, validates payload mutations, and dispatches domain events.',
      protocol: 'Internal Async RPC / REST / gRPC',
      latencyExpectation: '< 45ms P95 latency target',
      concurrencyModel: 'Async Non-Blocking Event Loop / Multi-threaded Worker Pool',
      securityGuardrails: [
        'Strict schema validation on 100% of endpoint payloads',
        'Role-Based Access Control (RBAC) & ABAC policy enforcement',
        'Structured audit logging with transactional correlation IDs',
        'Automated exception boundaries & clean fallback handling'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const MutationPayloadSchema = z.object({\n  entityId: z.string().cuid(),\n  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),\n  payload: z.record(z.unknown()),\n  version: z.number().int().positive()\n});`
    },
    database: {
      id: 'database',
      title: 'Primary Storage & Persistence Layer',
      category: 'Data Durability & ACID',
      tech: database,
      role: 'Provides ACID-compliant relational durability, foreign key integrity, transactional isolation, and indexed query execution.',
      protocol: 'Postgres Wire Protocol (SSL) / SQLite C-FFI',
      latencyExpectation: '< 5ms DB query P90',
      concurrencyModel: 'Connection Pool with automated retry & read-replicas',
      securityGuardrails: [
        'AES-256 encryption at rest & TLS encryption in transit',
        'Parameterized queries preventing 100% of SQL injection',
        'Point-in-Time Recovery (PITR) automated snapshot backups',
        'Strict row-level security (RLS) tenant isolation'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const DatabaseRecordSchema = z.object({\n  id: z.string().uuid(),\n  createdAt: z.string().datetime(),\n  updatedAt: z.string().datetime(),\n  deletedAt: z.string().datetime().nullable()\n});`
    },
    cache: {
      id: 'cache',
      title: 'In-Memory Cache & Speed Layer',
      category: 'Low-Latency Cache',
      tech: isDesktop || isCLI ? 'In-Memory LRU Cache' : 'Redis / Cloudflare KV',
      role: 'Caches read-heavy query output, maintains active user sessions, handles rate limit counters, and powers real-time pub/sub notifications.',
      protocol: 'RESP3 (Redis Protocol) / In-Memory Bus',
      latencyExpectation: '< 1ms response latency',
      concurrencyModel: 'Single-threaded async in-memory event dispatch',
      securityGuardrails: [
        'Automatic TTL (Time-To-Live) key expiration',
        'TLS encrypted redis connections & AUTH passkey protection',
        'Strict memory cap limits with LRU eviction rules',
        'No unhashed auth tokens stored in plaintext'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const CacheKeySchema = z.object({\n  key: z.string().startsWith('cache:'),\n  ttlSeconds: z.number().default(300),\n  val: z.string()\n});`
    },
    workers: {
      id: 'workers',
      title: isAIApp ? 'AI Inference & Orchestration Pipeline' : 'Async Background Task Engine',
      category: isAIApp ? 'AI Engine & Vectors' : 'Asynchronous Task Processing',
      tech: isAIApp ? 'Streaming LLM Pipeline + Vector Embeddings' : 'Async Worker Queue (BullMQ / Celery)',
      role: isAIApp 
        ? 'Orchestrates streaming AI responses, executes vector embedding similarity searches, and manages autonomous tool calls.'
        : 'Executes heavy background jobs, transactional emails, webhooks, export generation, and scheduled cron tasks.',
      protocol: 'Internal Message Queue / Channel Stream',
      latencyExpectation: 'Async decoupled stream execution',
      concurrencyModel: 'Distributed consumer pool with exponential backoff retries',
      securityGuardrails: [
        'Dead-Letter Queue (DLQ) isolation for unhandled task failures',
        'Strict LLM API rate limits & token budget guardrails',
        'Idempotency keys on 100% of stateful background mutations',
        'Isolated sandboxed worker process execution'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const WorkerTaskSchema = z.object({\n  taskId: z.string().uuid(),\n  type: z.enum(['GENERATE_BLUEPRINT', 'SEND_WEBHOOK', 'INDEX_EMBEDDINGS']),\n  attempts: z.number().max(5),\n  idempotencyKey: z.string()\n});`
    }
  };

  const activeDetail = nodeDetailsMap[selectedNode] || nodeDetailsMap.compute;

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden relative ${
      isDark 
        ? 'bg-[#0A0C10] border-[#1E2230] shadow-2xl' 
        : 'bg-white border-slate-200 shadow-xl'
    } ${isExpanded ? 'fixed inset-4 z-50 p-6 overflow-y-auto' : 'p-5 sm:p-6'}`}>
      
      {/* Background Subtle Glowing Grid Lines */}
      <div className="absolute inset-0 bg-[radial-[#3b82f612]_1px,transparent_1px] [background-size:16px_16px] pointer-events-none opacity-40" />

      {/* Header Controls Bar */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b dark:border-[#1A1D2B] border-slate-200">
        
        {/* Left Title & Status Badges */}
        <div className="flex items-start sm:items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-emerald-500/20 text-blue-400 border border-blue-500/30 shadow-xs shrink-0">
            <Network className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Live System Architecture Topology
              </h4>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center space-x-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="font-semibold">SLA 99.99% Production Blueprint</span>
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-500'}`}>
              Interactive multi-tier topology map. Click any node to inspect protocols, guardrails, and latency targets.
            </p>
          </div>
        </div>

        {/* Right View Filter Tabs & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          
          {/* View Filter Segmented Control */}
          <div className={`p-1 rounded-xl border flex items-center space-x-1 text-xs font-medium ${
            isDark ? 'bg-[#12141D] border-[#222636]' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setViewFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                viewFilter === 'all'
                  ? isDark ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Tiers
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('security')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] flex items-center space-x-1 ${
                viewFilter === 'security'
                  ? isDark ? 'bg-amber-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>Guardrails</span>
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('performance')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] flex items-center space-x-1 ${
                viewFilter === 'performance'
                  ? isDark ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Performance</span>
            </button>
          </div>

          {/* Simulate Traffic Toggle */}
          <button
            type="button"
            onClick={() => setIsSimulatingTraffic(!isSimulatingTraffic)}
            title={isSimulatingTraffic ? 'Pause traffic simulation' : 'Start traffic simulation'}
            className={`text-xs px-2.5 py-1.5 rounded-xl border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
              isSimulatingTraffic
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-semibold'
                : isDark
                  ? 'bg-[#141620] border-[#242838] text-slate-400 hover:text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isSimulatingTraffic ? <Pause className="w-3.5 h-3.5 text-blue-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{isSimulatingTraffic ? 'Traffic Active' : 'Traffic Paused'}</span>
          </button>

          {/* Export Spec Buttons */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handleCopyMermaid}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
                copiedMermaid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDark
                    ? 'bg-[#141620] border-[#242838] text-slate-300 hover:text-white hover:border-[#34384E]'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {copiedMermaid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedMermaid ? 'Copied Mermaid!' : 'Mermaid'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyJsonSpec}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
                copiedJson
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDark
                    ? 'bg-[#141620] border-[#242838] text-slate-300 hover:text-white hover:border-[#34384E]'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileJson className="w-3.5 h-3.5 text-purple-400" />}
              <span>{copiedJson ? 'Copied JSON!' : 'JSON Spec'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse view' : 'Expand full view'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#141620] border-[#242838] text-slate-400 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Main Content Layout (Canvas Left 7 cols, Inspector Right 5 cols) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        
        {/* Visual Architectural Canvas (Left 7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* TIER 1: Presentation & Client Tier */}
          <div className={`space-y-1.5 transition-all duration-300 ${
            viewFilter === 'security' ? 'opacity-60' : 'opacity-100'
          }`}>
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10.5px] font-mono uppercase font-bold tracking-wider flex items-center space-x-1.5 ${
                isDark ? 'text-blue-400' : 'text-blue-600'
              }`}>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>1. Presentation & Client Tier</span>
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Target: <span className="text-blue-400 font-semibold">{deployment}</span>
              </span>
            </div>

            <div
              onClick={() => setSelectedNode('client')}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedNode === 'client'
                  ? isDark
                    ? 'bg-blue-600/15 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/50'
                    : 'bg-blue-50/90 border-blue-600 shadow-md ring-1 ring-blue-500/30'
                  : isDark
                    ? 'bg-[#12141E] border-[#202434] hover:border-[#32384D] hover:bg-[#161926]'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500" />

              <div className="flex items-start justify-between gap-3 pl-1">
                <div className="flex items-start space-x-3">
                  <div className={`p-2.5 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                    selectedNode === 'client'
                      ? 'bg-blue-600 text-white shadow-md'
                      : isDark ? 'bg-[#1A1D2C] text-blue-400' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {isMobile ? <Globe className="w-5 h-5" /> : isDesktop ? <HardDrive className="w-5 h-5" /> : isCLI ? <Code2 className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {frontend}
                      </h5>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                        UI Engine
                      </span>
                    </div>
                    <p className={`text-[11px] mt-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-600'}`}>
                      Styling: <span className="font-semibold text-blue-400">{styling}</span> • Optimistic rendering loop
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 space-y-1">
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-md font-semibold ${
                    isDark ? 'bg-[#1C202E] text-slate-300 border border-[#2B3045]' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {isDesktop ? 'IPC Bridge' : isCLI ? 'Stdio Stream' : 'WSS / HTTPS'}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center space-x-1">
                    <Zap className="w-2.5 h-2.5" />
                    <span>&lt; 16ms</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Animated Connecting Traffic Vector (Client -> Gateway) */}
          <div className="flex items-center justify-center -my-1 py-0.5">
            <div className="flex flex-col items-center relative">
              <div className={`w-0.5 h-4 ${isSimulatingTraffic ? 'bg-blue-500' : 'bg-slate-700/40'}`} />
              {isSimulatingTraffic && (
                <div className="absolute w-2 h-2 rounded-full bg-blue-400 animate-bounce shadow-[0_0_8px_#60a5fa]" />
              )}
              <div className="text-[9.5px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 flex items-center space-x-1.5">
                <Lock className="w-2.5 h-2.5" />
                <span>TLS 1.3 | WSS Handshake</span>
              </div>
              <div className={`w-0.5 h-4 ${isSimulatingTraffic ? 'bg-blue-500' : 'bg-slate-700/40'}`} />
            </div>
          </div>

          {/* TIER 2: Gateway & Ingress Security */}
          <div className={`space-y-1.5 transition-all duration-300 ${
            viewFilter === 'performance' ? 'opacity-70' : 'opacity-100'
          }`}>
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10.5px] font-mono uppercase font-bold tracking-wider flex items-center space-x-1.5 ${
                isDark ? 'text-amber-400' : 'text-amber-600'
              }`}>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>2. Gateway & Ingress Guardrails</span>
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Zero-Trust Firewall
              </span>
            </div>

            <div
              onClick={() => setSelectedNode('gateway')}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedNode === 'gateway'
                  ? isDark
                    ? 'bg-amber-500/15 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/50'
                    : 'bg-amber-50/90 border-amber-600 shadow-md ring-1 ring-amber-500/30'
                  : isDark
                    ? 'bg-[#12141E] border-[#202434] hover:border-[#32384D] hover:bg-[#161926]'
                    : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
              }`}
            >
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />

              <div className="flex items-start justify-between gap-3 pl-1">
                <div className="flex items-start space-x-3">
                  <div className={`p-2.5 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                    selectedNode === 'gateway'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : isDark ? 'bg-[#1A1D2C] text-amber-400' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isDesktop ? 'Tauri IPC Gateway & Sandboxing' : isCLI ? 'CLI Shell Parser & Guard' : 'API Gateway & Edge Firewall'}
                      </h5>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        Security Proxy
                      </span>
                    </div>
                    <p className={`text-[11px] mt-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-600'}`}>
                      JWT Verification • Adaptive Rate Limiting • CORS Whitelist • XSS Filter
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 space-y-1">
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-md font-semibold ${
                    isDark ? 'bg-[#1C202E] text-slate-300 border border-[#2B3045]' : 'bg-slate-100 text-slate-700'
                  }`}>
                    Edge Ingress
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center space-x-1">
                    <Zap className="w-2.5 h-2.5" />
                    <span>&lt; 10ms</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Animated Connecting Traffic Vector (Gateway -> Compute) */}
          <div className="flex items-center justify-center -my-1 py-0.5">
            <div className="flex flex-col items-center relative">
              <div className={`w-0.5 h-4 ${isSimulatingTraffic ? 'bg-purple-500' : 'bg-slate-700/40'}`} />
              {isSimulatingTraffic && (
                <div className="absolute w-2 h-2 rounded-full bg-purple-400 animate-ping shadow-[0_0_8px_#c084fc]" />
              )}
              <div className="text-[9.5px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/25 flex items-center space-x-1.5">
                <Workflow className="w-2.5 h-2.5" />
                <span>Validated Payload / Internal RPC</span>
              </div>
              <div className={`w-0.5 h-4 ${isSimulatingTraffic ? 'bg-purple-500' : 'bg-slate-700/40'}`} />
            </div>
          </div>

          {/* TIER 3: Core Compute Engine & AI / Worker Services */}
          <div className={`space-y-1.5 transition-all duration-300 ${
            viewFilter === 'security' ? 'opacity-70' : 'opacity-100'
          }`}>
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10.5px] font-mono uppercase font-bold tracking-wider flex items-center space-x-1.5 ${
                isDark ? 'text-purple-400' : 'text-purple-600'
              }`}>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>3. Application Core & Compute Services</span>
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Domain Invariants
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Primary API Engine Card */}
              <div
                onClick={() => setSelectedNode('compute')}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col justify-between space-y-3 ${
                  selectedNode === 'compute'
                    ? isDark
                      ? 'bg-purple-600/15 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/50'
                      : 'bg-purple-50/90 border-purple-600 shadow-md ring-1 ring-purple-500/30'
                    : isDark
                      ? 'bg-[#12141E] border-[#202434] hover:border-[#32384D] hover:bg-[#161926]'
                      : 'bg-white border-slate-200 hover:border-purple-300 hover:shadow-xs'
                }`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500" />

                <div className="flex items-start justify-between pl-1">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      selectedNode === 'compute'
                        ? 'bg-purple-600 text-white shadow-md'
                        : isDark ? 'bg-[#1A1D2C] text-purple-400' : 'bg-purple-100 text-purple-700'
                    }`}>
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {backend}
                      </h5>
                      <span className="text-[9.5px] font-mono text-purple-400 font-semibold">
                        Primary API Compute
                      </span>
                    </div>
                  </div>
                </div>

                <p className={`text-[10.5px] leading-relaxed pl-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-600'}`}>
                  Executes business logic, validates data mutations, and enforces transactional rules.
                </p>

                <div className="flex items-center justify-between pt-1 border-t dark:border-[#1E2232] border-slate-100 pl-1">
                  <span className="text-[9.5px] font-mono text-slate-400">P95 Latency</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 45ms</span>
                </div>
              </div>

              {/* Workers / AI Engine Card */}
              <div
                onClick={() => setSelectedNode('workers')}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col justify-between space-y-3 ${
                  selectedNode === 'workers'
                    ? isDark
                      ? 'bg-purple-600/15 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/50'
                      : 'bg-purple-50/90 border-purple-600 shadow-md ring-1 ring-purple-500/30'
                    : isDark
                      ? 'bg-[#12141E] border-[#202434] hover:border-[#32384D] hover:bg-[#161926]'
                      : 'bg-white border-slate-200 hover:border-purple-300 hover:shadow-xs'
                }`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-400" />

                <div className="flex items-start justify-between pl-1">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      selectedNode === 'workers'
                        ? 'bg-purple-600 text-white shadow-md'
                        : isDark ? 'bg-[#1A1D2C] text-purple-400' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {isAIApp ? <Bot className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                    </div>
                    <div>
                      <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isAIApp ? 'AI Model Pipeline' : 'Async Worker Engine'}
                      </h5>
                      <span className="text-[9.5px] font-mono text-purple-400 font-semibold">
                        {isAIApp ? 'Streaming LLM / Vectors' : 'Job Queue / BullMQ'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className={`text-[10.5px] leading-relaxed pl-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-600'}`}>
                  {isAIApp ? 'Streaming token generation, vector embeddings & autonomous agent tools.' : 'Decoupled async job processing, webhooks, and transactional queues.'}
                </p>

                <div className="flex items-center justify-between pt-1 border-t dark:border-[#1E2232] border-slate-100 pl-1">
                  <span className="text-[9.5px] font-mono text-slate-400">Execution</span>
                  <span className="text-[10px] font-mono text-purple-400 font-semibold">Async Stream</span>
                </div>
              </div>

            </div>
          </div>

          {/* Animated Connecting Traffic Vector (Compute -> Data) */}
          <div className="flex items-center justify-center -my-1 py-0.5">
            <div className="flex flex-col items-center relative">
              <div className={`w-0.5 h-4 ${isSimulatingTraffic ? 'bg-emerald-500' : 'bg-slate-700/40'}`} />
              {isSimulatingTraffic && (
                <div className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              )}
              <div className="text-[9.5px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center space-x-1.5">
                <Database className="w-2.5 h-2.5" />
                <span>Connection Pool | ACID Protocol</span>
              </div>
              <div className={`w-0.5 h-4 ${isSimulatingTraffic ? 'bg-emerald-500' : 'bg-slate-700/40'}`} />
            </div>
          </div>

          {/* TIER 4: Persistence, Cache & Storage */}
          <div className={`space-y-1.5 transition-all duration-300 ${
            viewFilter === 'security' ? 'opacity-70' : 'opacity-100'
          }`}>
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10.5px] font-mono uppercase font-bold tracking-wider flex items-center space-x-1.5 ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>4. Data Persistence & Speed Cache Tier</span>
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                ACID Integrity & Sub-1ms Cache
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Primary Database Card */}
              <div
                onClick={() => setSelectedNode('database')}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col justify-between space-y-3 ${
                  selectedNode === 'database'
                    ? isDark
                      ? 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50'
                      : 'bg-emerald-50/90 border-emerald-600 shadow-md ring-1 ring-emerald-500/30'
                    : isDark
                      ? 'bg-[#12141E] border-[#202434] hover:border-[#32384D] hover:bg-[#161926]'
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />

                <div className="flex items-start justify-between pl-1">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      selectedNode === 'database'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isDark ? 'bg-[#1A1D2C] text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {database}
                      </h5>
                      <span className="text-[9.5px] font-mono text-emerald-400 font-semibold">
                        Primary Durability DB
                      </span>
                    </div>
                  </div>
                </div>

                <p className={`text-[10.5px] leading-relaxed pl-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-600'}`}>
                  Relational ACID constraints, automated point-in-time recovery, and foreign key indexes.
                </p>

                <div className="flex items-center justify-between pt-1 border-t dark:border-[#1E2232] border-slate-100 pl-1">
                  <span className="text-[9.5px] font-mono text-slate-400">Query P90</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 5ms</span>
                </div>
              </div>

              {/* Cache Layer Card */}
              <div
                onClick={() => setSelectedNode('cache')}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col justify-between space-y-3 ${
                  selectedNode === 'cache'
                    ? isDark
                      ? 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50'
                      : 'bg-emerald-50/90 border-emerald-600 shadow-md ring-1 ring-emerald-500/30'
                    : isDark
                      ? 'bg-[#12141E] border-[#202434] hover:border-[#32384D] hover:bg-[#161926]'
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-400" />

                <div className="flex items-start justify-between pl-1">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      selectedNode === 'cache'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isDark ? 'bg-[#1A1D2C] text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isDesktop || isCLI ? 'In-Memory Cache (LRU)' : 'Redis / Cloudflare KV'}
                      </h5>
                      <span className="text-[9.5px] font-mono text-emerald-400 font-semibold">
                        Low-Latency Speed Cache
                      </span>
                    </div>
                  </div>
                </div>

                <p className={`text-[10.5px] leading-relaxed pl-1 ${isDark ? 'text-[#8E909E]' : 'text-slate-600'}`}>
                  Caches hot query results, rate-limit counters, active user sessions & pub/sub events.
                </p>

                <div className="flex items-center justify-between pt-1 border-t dark:border-[#1E2232] border-slate-100 pl-1">
                  <span className="text-[9.5px] font-mono text-slate-400">Response</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 1ms</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Node Technical Inspector Drawer (Right 5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-5 h-full transition-all duration-300 ${
            isDark ? 'bg-[#10121B] border-[#202434] shadow-xl' : 'bg-white border-slate-200 shadow-md'
          }`}>
            
            {/* Header & Tab Selector */}
            <div className="space-y-4">
              
              {/* Active Node Badge Title */}
              <div className="border-b pb-3.5 dark:border-[#1F2332] border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-mono uppercase font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    {activeDetail.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                    <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Node Active</span>
                  </span>
                </div>

                <h5 className={`text-sm font-bold mt-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeDetail.title}
                </h5>
                <div className="text-xs font-mono font-semibold mt-0.5 text-blue-400">
                  {activeDetail.tech}
                </div>
              </div>

              {/* Inspector Sub-Tabs (Overview, Performance, Security, Code Spec) */}
              <div className={`p-1 rounded-xl border flex items-center justify-between text-xs font-medium ${
                isDark ? 'bg-[#151724] border-[#222636]' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center text-[11px] ${
                    activeTab === 'overview'
                      ? isDark ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('performance')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center text-[11px] ${
                    activeTab === 'performance'
                      ? isDark ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Metrics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center text-[11px] ${
                    activeTab === 'security'
                      ? isDark ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Guardrails
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('spec')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center text-[11px] ${
                    activeTab === 'spec'
                      ? isDark ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Type Schema
                </button>
              </div>

              {/* Tab 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Architectural Responsibilities:
                    </span>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {activeDetail.role}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className={`p-3 rounded-xl border ${
                      isDark ? 'bg-[#151824] border-[#242838]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className={`text-[9.5px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Communication Protocol</div>
                      <div className={`text-xs font-mono font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {activeDetail.protocol}
                      </div>
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      isDark ? 'bg-[#151824] border-[#242838]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className={`text-[9.5px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Latency Target</div>
                      <div className="text-xs font-mono font-bold mt-1 text-emerald-400 flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>{activeDetail.latencyExpectation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: PERFORMANCE & METRICS */}
              {activeTab === 'performance' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Concurrency & Scaling Architecture:
                    </span>
                    <p className={`text-xs font-mono leading-relaxed p-3 rounded-xl border ${
                      isDark ? 'bg-[#151824] border-[#242838] text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-800'
                    }`}>
                      {activeDetail.concurrencyModel}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>System SLA Target</span>
                      <span className="font-mono font-bold text-emerald-400">99.99% Uptime</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="w-[99%] h-full bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: SECURITY GUARDRAILS */}
              {activeTab === 'security' && (
                <div className="space-y-3">
                  <span className={`text-[10px] font-mono uppercase font-bold flex items-center space-x-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Zero-Trust Security Controls:</span>
                  </span>
                  <ul className="space-y-2">
                    {activeDetail.securityGuardrails.map((rule, idx) => (
                      <li key={idx} className={`flex items-start space-x-2 text-xs p-2.5 rounded-xl border ${
                        isDark ? 'bg-[#151824] border-[#242838] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tab 4: TYPE SCHEMA & CONTRACT */}
              {activeTab === 'spec' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      TypeScript / Zod Contract:
                    </span>
                    <span className="text-[10px] font-mono text-blue-400">Auto-Generated</span>
                  </div>
                  <pre className={`p-3 rounded-xl border text-[11px] font-mono overflow-x-auto ${
                    isDark ? 'bg-[#090A0E] border-[#1F2332] text-blue-300' : 'bg-slate-900 text-blue-200'
                  }`}>
                    <code>{activeDetail.zodSnippet || '// Contract schema verified'}</code>
                  </pre>
                </div>
              )}

            </div>

            {/* Footer Interactive Hint */}
            <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
              isDark ? 'bg-[#151724] border-[#242838] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Click another node to switch inspector focus.</span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
