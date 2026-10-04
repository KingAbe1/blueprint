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
  HardDrive, 
  Network, 
  Pause, 
  Play, 
  FileJson, 
  CheckCircle2, 
  Cpu, 
  Activity, 
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
  const [copiedZod, setCopiedZod] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSimulatingTraffic, setIsSimulatingTraffic] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'spec'>('overview');

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
    return `graph LR
    %% Blueprint Architectural Topology Diagram
    %% Project: ${projectName}
    %% Stack: ${recommendation.name}

    subgraph Client ["1. Client Tier"]
        UI["🖥️ ${frontend}"]
    end

    subgraph Ingress ["2. Gateway & Security"]
        Gateway["⚡ API Gateway / Reverse Proxy"]
    end

    subgraph Compute ["3. Application & Compute Engine"]
        API["⚙️ Core Backend (${backend})"]
        ${isAIApp ? 'AI["🤖 AI Inference Engine"]' : 'Worker["🔄 Async Task Queue"]'}
    end

    subgraph Data ["4. Persistence & Storage"]
        DB[("🗄️ ${database}")]
        Cache[("⚡ In-Memory Cache")]
    end

    UI -->|TLS 1.3 / WSS| Gateway
    Gateway -->|Sanitized RPC| API
    API -->|Async Stream| ${isAIApp ? 'AI' : 'Worker'}
    API -->|Read / Write| DB
    API -->|Sub-1ms Query| Cache`;
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
      topology: {
        client: { stack: frontend, styling, target: deployment },
        ingress: { protocol: 'TLS 1.3', auth: 'Bearer JWT', ddosGuard: true },
        compute: { engine: backend, asyncWorkers: isAIApp ? 'LLM Stream' : 'Job Queue' },
        data: { primaryDb: database, cache: 'LRU / Redis' }
      }
    };
    navigator.clipboard.writeText(JSON.stringify(jsonSpec, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const nodeDetailsMap: Record<string, NodeDetail> = {
    client: {
      id: 'client',
      title: '1. Presentation & Client UI Tier',
      category: 'Client Presentation Tier',
      tech: `${frontend} • ${styling}`,
      role: 'Manages user interaction, reactive state streams, optimistic UI updates, and secure JWT authentication headers.',
      protocol: isDesktop ? 'Native Desktop IPC Bridge' : isCLI ? 'Stdio Binary Stream' : 'HTTPS / WebSocket (TLS 1.3)',
      latencyExpectation: '< 16ms (60fps UI Render Loop)',
      concurrencyModel: 'Event-driven main thread + Web Worker background isolates',
      securityGuardrails: [
        'Strict Content Security Policy (CSP) & CORS origin gates',
        'Zero embedded API keys inside client JavaScript bundle',
        'Automatic input sanitization protecting against XSS'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const ClientStateSchema = z.object({\n  sessionToken: z.string().jwt(),\n  userRole: z.enum(['admin', 'member']),\n  theme: z.enum(['dark', 'light'])\n});`
    },
    gateway: {
      id: 'gateway',
      title: '2. Edge Gateway & Security Ingress',
      category: 'Security Ingress & Proxy',
      tech: isDesktop ? 'Tauri IPC Bridge / Rust Kernel' : isCLI ? 'CLI Shell Parser' : 'Cloudflare Edge / Reverse Proxy Guard',
      role: 'Terminates TLS/SSL, enforces rate limiting, verifies JWT authorization signatures, and mitigates DDoS attempts.',
      protocol: 'HTTPS / HTTP/2 & HTTP/3',
      latencyExpectation: '< 10ms Global Edge Turnaround',
      concurrencyModel: 'Globally distributed non-blocking edge workers',
      securityGuardrails: [
        'Automated DDoS mitigation & token bucket rate limiting',
        'CORS origin whitelist validation',
        'Cryptographic JWT payload signature verification'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const IngressHeaderSchema = z.object({\n  authorization: z.string().regex(/^Bearer\\s+[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*$/),\n  'x-request-id': z.string().uuid()\n});`
    },
    compute: {
      id: 'compute',
      title: '3. Core Application & Compute Engine',
      category: 'Business Domain & Compute Engine',
      tech: backend,
      role: 'Executes core domain logic, enforces business invariants, processes mutation transactions, and dispatches async domain events.',
      protocol: 'Internal Async RPC / REST / gRPC',
      latencyExpectation: '< 45ms P95 Latency',
      concurrencyModel: 'Async Non-Blocking Event Loop / Worker Pool',
      securityGuardrails: [
        'Strict Zod schema runtime validation on 100% of payloads',
        'Role-Based Access Control (RBAC) permission checks',
        'Structured correlation ID audit logs'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const MutationSchema = z.object({\n  entityId: z.string().cuid(),\n  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),\n  version: z.number().int()\n});`
    },
    database: {
      id: 'database',
      title: '4. Data Persistence & Speed Cache Tier',
      category: 'Data Durability & ACID Storage',
      tech: `${database} + LRU Cache`,
      role: 'Provides ACID-compliant relational storage, foreign key integrity, and sub-1ms in-memory query caching.',
      protocol: 'Postgres Wire Protocol / SQLite FFI / RESP',
      latencyExpectation: '< 5ms DB / < 1ms Cache',
      concurrencyModel: 'Connection Pool with automated read-replicas',
      securityGuardrails: [
        'AES-256 encryption at rest & TLS in transit',
        'Parameterized SQL queries preventing injection attacks',
        'Point-in-Time Recovery (PITR) automated backups'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const DBRecordSchema = z.object({\n  id: z.string().uuid(),\n  createdAt: z.string().datetime(),\n  updatedAt: z.string().datetime()\n});`
    }
  };

  const activeDetail = nodeDetailsMap[selectedNode] || nodeDetailsMap.compute;

  const handleCopyZod = () => {
    if (activeDetail.zodSnippet) {
      navigator.clipboard.writeText(activeDetail.zodSnippet);
      setCopiedZod(true);
      setTimeout(() => setCopiedZod(false), 2000);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden relative font-sans ${
      isDark 
        ? 'bg-[#0B0C10] border-white/[0.08] text-slate-100 shadow-2xl' 
        : 'bg-white border-slate-200/80 text-slate-900 shadow-lg'
    } ${isExpanded ? 'fixed inset-4 z-50 p-6 overflow-y-auto' : 'p-6'}`}>
      
      {/* Subtle Engineering Grid */}
      <div className={`absolute inset-0 pointer-events-none ${
        isDark 
          ? 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.06),transparent)]' 
          : 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.03),transparent)]'
      }`} />
      
      {/* Control Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b dark:border-white/[0.08] border-slate-200/80">
        
        {/* Title & Status */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
            <Network className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h4 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                System Architecture Topology
              </h4>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border flex items-center space-x-1.5 ${
                isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Production Blueprint</span>
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8A8C9E]' : 'text-slate-500'}`}>
              End-to-end data pipeline & infrastructure node flow. Click any tier to inspect specifications.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          {/* Traffic Simulation Toggle */}
          <button
            type="button"
            onClick={() => setIsSimulatingTraffic(!isSimulatingTraffic)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-mono font-medium flex items-center space-x-2 transition-all cursor-pointer ${
              isSimulatingTraffic
                ? isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
                : isDark ? 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isSimulatingTraffic ? <Pause className="w-3.5 h-3.5 text-blue-500" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isSimulatingTraffic ? 'Traffic Active' : 'Traffic Paused'}</span>
          </button>

          {/* Copy Mermaid */}
          <button
            type="button"
            onClick={handleCopyMermaid}
            className={`text-xs px-3 py-1.5 rounded-xl border font-mono font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              copiedMermaid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isDark
                  ? 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            {copiedMermaid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedMermaid ? 'Copied' : 'Mermaid'}</span>
          </button>

          {/* Copy JSON Spec */}
          <button
            type="button"
            onClick={handleCopyJsonSpec}
            className={`text-xs px-3 py-1.5 rounded-xl border font-mono font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              copiedJson
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isDark
                  ? 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileJson className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedJson ? 'Copied' : 'JSON Spec'}</span>
          </button>

          {/* Fullscreen Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDark
                ? 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs'
            }`}
            title={isExpanded ? "Collapse Diagram" : "Expand Fullscreen"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 4 Architecture Nodes Canvas */}
      <div className="relative z-10 pt-5 pb-2">
        <div className="min-w-[760px] grid grid-cols-4 gap-4 relative py-2">

          {/* Subtly Animated Vector Flow Connection Line */}
          <svg className="absolute top-1/2 left-0 right-0 -translate-y-1/2 w-full h-4 pointer-events-none z-0 overflow-visible">
            <line x1="10%" y1="50%" x2="90%" y2="50%" stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)"} strokeWidth="2" strokeDasharray="5 5" />
            {isSimulatingTraffic && (
              <line 
                x1="10%" y1="50%" x2="90%" y2="50%" 
                stroke="#3B82F6" 
                strokeWidth="2.5" 
                strokeDasharray="6 14"
                className="animate-[shimmer_1.8s_linear_infinite]"
              />
            )}
          </svg>

          {/* TIER 1: CLIENT */}
          <div
            onClick={() => setSelectedNode('client')}
            className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative z-10 group ${
              selectedNode === 'client'
                ? isDark
                  ? 'bg-gradient-to-br from-blue-950/40 via-[#101322] to-blue-950/20 border-2 border-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.2)] -translate-y-0.5'
                  : 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 border-2 border-blue-600 shadow-[0_4px_20px_rgba(59,130,246,0.12)] -translate-y-0.5'
                : isDark
                  ? 'bg-[#10121A] border-white/[0.08] hover:border-blue-500/40 hover:-translate-y-0.5'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:-translate-y-0.5 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                selectedNode === 'client' 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-extrabold' 
                  : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                1. Client Tier
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-medium">&lt; 16ms</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                selectedNode === 'client' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : isDark 
                    ? 'bg-[#181C2E] border border-blue-500/20 text-blue-400' 
                    : 'bg-blue-50 border border-blue-100 text-blue-600'
              }`}>
                {isMobile ? <Globe className="w-4 h-4" /> : isDesktop ? <HardDrive className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <h5 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {frontend}
                </h5>
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-[#8A8C9E]' : 'text-slate-500'}`}>
                  {styling}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t dark:border-white/[0.08] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span>Protocol</span>
              <span className="font-semibold">{isDesktop ? 'IPC Bridge' : 'WSS / HTTPS'}</span>
            </div>
          </div>

          {/* TIER 2: GATEWAY */}
          <div
            onClick={() => setSelectedNode('gateway')}
            className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative z-10 group ${
              selectedNode === 'gateway'
                ? isDark
                  ? 'bg-gradient-to-br from-blue-950/40 via-[#101322] to-blue-950/20 border-2 border-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.2)] -translate-y-0.5'
                  : 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 border-2 border-blue-600 shadow-[0_4px_20px_rgba(59,130,246,0.12)] -translate-y-0.5'
                : isDark
                  ? 'bg-[#10121A] border-white/[0.08] hover:border-blue-500/40 hover:-translate-y-0.5'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:-translate-y-0.5 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                selectedNode === 'gateway' 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-extrabold' 
                  : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                2. Gateway Ingress
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-medium">&lt; 10ms</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                selectedNode === 'gateway' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : isDark 
                    ? 'bg-[#181C2E] border border-blue-500/20 text-blue-400' 
                    : 'bg-blue-50 border border-blue-100 text-blue-600'
              }`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  API Gateway & Edge
                </h5>
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-[#8A8C9E]' : 'text-slate-500'}`}>
                  JWT & Rate Limiter
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t dark:border-white/[0.08] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span>Guardrails</span>
              <span className="font-semibold">TLS 1.3 / DDoS</span>
            </div>
          </div>

          {/* TIER 3: COMPUTE */}
          <div
            onClick={() => setSelectedNode('compute')}
            className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative z-10 group ${
              selectedNode === 'compute'
                ? isDark
                  ? 'bg-gradient-to-br from-blue-950/40 via-[#101322] to-blue-950/20 border-2 border-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.2)] -translate-y-0.5'
                  : 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 border-2 border-blue-600 shadow-[0_4px_20px_rgba(59,130,246,0.12)] -translate-y-0.5'
                : isDark
                  ? 'bg-[#10121A] border-white/[0.08] hover:border-blue-500/40 hover:-translate-y-0.5'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:-translate-y-0.5 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                selectedNode === 'compute' 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-extrabold' 
                  : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                3. Core Compute
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-medium">&lt; 45ms</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                selectedNode === 'compute' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : isDark 
                    ? 'bg-[#181C2E] border border-blue-500/20 text-blue-400' 
                    : 'bg-blue-50 border border-blue-100 text-blue-600'
              }`}>
                <Server className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {backend}
                </h5>
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-[#8A8C9E]' : 'text-slate-500'}`}>
                  {isAIApp ? 'AI Agent Engine' : 'Async Worker Pool'}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t dark:border-white/[0.08] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span>Domain Logic</span>
              <span className="font-semibold">Strict Zod</span>
            </div>
          </div>

          {/* TIER 4: DATA */}
          <div
            onClick={() => setSelectedNode('database')}
            className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative z-10 group ${
              selectedNode === 'database'
                ? isDark
                  ? 'bg-gradient-to-br from-blue-950/40 via-[#101322] to-blue-950/20 border-2 border-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.2)] -translate-y-0.5'
                  : 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 border-2 border-blue-600 shadow-[0_4px_20px_rgba(59,130,246,0.12)] -translate-y-0.5'
                : isDark
                  ? 'bg-[#10121A] border-white/[0.08] hover:border-blue-500/40 hover:-translate-y-0.5'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:-translate-y-0.5 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                selectedNode === 'database' 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-extrabold' 
                  : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                4. Data Tier
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-medium">&lt; 1ms Cache</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                selectedNode === 'database' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : isDark 
                    ? 'bg-[#181C2E] border border-blue-500/20 text-blue-400' 
                    : 'bg-blue-50 border border-blue-100 text-blue-600'
              }`}>
                <Database className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {database}
                </h5>
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-[#8A8C9E]' : 'text-slate-500'}`}>
                  In-Memory LRU Cache
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t dark:border-white/[0.08] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span>Durability</span>
              <span className="font-semibold">ACID Relational</span>
            </div>
          </div>

        </div>
      </div>

      {/* Technical Inspector Panel */}
      <div className="relative z-10 mt-5 pt-4 border-t dark:border-white/[0.08] border-slate-200/80">
        <div className={`p-5 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0E1017] border-white/[0.08]' : 'bg-slate-50/80 border-slate-200/80 shadow-2xs'
        }`}>
          
          {/* Inspector Header & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b dark:border-white/[0.08] border-slate-200/80">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                {activeDetail.category}
              </span>
              <h5 className={`text-sm font-bold tracking-tight mt-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeDetail.title}
              </h5>
            </div>

            <div className={`p-1 rounded-xl border flex items-center space-x-1 text-xs font-medium shrink-0 ${
              isDark ? 'bg-[#141622] border-white/[0.08]' : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-semibold ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                Overview & Metrics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-semibold ${
                  activeTab === 'security'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                Security Guardrails
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('spec')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-semibold ${
                  activeTab === 'spec'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                Type Contract
              </button>
            </div>
          </div>

          {/* Inspector Body */}
          <div className="pt-4">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Architectural Role
                  </span>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {activeDetail.role}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Protocol & Wire Standard
                  </span>
                  <p className={`text-xs font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                    {activeDetail.protocol}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Concurrency Model
                  </span>
                  <p className={`text-xs font-mono font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                    {activeDetail.concurrencyModel}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activeDetail.securityGuardrails.map((rule, idx) => (
                  <li key={idx} className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                    isDark ? 'bg-[#121420] border-white/[0.08] text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ul>
            )}

            {activeTab === 'spec' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Zod Runtime Contract
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyZod}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono flex items-center space-x-1 transition-all cursor-pointer ${
                      copiedZod
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : isDark
                          ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {copiedZod ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    <span>{copiedZod ? 'Copied' : 'Copy Schema'}</span>
                  </button>
                </div>
                <pre className={`p-4 rounded-xl border text-xs font-mono overflow-x-auto ${
                  isDark ? 'bg-[#06070B] border-white/[0.08] text-blue-300' : 'bg-slate-900 text-blue-200 shadow-sm'
                }`}>
                  <code>{activeDetail.zodSnippet || '// Contract schema verified'}</code>
                </pre>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

export default SystemArchitectureDiagram;
