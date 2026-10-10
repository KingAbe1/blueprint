import React, { useState } from 'react';
import {
  Layers,
  ChevronRight,
  Database,
  Server,
  Monitor,
  GitBranch,
  Shield,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode,
  Workflow,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { sanitizeDatabaseName, sanitizeDatabaseEvidence } from '../../services/architectureAnalysisService';

interface ArchitectureTopologyDiagramProps {
  analysis: CodebaseAnalysis;
}

export const ArchitectureTopologyDiagram: React.FC<ArchitectureTopologyDiagramProps> = React.memo(({ analysis }) => {
  const { isDark } = useTheme();
  const [selectedNode, setSelectedNode] = useState<'client' | 'server' | 'database' | 'delivery'>('server');

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const topology = analysis.architecture?.topology || 'Modular Application';
  const confidence = analysis.architecture?.confidence || 'medium';
  const rawDbName = analysis.architecture?.database.name;
  const rawDbEvidence = analysis.architecture?.database.evidence;
  const databaseName = sanitizeDatabaseName(rawDbName, rawDbEvidence) || 'Not Detected';
  const databaseEvidence = sanitizeDatabaseEvidence(rawDbEvidence, databaseName);
  const dbConfidence = analysis.architecture?.database.confidence || 'low';

  // Details data for the interactive node inspector
  const nodeDetails = {
    client: {
      step: '01',
      title: 'Presentation & Client Layer',
      badge: `${analysis.frameworks[0] || 'Frontend'} UI Layer`,
      description: 'Client component trees, interactive route pages, client-side state hydration, and rendering lifecycle.',
      metrics: [
        { label: 'Page Routes', value: analysis.nextjs ? String(analysis.nextjs.appRouteCount + analysis.nextjs.pagesRouteCount) : `${analysis.languages[0]?.files || 0} views` },
        { label: 'Client Framework', value: analysis.frameworks[0] || 'React' },
        { label: 'Primary Language', value: analysis.languages[0]?.name || 'TypeScript' },
      ],
      signals: [
        `${analysis.frameworks[0] || 'React'} Component Hierarchy`,
        analysis.nextjs
          ? `${analysis.nextjs.appRouteCount + analysis.nextjs.pagesRouteCount} Total client route pages declared`
          : `${analysis.languages[0]?.files || 0} View templates & source files`,
        'Interactive client-side state hydration & view lifecycle',
      ],
      files: (analysis.entryPoints || []).filter(p => !p.toLowerCase().includes('page.')).slice(0, 2),
      status: 'Active',
      statusColor: isDark ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-blue-700 bg-blue-50 border border-blue-200',
    },
    server: {
      step: '02',
      title: 'Execution Boundary & Server Logic',
      badge: analysis.nextjs?.apiRouteCount ? `${analysis.nextjs.apiRouteCount} API Endpoints` : 'Server Runtime Boundary',
      description: 'Backend routing, API boundary handlers, Server Actions, edge middleware, and execution orchestration.',
      metrics: [
        { label: 'Topology Shape', value: topology },
        { label: 'API Endpoints', value: analysis.nextjs ? String(analysis.nextjs.apiRouteCount) : 'Inferred' },
        { label: 'Confidence', value: confidence.toUpperCase() },
      ],
      signals: [
        `Architecture Shape: ${topology}`,
        `Confidence Level: ${confidence.toUpperCase()}`,
        ...(analysis.nextjs?.apiRouteCount ? [`${analysis.nextjs.apiRouteCount} Server API endpoints routed`] : []),
        ...(analysis.architecture?.evidence || []).filter(e => !e.toLowerCase().includes('router')).slice(0, 2),
      ],
      files: [
        ...(analysis.nextjs?.requestBoundaryFiles || []),
        ...(analysis.nextjs?.configFiles || []),
      ].filter((f, idx, arr) => arr.indexOf(f) === idx).slice(0, 4),
      status: confidence === 'high' ? 'Verified' : 'Inferred',
      statusColor: confidence === 'high'
        ? (isDark ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border border-emerald-200')
        : (isDark ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-blue-700 bg-blue-50 border border-blue-200'),
    },
    database: {
      step: '03',
      title: 'Persistence & Data Storage',
      badge: databaseName !== 'Not assessed' ? databaseName : 'No DB Manifests',
      description: 'Database engines, ORM schemas, migration history, connection pooling, and transactional persistence patterns.',
      metrics: [
        { label: 'Detected Engine', value: databaseName !== 'Not assessed' ? databaseName : 'None' },
        { label: 'Signal Confidence', value: dbConfidence.toUpperCase() },
        { label: 'Schema Manifests', value: databaseEvidence.length > 0 ? 'Detected' : 'Unconfirmed' },
      ],
      signals: [
        `Database Engine: ${databaseName}`,
        `Signal Confidence: ${dbConfidence.toUpperCase()}`,
        ...databaseEvidence.slice(0, 3),
      ],
      files: [
        ...(analysis.structurePaths || []).filter(p => /(^|\/)(schema\.prisma|migrations?\/|drizzle\.config|schema\.sql)$/i.test(p)),
        ...databaseEvidence
          .map(e => e.match(/(?:Found schema manifest:\s*|Found\s+)?([a-zA-Z0-9_/.-]+\.(?:prisma|sql|ts|js|json))/i)?.[1])
          .filter((p): p is string => Boolean(p)),
      ].filter((v, idx, arr) => arr.indexOf(v) === idx).slice(0, 3),
      status: databaseName !== 'Not assessed' ? 'Detected' : 'Unconfirmed',
      statusColor: databaseName !== 'Not assessed'
        ? (isDark ? 'text-violet-400 bg-violet-500/10 border border-violet-500/20' : 'text-violet-700 bg-violet-50 border border-violet-200')
        : (isDark ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-amber-700 bg-amber-50 border border-amber-200'),
    },
    delivery: {
      step: '04',
      title: 'Source Control & Delivery Pipeline',
      badge: analysis.pipeline?.workflows.length ? `${analysis.pipeline.workflows.length} GitHub Actions` : 'Standard Git Repository',
      description: 'Version control branch policy, pull request automation, continuous integration workflows, and production deployments.',
      metrics: [
        { label: 'Git Tracking', value: analysis.git?.tracked ? 'Tracked' : 'Local' },
        { label: 'Active Branch', value: analysis.git?.branch || 'main' },
        { label: 'CI Workflows', value: String(analysis.pipeline?.workflows.length || 0) },
      ],
      signals: [
        analysis.git?.tracked ? `Git branch: ${analysis.git.branch || 'main'}` : 'Git: untracked',
        analysis.pipeline?.deploymentTargets.length ? `Deployment target: ${analysis.pipeline.deploymentTargets.join(', ')}` : 'No explicit cloud deployment target',
        ...(analysis.pipeline?.workflows.slice(0, 2).map(w => `Workflow: ${w.name}`) || []),
      ],
      files: analysis.pipeline?.workflows.map(w => w.path).slice(0, 4) || [],
      status: analysis.pipeline?.workflows.length ? 'Automated' : 'Manual',
      statusColor: analysis.pipeline?.workflows.length
        ? (isDark ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border border-emerald-200')
        : (isDark ? 'text-slate-400 bg-slate-500/10 border border-slate-500/20' : 'text-slate-600 bg-slate-100 border border-slate-200'),
    },
  };

  const active = nodeDetails[selectedNode];

  const tiers = [
    { id: 'client', step: '01', title: 'Presentation', sub: `${analysis.frameworks[0] || 'Frontend'} UI`, icon: Monitor, color: 'text-blue-500', glow: 'blue' },
    { id: 'server', step: '02', title: 'Execution Boundary', sub: topology, icon: Server, color: 'text-emerald-500', glow: 'emerald' },
    { id: 'database', step: '03', title: 'Persistence & Storage', sub: databaseName !== 'Not assessed' ? databaseName : 'No DB Detected', icon: Database, color: 'text-violet-500', glow: 'violet' },
    { id: 'delivery', step: '04', title: 'Source & Pipeline', sub: analysis.pipeline?.workflows.length ? `${analysis.pipeline.workflows.length} Workflows` : 'Git Repo', icon: GitBranch, color: 'text-amber-500', glow: 'amber' },
  ] as const;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      {/* Title & Assessment Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <Workflow className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Architecture Topology Flow
            </h3>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide border ${
          confidence === 'high'
            ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
            : (isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700')
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${confidence === 'high' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          {confidence} confidence assessment
        </span>
      </div>

      {/* Connected 4-Tier Interactive Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 relative">
        {tiers.map((tier, index) => {
          const isSelected = selectedNode === tier.id;
          const Icon = tier.icon;
          return (
            <div key={tier.id} className="relative group">
              <button
                type="button"
                onClick={() => setSelectedNode(tier.id)}
                className={`w-full flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-150 ${
                  isSelected
                    ? (isDark
                        ? 'border-blue-500/80 bg-blue-500/10 ring-1 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-500/40 shadow-xs')
                    : (isDark
                        ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300')
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${tier.color}`} />
                      <span className={`font-mono text-[9px] font-semibold uppercase ${tier.color}`}>
                        Tier {tier.step}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                    )}
                  </div>
                  <h4 className={`text-xs font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {tier.title}
                  </h4>
                </div>
                <p className={`mt-2 text-[10px] truncate ${muted}`}>
                  {tier.sub}
                </p>
              </button>

              {/* Connecting arrow pill between cards on desktop */}
              {index < tiers.length - 1 && (
                <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-full border shadow-2xs ${
                    isDark ? 'border-white/[0.1] bg-[#1a1b1f] text-slate-400' : 'border-slate-200 bg-white text-slate-500'
                  }`}>
                    <ChevronRight className="h-2.5 w-2.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Node Detailed Inspector - Balanced 3-Column Glass Panel */}
      <div className={`mt-3.5 rounded-xl border p-4 ${
        isDark ? 'border-white/[0.07] bg-black/25' : 'border-slate-200/90 bg-slate-50/60'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3.5 ${
          isDark ? 'border-white/[0.06]' : 'border-slate-200/70'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold text-blue-500">
                [TIER {active.step}]
              </span>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {active.title}
              </h4>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${active.statusColor}`}>
                ● {active.status}
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 leading-relaxed ${muted}`}>
              {active.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Col 1: Telemetry Metrics */}
          <div className="space-y-2">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${muted}`}>Tier Telemetry</p>
            <div className="space-y-1.5">
              {active.metrics.map(m => (
                <div key={m.label} className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  isDark ? 'border-white/[0.05] bg-white/[0.02]' : 'border-slate-200/70 bg-white'
                }`}>
                  <span className={`text-[11px] ${muted}`}>{m.label}</span>
                  <span className={`font-semibold text-xs truncate max-w-[150px] ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2: Evidence Signals */}
          <div className="space-y-2">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${muted}`}>Detection Signals</p>
            <div className="space-y-1.5">
              {active.signals.map((sig, i) => (
                <div key={i} className={`p-2 rounded-lg border text-[11px] leading-4 flex items-start gap-2 ${
                  isDark ? 'border-white/[0.05] bg-white/[0.02] text-slate-300' : 'border-slate-200/70 bg-white text-slate-700'
                }`}>
                  <span className="text-blue-500 font-bold shrink-0 mt-0.5">✓</span>
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 3: Key Boundary & Evidence Files */}
          <div className="space-y-2">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${muted}`}>Key Manifests & Boundaries</p>
            {active.files.length > 0 ? (
              <div className="space-y-1.5">
                {active.files.map((file, i) => (
                  <div key={i} className={`flex items-center gap-2 font-mono text-[11px] px-2.5 py-1.5 rounded-lg border truncate transition-colors ${
                    isDark ? 'border-white/[0.05] bg-black/30 text-blue-300 hover:bg-black/40' : 'border-slate-200/70 bg-white text-blue-700 hover:bg-slate-50'
                  }`} title={file}>
                    <FileCode className="h-3 w-3 shrink-0 text-blue-400" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`p-2.5 text-[11px] rounded-lg border ${isDark ? 'border-white/[0.04] bg-white/[0.01]' : 'border-slate-200/60 bg-white'} ${muted}`}>
                Integrated into application root framework.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
