import React, { useState } from 'react';
import { 
  Globe, 
  Server, 
  Database, 
  Cpu, 
  ShieldCheck, 
  ArrowRight, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  Layers, 
  Sparkles, 
  Code2, 
  RefreshCw, 
  HardDrive, 
  Cloud,
  Network,
  Lock,
  Zap,
  Bot
} from 'lucide-react';
import { FrameworkRecommendation } from '../../types/project';

interface SystemArchitectureDiagramProps {
  recommendation: FrameworkRecommendation;
  isDark: boolean;
  projectName?: string;
}

interface NodeDetail {
  title: string;
  category: string;
  tech: string;
  role: string;
  protocol: string;
  latencyExpectation: string;
  concurrencyModel: string;
  securityGuardrails: string[];
}

export const SystemArchitectureDiagram: React.FC<SystemArchitectureDiagramProps> = ({
  recommendation,
  isDark,
  projectName = 'Application'
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>('compute');
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Node technical details database
  const nodeDetailsMap: Record<string, NodeDetail> = {
    client: {
      title: 'Client Application & UI Tier',
      category: 'Client Presentation',
      tech: `${frontend} + ${styling}`,
      role: 'Handles UI state, user interactions, local optimistic caching, and secure token storage.',
      protocol: isDesktop ? 'Native IPC / Secure Bridge' : isCLI ? 'Standard I/O Streams' : 'HTTPS / WSS (TLS 1.3)',
      latencyExpectation: '< 16ms (60fps render loop)',
      concurrencyModel: 'Event-driven UI Main Thread + Web Workers / Background Isolates',
      securityGuardrails: [
        'Strict Content Security Policy (CSP)',
        'Zero sensitive secrets in client bundle',
        'Automatic XSS sanitization & input encoding'
      ]
    },
    gateway: {
      title: 'Gateway, Edge & Security Proxy',
      category: 'Ingress Routing',
      tech: isDesktop ? 'Tauri IPC Bridge / Rust Core' : isCLI ? 'CLI Argument Parser' : 'Cloudflare Edge / Reverse Proxy',
      role: 'Terminates SSL, enforces IP rate limits, verifies JWT auth headers, and routes requests to healthy compute instances.',
      protocol: 'HTTPS / HTTP/2 & HTTP/3',
      latencyExpectation: '< 10ms edge turnaround',
      concurrencyModel: 'Globally distributed non-blocking edge workers',
      securityGuardrails: [
        'DDoS mitigation & adaptive rate limiting',
        'Automated CORS origin validation',
        'Signed cryptographic JWT token verification'
      ]
    },
    compute: {
      title: 'Core Application & Compute Engine',
      category: 'Business Domain & Services',
      tech: backend,
      role: 'Executes core domain logic, enforces business invariants, validates transactional mutations, and serializes responses.',
      protocol: 'Internal Async RPC / REST / gRPC',
      latencyExpectation: '< 45ms P95 latency',
      concurrencyModel: 'Async Event Loop / Multi-threaded Worker Pool',
      securityGuardrails: [
        'Strict schema validation on all inputs',
        'Role-Based Access Control (RBAC) verification per route',
        'Structured audit logging & telemetry metrics'
      ]
    },
    database: {
      title: 'Primary Storage & Persistence Layer',
      category: 'Data Durability & ACID',
      tech: database,
      role: 'Provides ACID-compliant storage, relational constraints, foreign keys, and indexes for instant query execution.',
      protocol: 'Postgres Wire Protocol / SQLite Direct C-FFI',
      latencyExpectation: '< 5ms query execution',
      concurrencyModel: 'Connection Pool with automatic retry & read replicas',
      securityGuardrails: [
        'Encrypted at rest (AES-256) and in transit (TLS)',
        'Parameterized queries (Zero SQL injection risk)',
        'Automated point-in-time recovery (PITR) backups'
      ]
    },
    cache: {
      title: 'In-Memory Cache & Session State',
      category: 'Low-Latency Cache',
      tech: isDesktop || isCLI ? 'In-Memory LRU Cache' : 'Redis / Cloudflare KV',
      role: 'Caches heavy query results, manages active user sessions, handles rate limit counters, and pub/sub channels.',
      protocol: 'RESP (Redis Protocol) / Memory Bus',
      latencyExpectation: '< 1ms response time',
      concurrencyModel: 'Single-threaded async in-memory event dispatch',
      securityGuardrails: [
        'Short-lived TTL expiration keys',
        'Auth token password hashing',
        'Memory cap limits with LRU eviction'
      ]
    },
    workers: {
      title: isAIApp ? 'AI Inference & Orchestration' : 'Async Background Task Engine',
      category: isAIApp ? 'AI & Model Pipeline' : 'Asynchronous Processing',
      tech: isAIApp ? 'Streaming LLM Pipeline + Vector Embeddings' : 'Async Worker Queue (BullMQ / Celery)',
      role: isAIApp 
        ? 'Orchestrates streaming AI responses, embeds text into vector index, and handles tool calling.'
        : 'Processes heavy background jobs, transactional emails, webhooks, and asynchronous reports.',
      protocol: 'Internal Message Queue / Worker Channel',
      latencyExpectation: 'Async decoupled execution',
      concurrencyModel: 'Distributed consumer workers with exponential backoff retries',
      securityGuardrails: [
        'Dead-letter queue (DLQ) for failed jobs',
        'Strict token rate limiting for external LLMs',
        'Idempotency keys on all mutation jobs'
      ]
    }
  };

  const activeDetail = selectedNode ? nodeDetailsMap[selectedNode] : nodeDetailsMap.compute;

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      isDark ? 'bg-[#0E1015] border-[#20232D]' : 'bg-slate-50/70 border-slate-200 shadow-2xs'
    } ${isExpanded ? 'fixed inset-4 z-50 p-6 overflow-y-auto' : 'p-5'}`}>
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b dark:border-[#1E212B] border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Live System Architecture Topology
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Production Blueprint</span>
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Click any architectural tier to inspect its concurrency model, security guardrails, and data flow.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleCopyMermaid}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
              copiedMermaid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isDark
                  ? 'bg-[#181A22] border-[#262834] text-slate-300 hover:text-white hover:border-[#383B4D]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {copiedMermaid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedMermaid ? 'Copied Mermaid Code!' : 'Copy Mermaid'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse view' : 'Expand full view'}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isDark
                ? 'bg-[#181A22] border-[#262834] text-slate-400 hover:text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
        
        {/* Visual Node-Flow Canvas (Left 8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Tier 1: Client & Ingress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                1. Presentation & Client Tier
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Target: {deployment}
              </span>
            </div>

            <div
              onClick={() => setSelectedNode('client')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedNode === 'client'
                  ? isDark
                    ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/40 shadow-xs'
                    : 'bg-blue-50 border-blue-600 ring-1 ring-blue-500/20 shadow-xs'
                  : isDark
                    ? 'bg-[#14161E] border-[#222530] hover:border-[#333748]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  selectedNode === 'client' ? 'bg-blue-600 text-white' : isDark ? 'bg-[#1D202B] text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  {isMobile ? <Globe className="w-4 h-4" /> : isDesktop ? <HardDrive className="w-4 h-4" /> : isCLI ? <Code2 className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                </div>
                <div>
                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {frontend}
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className={`text-[10px] font-mono ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                      Styling: <span className="font-semibold text-blue-400">{styling}</span>
                    </span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isDesktop ? 'Native Desktop UI' : isMobile ? 'Touch Mobile Native' : isCLI ? 'Terminal UI' : 'Responsive Web App'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  isDark ? 'bg-[#1F212D] text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isDesktop ? 'IPC Bridge' : isCLI ? 'Stdio' : 'HTTPS / WSS'}
                </span>
                <ArrowRight className={`w-3.5 h-3.5 ${selectedNode === 'client' ? 'text-blue-500' : 'text-slate-500'}`} />
              </div>
            </div>
          </div>

          {/* Connection Vector Indicator */}
          <div className="flex items-center justify-center -my-1">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-blue-500/40" />
              <div className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                TLS 1.3 / Auth Headers
              </div>
              <div className="w-0.5 h-3 bg-blue-500/40" />
            </div>
          </div>

          {/* Tier 2: Gateway & Ingress Security */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                2. Gateway & Ingress Guardrails
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Zero-Trust Ingress
              </span>
            </div>

            <div
              onClick={() => setSelectedNode('gateway')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedNode === 'gateway'
                  ? isDark
                    ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40 shadow-xs'
                    : 'bg-amber-50 border-amber-600 ring-1 ring-amber-500/20 shadow-xs'
                  : isDark
                    ? 'bg-[#14161E] border-[#222530] hover:border-[#333748]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  selectedNode === 'gateway' ? 'bg-amber-500 text-slate-950' : isDark ? 'bg-[#1D202B] text-amber-400' : 'bg-amber-50 text-amber-600'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isDesktop ? 'Secure Native IPC Gateway & Permissions' : isCLI ? 'CLI Parser & Environment Guard' : 'API Gateway, SSL & Rate Limiting'}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                    JWT Verification • DDoS Shield • Input Sanitize • CORS Gate
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  isDark ? 'bg-[#1F212D] text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  Edge Ingress
                </span>
                <ArrowRight className={`w-3.5 h-3.5 ${selectedNode === 'gateway' ? 'text-amber-500' : 'text-slate-500'}`} />
              </div>
            </div>
          </div>

          {/* Connection Vector Indicator */}
          <div className="flex items-center justify-center -my-1">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-purple-500/40" />
              <div className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Validated Payload / Internal RPC
              </div>
              <div className="w-0.5 h-3 bg-purple-500/40" />
            </div>
          </div>

          {/* Tier 3: Application Compute & Background Workers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                3. Application Core & Compute Services
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Domain Invariants
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Backend API */}
              <div
                onClick={() => setSelectedNode('compute')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  selectedNode === 'compute'
                    ? isDark
                      ? 'bg-purple-600/15 border-purple-500 ring-1 ring-purple-500/40 shadow-xs'
                      : 'bg-purple-50 border-purple-600 ring-1 ring-purple-500/20 shadow-xs'
                    : isDark
                      ? 'bg-[#14161E] border-[#222530] hover:border-[#333748]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    selectedNode === 'compute' ? 'bg-purple-600 text-white' : isDark ? 'bg-[#1D202B] text-purple-400' : 'bg-purple-50 text-purple-600'
                  }`}>
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {backend}
                    </div>
                    <div className={`text-[10px] font-mono ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                      Primary Compute Engine
                    </div>
                  </div>
                </div>
                <p className={`text-[10.5px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  Executes business domain logic, validates mutations, and enforces state machine rules.
                </p>
              </div>

              {/* Workers / AI Engine */}
              <div
                onClick={() => setSelectedNode('workers')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  selectedNode === 'workers'
                    ? isDark
                      ? 'bg-purple-600/15 border-purple-500 ring-1 ring-purple-500/40 shadow-xs'
                      : 'bg-purple-50 border-purple-600 ring-1 ring-purple-500/20 shadow-xs'
                    : isDark
                      ? 'bg-[#14161E] border-[#222530] hover:border-[#333748]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    selectedNode === 'workers' ? 'bg-purple-600 text-white' : isDark ? 'bg-[#1D202B] text-purple-400' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {isAIApp ? <Bot className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {isAIApp ? 'AI Inference & Orchestration' : 'Async Task Worker'}
                    </div>
                    <div className={`text-[10px] font-mono ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                      {isAIApp ? 'LLM & Vector Pipeline' : 'Background Job Queue'}
                    </div>
                  </div>
                </div>
                <p className={`text-[10.5px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  {isAIApp ? 'Streaming token generation, embedding similarity search, and model tool calls.' : 'Processes heavy async jobs, scheduled crons, and webhooks.'}
                </p>
              </div>
            </div>
          </div>

          {/* Connection Vector Indicator */}
          <div className="flex items-center justify-center -my-1">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-emerald-500/40" />
              <div className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connection Pool / ACID Transactions
              </div>
              <div className="w-0.5 h-3 bg-emerald-500/40" />
            </div>
          </div>

          {/* Tier 4: Persistence, Cache & Storage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                4. Data Persistence & Cache Tier
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                ACID & High-Speed Cache
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Database */}
              <div
                onClick={() => setSelectedNode('database')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  selectedNode === 'database'
                    ? isDark
                      ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500/40 shadow-xs'
                      : 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-500/20 shadow-xs'
                    : isDark
                      ? 'bg-[#14161E] border-[#222530] hover:border-[#333748]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    selectedNode === 'database' ? 'bg-emerald-600 text-white' : isDark ? 'bg-[#1D202B] text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {database}
                    </div>
                    <div className={`text-[10px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      Primary Source of Truth
                    </div>
                  </div>
                </div>
                <p className={`text-[10.5px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  ACID-compliant storage, relational integrity, foreign key constraints, and migrations.
                </p>
              </div>

              {/* Cache Layer */}
              <div
                onClick={() => setSelectedNode('cache')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  selectedNode === 'cache'
                    ? isDark
                      ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500/40 shadow-xs'
                      : 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-500/20 shadow-xs'
                    : isDark
                      ? 'bg-[#14161E] border-[#222530] hover:border-[#333748]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    selectedNode === 'cache' ? 'bg-emerald-600 text-white' : isDark ? 'bg-[#1D202B] text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {isDesktop || isCLI ? 'In-Memory Cache (LRU)' : 'Redis / Edge KV Store'}
                    </div>
                    <div className={`text-[10px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      Sub-Millisecond Query Cache
                    </div>
                  </div>
                </div>
                <p className={`text-[10.5px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  Session storage, rate-limit counters, hot-read cache, and real-time pub/sub channels.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Node Technical Inspector Drawer (Right 4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className={`p-4 rounded-xl border space-y-4 h-full flex flex-col justify-between ${
            isDark ? 'bg-[#13151D] border-[#242735]' : 'bg-white border-slate-200'
          }`}>
            <div className="space-y-3.5">
              
              {/* Header */}
              <div className="border-b pb-3 dark:border-[#222532] border-slate-200">
                <span className="text-[9px] font-mono uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  {activeDetail.category}
                </span>
                <h5 className={`text-xs font-bold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeDetail.title}
                </h5>
                <div className={`text-[11px] font-mono mt-0.5 text-blue-400`}>
                  {activeDetail.tech}
                </div>
              </div>

              {/* Architectural Role */}
              <div className="space-y-1">
                <span className={`text-[10px] font-mono uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Architectural Role:
                </span>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {activeDetail.role}
                </p>
              </div>

              {/* Protocol & Latency Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className={`p-2.5 rounded-lg border ${
                  isDark ? 'bg-[#171922] border-[#262837]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-[9px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Protocol / Wire</div>
                  <div className={`text-[11px] font-mono font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {activeDetail.protocol}
                  </div>
                </div>

                <div className={`p-2.5 rounded-lg border ${
                  isDark ? 'bg-[#171922] border-[#262837]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-[9px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Latency Target</div>
                  <div className={`text-[11px] font-mono font-semibold mt-0.5 text-emerald-400`}>
                    {activeDetail.latencyExpectation}
                  </div>
                </div>
              </div>

              {/* Concurrency Model */}
              <div className="space-y-1 pt-1">
                <span className={`text-[10px] font-mono uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Concurrency & Scaling:
                </span>
                <p className={`text-[11px] font-mono leading-relaxed ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                  {activeDetail.concurrencyModel}
                </p>
              </div>

              {/* Security Guardrails */}
              <div className="space-y-1.5 pt-1">
                <span className={`text-[10px] font-mono uppercase font-semibold flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span>Production Guardrails:</span>
                </span>
                <ul className="space-y-1 pl-1">
                  {activeDetail.securityGuardrails.map((rule, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5 text-[10.5px]">
                      <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Footer Tip */}
            <div className={`p-2.5 rounded-lg border text-[10px] font-mono ${
              isDark ? 'bg-[#181A24] border-[#282B3B] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              💡 Tip: Click another tier on the left to inspect its parameters.
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
