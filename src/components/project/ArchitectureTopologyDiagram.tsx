import React, { useState } from 'react';
import {
  Layers,
  ArrowRight,
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
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface ArchitectureTopologyDiagramProps {
  analysis: CodebaseAnalysis;
}

export const ArchitectureTopologyDiagram: React.FC<ArchitectureTopologyDiagramProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const [selectedNode, setSelectedNode] = useState<'client' | 'server' | 'database' | 'delivery'>('server');

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';

  const topology = analysis.architecture?.topology || 'Modular Application';
  const confidence = analysis.architecture?.confidence || 'medium';
  const databaseName = analysis.architecture?.database.name || 'Not Detected';
  const dbConfidence = analysis.architecture?.database.confidence || 'low';

  // Details data for the interactive node inspector
  const nodeDetails = {
    client: {
      title: 'Presentation & Client Layer',
      subtitle: analysis.nextjs ? `${analysis.nextjs.router}` : 'Frontend Component System',
      description: 'User interface components, pages, client-side routing, and rendering mechanisms.',
      metrics: [
        { label: 'Page Routes', value: analysis.nextjs ? String(analysis.nextjs.appRouteCount + analysis.nextjs.pagesRouteCount) : `${analysis.languages[0]?.files || 0} views` },
        { label: 'Client Framework', value: analysis.frameworks[0] || 'React' },
        { label: 'Primary Language', value: analysis.languages[0]?.name || 'TypeScript' },
      ],
      signals: analysis.nextjs
        ? [
            `${analysis.nextjs.appRouteCount} App Router page routes`,
            `${analysis.nextjs.pagesRouteCount} Pages Router routes`,
            ...(analysis.nextjs.routeExamples.slice(0, 3)),
          ]
        : analysis.languages.slice(0, 4).map(l => `${l.name} (${l.files} source files)`),
      files: analysis.nextjs?.routeExamples.slice(0, 3) || analysis.entryPoints.slice(0, 3),
      status: 'Active',
      statusColor: 'text-blue-500 bg-blue-500/10',
    },
    server: {
      title: 'Execution Boundary & Server Logic',
      subtitle: analysis.nextjs?.apiRouteCount ? `${analysis.nextjs.apiRouteCount} API endpoints detected` : 'Server runtime / boundary',
      description: 'Backend routing, API boundary handlers, server actions, and middleware orchestration.',
      metrics: [
        { label: 'Topology Shape', value: topology },
        { label: 'API Endpoints', value: analysis.nextjs ? String(analysis.nextjs.apiRouteCount) : 'Inferred' },
        { label: 'Confidence', value: confidence.toUpperCase() },
      ],
      signals: [
        `Architecture Topology: ${topology}`,
        `Confidence Level: ${confidence.toUpperCase()}`,
        ...(analysis.architecture?.evidence || []).slice(0, 3),
      ],
      files: [
        ...(analysis.nextjs?.requestBoundaryFiles || []),
        ...(analysis.nextjs?.configFiles || []),
        ...(analysis.entryPoints.slice(0, 2)),
      ].filter((f, idx, arr) => arr.indexOf(f) === idx).slice(0, 4),
      status: confidence === 'high' ? 'Verified' : 'Inferred',
      statusColor: confidence === 'high' ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-blue-500/10',
    },
    database: {
      title: 'Persistence & Data Storage',
      subtitle: databaseName !== 'Not assessed' ? databaseName : 'No database manifests detected',
      description: 'Database engines, ORMs, schemas, migrations, and persistent data access patterns.',
      metrics: [
        { label: 'Detected Engine', value: databaseName !== 'Not assessed' ? databaseName : 'None' },
        { label: 'Detection Signal', value: dbConfidence.toUpperCase() },
        { label: 'Schema Files', value: (analysis.architecture?.database.evidence || []).length > 0 ? 'Detected' : 'Unconfirmed' },
      ],
      signals: [
        `Database: ${databaseName}`,
        `Signal Confidence: ${dbConfidence.toUpperCase()}`,
        ...(analysis.architecture?.database.evidence || []).slice(0, 3),
      ],
      files: (analysis.architecture?.database.evidence || []).filter(e => e.includes('.') || e.includes('/')).slice(0, 3),
      status: databaseName !== 'Not assessed' ? 'Detected' : 'Unconfirmed',
      statusColor: databaseName !== 'Not assessed' ? 'text-violet-500 bg-violet-500/10' : 'text-amber-500 bg-amber-500/10',
    },
    delivery: {
      title: 'Source Control & Delivery Pipeline',
      subtitle: analysis.pipeline?.workflows.length ? `${analysis.pipeline.workflows.length} GitHub Actions workflows` : 'Standard Git Repository',
      description: 'CI/CD automation, pull request checks, deployment targets, and release pipelines.',
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
      files: analysis.pipeline?.workflows.map(w => w.path).slice(0, 3) || [],
      status: analysis.pipeline?.workflows.length ? 'Automated' : 'Manual',
      statusColor: analysis.pipeline?.workflows.length ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 bg-slate-400/10',
    },
  };

  const active = nodeDetails[selectedNode];

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-blue-500" />
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
            Architecture Topology Flow
          </h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
          confidence === 'high'
            ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
            : (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700')
        }`}>
          {confidence} confidence assessment
        </span>
      </div>

      {/* Interactive 4-Tier Step Flow */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Tier 1: Presentation */}
        <button
          type="button"
          onClick={() => setSelectedNode('client')}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all relative ${
            selectedNode === 'client'
              ? (isDark ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' : 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/40')
              : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100')
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <Monitor className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-blue-500">Tier 1</span>
          </div>
          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Presentation</span>
          <span className={`text-[10px] truncate mt-0.5 ${muted}`}>
            {analysis.nextjs ? analysis.nextjs.router : 'Client UI'}
          </span>
          <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
            <ArrowRight className="h-3 w-3 text-slate-400" />
          </div>
        </button>

        {/* Tier 2: Execution Boundary */}
        <button
          type="button"
          onClick={() => setSelectedNode('server')}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all relative ${
            selectedNode === 'server'
              ? (isDark ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' : 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/40')
              : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100')
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <Server className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-emerald-500">Tier 2</span>
          </div>
          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Execution Boundary</span>
          <span className={`text-[10px] truncate mt-0.5 ${muted}`}>
            {topology}
          </span>
          <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
            <ArrowRight className="h-3 w-3 text-slate-400" />
          </div>
        </button>

        {/* Tier 3: Persistence & Storage */}
        <button
          type="button"
          onClick={() => setSelectedNode('database')}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all relative ${
            selectedNode === 'database'
              ? (isDark ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' : 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/40')
              : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100')
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <Database className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-violet-500">Tier 3</span>
          </div>
          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Persistence & Storage</span>
          <span className={`text-[10px] truncate mt-0.5 ${muted}`}>
            {databaseName !== 'Not assessed' ? databaseName : 'No DB Detected'}
          </span>
          <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
            <ArrowRight className="h-3 w-3 text-slate-400" />
          </div>
        </button>

        {/* Tier 4: Delivery & Pipeline */}
        <button
          type="button"
          onClick={() => setSelectedNode('delivery')}
          className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
            selectedNode === 'delivery'
              ? (isDark ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' : 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/40')
              : (isDark ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100')
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <GitBranch className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-amber-500">Tier 4</span>
          </div>
          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Source & Pipeline</span>
          <span className={`text-[10px] truncate mt-0.5 ${muted}`}>
            {analysis.pipeline?.workflows.length ? `${analysis.pipeline.workflows.length} Workflows` : 'Git Repo'}
          </span>
        </button>
      </div>

      {/* Selected Node Detailed Inspector - Balanced 3-Column Layout */}
      <div className={`mt-3 rounded-xl border p-3.5 ${
        isDark ? 'border-white/[0.06] bg-black/25' : 'border-slate-200/80 bg-slate-50/60'
      }`}>
        <div className="flex items-center justify-between gap-2 border-b border-inherit pb-2.5 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{active.title}</h4>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${active.statusColor}`}>
                ● {active.status}
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${muted}`}>{active.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Col 1: Telemetry Metrics */}
          <div className="space-y-2">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${muted}`}>Tier Telemetry</p>
            <div className="space-y-1.5">
              {active.metrics.map(m => (
                <div key={m.label} className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                  isDark ? 'border-white/[0.05] bg-white/[0.02]' : 'border-slate-200/60 bg-white'
                }`}>
                  <span className={muted}>{m.label}</span>
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2: Evidence Signals */}
          <div className="space-y-2">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${muted}`}>Detection Signals</p>
            <div className="space-y-1">
              {active.signals.map((sig, i) => (
                <p key={i} className={`text-[11px] leading-4 flex items-start gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <span className="text-blue-500 select-none">•</span>
                  <span>{sig}</span>
                </p>
              ))}
            </div>
          </div>

          {/* Col 3: Key Boundary & Evidence Files */}
          <div className="space-y-2">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${muted}`}>Key Files & Endpoints</p>
            {active.files.length > 0 ? (
              <div className="space-y-1">
                {active.files.map((file, i) => (
                  <div key={i} className={`flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded truncate ${
                    isDark ? 'bg-black/30 text-blue-300' : 'bg-white border border-slate-200/60 text-blue-700'
                  }`} title={file}>
                    <FileCode className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-[11px] italic ${muted}`}>No specific boundary files flagged.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
