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
  Layers,
  ChevronRight,
  Shield,
  Cpu
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
      category: 'Client Presentation',
      tech: `${frontend} • ${styling}`,
      role: 'Handles UI state, client interactions, optimistic state updates, and secure local token storage.',
      protocol: isDesktop ? 'Native IPC / Bridge' : isCLI ? 'Stdio Stream' : 'HTTPS / WSS (TLS 1.3)',
      latencyExpectation: '< 16ms (60fps render loop)',
      concurrencyModel: 'Event-driven UI Main Thread + Background Isolates',
      securityGuardrails: [
        'Strict Content Security Policy (CSP)',
        'Zero API keys embedded in client bundle',
        'Automatic XSS input encoding & sanitization'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const ClientStateSchema = z.object({\n  sessionToken: z.string().jwt(),\n  userRole: z.enum(['admin', 'member']),\n  theme: z.enum(['dark', 'light'])\n});`
    },
    gateway: {
      id: 'gateway',
      title: '2. Edge Gateway & Security Ingress',
      category: 'Ingress & Security Proxy',
      tech: isDesktop ? 'Tauri IPC Bridge / Rust Kernel' : isCLI ? 'CLI Shell Parser' : 'Cloudflare Edge / Reverse Proxy Guard',
      role: 'Terminates TLS/SSL, enforces rate limiting, verifies JWT authorization signatures, and protects against DDoS attacks.',
      protocol: 'HTTPS / HTTP/2 & HTTP/3',
      latencyExpectation: '< 10ms Edge Turnaround',
      concurrencyModel: 'Globally distributed non-blocking edge workers',
      securityGuardrails: [
        'DDoS mitigation & adaptive rate limiting',
        'Automated CORS origin whitelist validation',
        'Cryptographic JWT payload verification'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const IngressHeaderSchema = z.object({\n  authorization: z.string().regex(/^Bearer\\s+[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*$/),\n  'x-request-id': z.string().uuid()\n});`
    },
    compute: {
      id: 'compute',
      title: '3. Core Application & Compute Engine',
      category: 'Business Domain & Services',
      tech: backend,
      role: 'Executes core domain logic, enforces data invariants, validates payload mutations, and dispatches domain events.',
      protocol: 'Internal Async RPC / REST',
      latencyExpectation: '< 45ms P95 Latency',
      concurrencyModel: 'Async Non-Blocking Event Loop / Worker Pool',
      securityGuardrails: [
        'Strict schema validation on 100% of payloads',
        'Role-Based Access Control (RBAC) enforcement',
        'Structured audit logging with correlation IDs'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const MutationSchema = z.object({\n  entityId: z.string().cuid(),\n  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),\n  version: z.number().int()\n});`
    },
    database: {
      id: 'database',
      title: '4. Data Persistence & Speed Cache Tier',
      category: 'Data Durability & ACID',
      tech: `${database} + LRU Cache`,
      role: 'Provides ACID-compliant relational durability, foreign key integrity, and sub-1ms in-memory query caching.',
      protocol: 'Postgres Wire Protocol / SQLite FFI / RESP',
      latencyExpectation: '< 5ms DB / < 1ms Cache',
      concurrencyModel: 'Connection Pool with automated read-replicas',
      securityGuardrails: [
        'AES-256 encryption at rest & TLS in transit',
        'Parameterized queries preventing SQL injection',
        'Point-in-Time Recovery (PITR) automated backups'
      ],
      zodSnippet: `import { z } from 'zod';\n\nexport const DBRecordSchema = z.object({\n  id: z.string().uuid(),\n  createdAt: z.string().datetime(),\n  updatedAt: z.string().datetime()\n});`
    }
  };

  const activeDetail = nodeDetailsMap[selectedNode] || nodeDetailsMap.compute;

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden relative font-sans ${
      isDark 
        ? 'bg-[#090A0F] border-[#1C1F2E] text-slate-100 shadow-2xl' 
        : 'bg-white border-slate-200 text-slate-900 shadow-xl'
    } ${isExpanded ? 'fixed inset-4 z-50 p-6 overflow-y-auto' : 'p-6'}`}>
      
      {/* Dynamic Background Mesh Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#3b82f60d_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

      {/* Control Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b dark:border-[#1A1D2B] border-slate-200">
        
        {/* Title Info */}
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-xs shrink-0">
            <Network className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h4 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Live System Architecture Topology
              </h4>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Production Blueprint</span>
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8A8C9E]' : 'text-slate-500'}`}>
              End-to-end data pipeline & infrastructure node flow. Click any tier to inspect specifications.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 self-start md:self-auto">
          
          {/* Traffic Simulation Button */}
          <button
            type="button"
            onClick={() => setIsSimulatingTraffic(!isSimulatingTraffic)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-mono flex items-center space-x-2 transition-all cursor-pointer ${
              isSimulatingTraffic
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : isDark
                  ? 'bg-[#141622] border-[#222638] text-slate-400 hover:text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isSimulatingTraffic ? <Pause className="w-3.5 h-3.5 text-blue-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isSimulatingTraffic ? 'Traffic Active' : 'Traffic Paused'}</span>
          </button>

          {/* Copy Mermaid */}
          <button
            type="button"
            onClick={handleCopyMermaid}
            className={`text-xs px-3 py-1.5 rounded-lg border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
              copiedMermaid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isDark
                  ? 'bg-[#141622] border-[#222638] text-slate-300 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {copiedMermaid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedMermaid ? 'Copied Mermaid' : 'Mermaid'}</span>
          </button>

          {/* Copy JSON */}
          <button
            type="button"
            onClick={handleCopyJsonSpec}
            className={`text-xs px-3 py-1.5 rounded-lg border font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
              copiedJson
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isDark
                  ? 'bg-[#141622] border-[#222638] text-slate-300 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileJson className="w-3.5 h-3.5 text-purple-400" />}
            <span>{copiedJson ? 'Copied JSON' : 'JSON Spec'}</span>
          </button>

          {/* Fullscreen Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              isDark
                ? 'bg-[#141622] border-[#222638] text-slate-400 hover:text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Horizontal Topology Stream Canvas */}
      <div className="relative z-10 pt-6 pb-2 overflow-x-auto">
        <div className="min-w-[760px] grid grid-cols-4 gap-4 relative">
          
          {/* Connecting Animated SVG Overlay Vector Line */}
          {isSimulatingTraffic && (
            <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 pointer-events-none z-0">
              <div className="w-full h-full bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-emerald-500/30" />
              <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden">
                <div className="w-20 h-full bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          )}

          {/* NODE 1: Client & Ingress */}
          <div
            onClick={() => setSelectedNode('client')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative z-10 ${
              selectedNode === 'client'
                ? isDark
                  ? 'bg-[#121626] border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/40'
                  : 'bg-blue-50 border-blue-600 shadow-md ring-1 ring-blue-500/30'
                : isDark
                  ? 'bg-[#10121C] border-[#1E2232] hover:border-[#2E344A]'
                  : 'bg-white border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                1. Client Tier
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 16ms</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${selectedNode === 'client' ? 'bg-blue-600 text-white' : isDark ? 'bg-[#1A1E2E] text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
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

            <div className="mt-3 pt-2.5 border-t dark:border-[#1E2232] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Protocol</span>
              <span className="text-slate-300 font-semibold">{isDesktop ? 'IPC' : 'WSS / HTTPS'}</span>
            </div>
          </div>

          {/* NODE 2: Gateway Ingress */}
          <div
            onClick={() => setSelectedNode('gateway')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative z-10 ${
              selectedNode === 'gateway'
                ? isDark
                  ? 'bg-[#1C1810] border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/40'
                  : 'bg-amber-50 border-amber-600 shadow-md ring-1 ring-amber-500/30'
                : isDark
                  ? 'bg-[#10121C] border-[#1E2232] hover:border-[#2E344A]'
                  : 'bg-white border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                2. Gateway Ingress
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 10ms</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${selectedNode === 'gateway' ? 'bg-amber-500 text-slate-950 font-bold' : isDark ? 'bg-[#1A1E2E] text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
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

            <div className="mt-3 pt-2.5 border-t dark:border-[#1E2232] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Guardrails</span>
              <span className="text-amber-400 font-semibold">TLS 1.3 / DDoS</span>
            </div>
          </div>

          {/* NODE 3: Compute & AI */}
          <div
            onClick={() => setSelectedNode('compute')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative z-10 ${
              selectedNode === 'compute'
                ? isDark
                  ? 'bg-[#181224] border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/40'
                  : 'bg-purple-50 border-purple-600 shadow-md ring-1 ring-purple-500/30'
                : isDark
                  ? 'bg-[#10121C] border-[#1E2232] hover:border-[#2E344A]'
                  : 'bg-white border-slate-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                3. Core Compute
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 45ms</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${selectedNode === 'compute' ? 'bg-purple-600 text-white' : isDark ? 'bg-[#1A1E2E] text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
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

            <div className="mt-3 pt-2.5 border-t dark:border-[#1E2232] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Domain Logic</span>
              <span className="text-purple-400 font-semibold">Strict Zod</span>
            </div>
          </div>

          {/* NODE 4: Persistence & Cache */}
          <div
            onClick={() => setSelectedNode('database')}
            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative z-10 ${
              selectedNode === 'database'
                ? isDark
                  ? 'bg-[#101C18] border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40'
                  : 'bg-emerald-50 border-emerald-600 shadow-md ring-1 ring-emerald-500/30'
                : isDark
                  ? 'bg-[#10121C] border-[#1E2232] hover:border-[#2E344A]'
                  : 'bg-white border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                4. Data Tier
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">&lt; 1ms Cache</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${selectedNode === 'database' ? 'bg-emerald-600 text-white' : isDark ? 'bg-[#1A1E2E] text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
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

            <div className="mt-3 pt-2.5 border-t dark:border-[#1E2232] border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Durability</span>
              <span className="text-emerald-400 font-semibold">ACID Relational</span>
            </div>
          </div>

        </div>
      </div>

      {/* Selected Node Technical Inspector Panel */}
      <div className="relative z-10 mt-6 pt-5 border-t dark:border-[#1A1D2B] border-slate-200">
        <div className={`p-5 rounded-xl border ${
          isDark ? 'bg-[#0E1018] border-[#1C2030]' : 'bg-slate-50 border-slate-200'
        }`}>
          
          {/* Inspector Header Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b dark:border-[#1A1D2B] border-slate-200">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {activeDetail.category}
              </span>
              <h5 className={`text-sm font-bold mt-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeDetail.title}
              </h5>
            </div>

            <div className={`p-1 rounded-lg border flex items-center space-x-1 text-xs font-medium ${
              isDark ? 'bg-[#141724] border-[#222638]' : 'bg-white border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1 rounded transition-all cursor-pointer text-[11px] ${
                  activeTab === 'overview'
                    ? isDark ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-900 text-white'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                Overview & Metrics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`px-3 py-1 rounded transition-all cursor-pointer text-[11px] ${
                  activeTab === 'security'
                    ? isDark ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-900 text-white'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                Security Guardrails
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('spec')}
                className={`px-3 py-1 rounded transition-all cursor-pointer text-[11px] ${
                  activeTab === 'spec'
                    ? isDark ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-900 text-white'
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Architectural Role
                  </span>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {activeDetail.role}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Protocol & Wire Standard
                  </span>
                  <p className={`text-xs font-mono font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                    {activeDetail.protocol}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-mono uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Concurrency Model
                  </span>
                  <p className={`text-xs font-mono ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    {activeDetail.concurrencyModel}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activeDetail.securityGuardrails.map((rule, idx) => (
                  <li key={idx} className={`p-3 rounded-lg border text-xs flex items-start space-x-2 ${
                    isDark ? 'bg-[#121522] border-[#202538] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            )}

            {activeTab === 'spec' && (
              <pre className={`p-3.5 rounded-lg border text-xs font-mono overflow-x-auto ${
                isDark ? 'bg-[#06070B] border-[#1B1E2E] text-blue-300' : 'bg-slate-900 text-blue-200'
              }`}>
                <code>{activeDetail.zodSnippet || '// Contract schema verified'}</code>
              </pre>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
