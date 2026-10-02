import React, { useState } from 'react';
import { 
  FileText, 
  Layers, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  ArrowRight,
  CheckCircle,
  Loader2,
  Workflow,
  Wand2,
  Box,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { DomainEntity } from '../../types/project';
import { extractDomainFromObjective } from '../../services/domainExtractor';

interface DomainIntentViewProps {
  onProceedToInvariants: () => void;
}

export const DomainIntentView: React.FC<DomainIntentViewProps> = ({ onProceedToInvariants }) => {
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();

  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityDesc, setNewEntityDesc] = useState('');
  const [newRule, setNewRule] = useState('');
  const [newWorkflow, setNewWorkflow] = useState('');

  if (!activeProject) return null;

  const { spec } = activeProject;

  const handleDescriptionChange = (desc: string) => {
    updateProjectSpec(activeProject.id, { description: desc });
  };

  const handleAutoGenerate = () => {
    setIsGenerating(true);
    setNotification(null);

    setTimeout(() => {
      const result = extractDomainFromObjective(activeProject.name, spec.description || '');

      updateProjectSpec(activeProject.id, {
        coreEntities: result.entities,
        nonNegotiables: result.nonNegotiables,
        criticalWorkflows: result.criticalWorkflows
      });

      setIsGenerating(false);
      setNotification(`Synthesized ${result.entities.length} Domain Entities & ${result.nonNegotiables.length} Invariant Rules.`);
      setTimeout(() => setNotification(null), 3500);
    }, 400);
  };

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;

    const newEntity: DomainEntity = {
      id: 'ent_' + Date.now(),
      name: newEntityName.trim(),
      description: newEntityDesc.trim()
    };

    updateProjectSpec(activeProject.id, {
      coreEntities: [...(spec.coreEntities || []), newEntity]
    });

    setNewEntityName('');
    setNewEntityDesc('');
  };

  const handleRemoveEntity = (id: string) => {
    updateProjectSpec(activeProject.id, {
      coreEntities: (spec.coreEntities || []).filter(e => e.id !== id)
    });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;

    updateProjectSpec(activeProject.id, {
      nonNegotiables: [...(spec.nonNegotiables || []), newRule.trim()]
    });

    setNewRule('');
  };

  const handleRemoveRule = (index: number) => {
    const updated = [...(spec.nonNegotiables || [])];
    updated.splice(index, 1);
    updateProjectSpec(activeProject.id, { nonNegotiables: updated });
  };

  const handleAddWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflow.trim()) return;

    updateProjectSpec(activeProject.id, {
      criticalWorkflows: [...(spec.criticalWorkflows || []), newWorkflow.trim()]
    });

    setNewWorkflow('');
  };

  const handleRemoveWorkflow = (index: number) => {
    const updated = [...(spec.criticalWorkflows || [])];
    updated.splice(index, 1);
    updateProjectSpec(activeProject.id, { criticalWorkflows: updated });
  };

  const entityCount = spec.coreEntities?.length || 0;
  const ruleCount = spec.nonNegotiables?.length || 0;
  const workflowCount = spec.criticalWorkflows?.length || 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto w-full">
      {/* Top Spec Header Bar */}
      <div className={`px-8 py-5 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#0E0F12]/90 border-[#23252C]' : 'bg-white/90 border-slate-200/60 shadow-2xs'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-wider">
              Step 1
            </span>
            <span className={`text-xs ${isDark ? 'text-[#5E606B]' : 'text-slate-300'}`}>/</span>
            <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Domain Architecture & System Scope
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 pl-3 border-l border-slate-200/60 dark:border-[#262832]">
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
              isDark ? 'bg-[#18191E] border-[#2B2C33] text-[#A1A1AA]' : 'bg-slate-50 border-slate-200/60 text-slate-600'
            }`}>
              {entityCount} Entities · {ruleCount} Invariants
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {notification && (
            <div className={`text-xs font-medium px-3 py-1 rounded-md border flex items-center space-x-1.5 animate-in fade-in ${
              isDark ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>{notification}</span>
            </div>
          )}

          <button
            onClick={onProceedToInvariants}
            className="btn-primary-blue px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Synthesize Invariants</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="p-8 space-y-7 max-w-7xl w-full mx-auto">
        
        {/* Section 1: System Purpose & Hero Prompt */}
        <div className={`rounded-xl border p-5 space-y-3 transition-all focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/20 ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <label htmlFor="system-objective-input" className={`text-xs font-bold uppercase tracking-wider cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                1. System Objective & Problem Statement
              </label>
            </div>

            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="btn-primary-blue disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Domain...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Extract Entities & Rules</span>
                </>
              )}
            </button>
          </div>

          <textarea
            id="system-objective-input"
            rows={3}
            value={spec.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Describe the system purpose (e.g. A high-reliability subscription billing and customer ledger gateway. It processes charges with idempotency keys, coordinates refund cycles, and prevents overdrafts)..."
            className={`w-full text-xs leading-relaxed p-3 rounded-lg border outline-none resize-y transition-colors ${
              isDark 
                ? 'bg-[#101114] border-[#20222A] text-white placeholder-[#5E606B] focus:border-[#2E313D]' 
                : 'bg-[#F8FAFC] border-slate-200/80 text-slate-900 placeholder-slate-400 focus:border-slate-300'
            }`}
          />
        </div>

        {/* Two-Column Master Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (5 Cols): Core Domain Entities */}
          <div className={`lg:col-span-6 rounded-xl border p-5 space-y-4 transition-colors ${
            isDark ? 'studio-panel-dark' : 'studio-panel-light'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Box className="w-4 h-4 text-blue-500" />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  2. Core Domain Entities ({entityCount})
                </h3>
              </div>
            </div>

            {/* Entities List */}
            {spec.coreEntities && spec.coreEntities.length > 0 ? (
              <div className="space-y-2">
                {spec.coreEntities.map((entity) => (
                  <div
                    key={entity.id}
                    className={`p-3 rounded-lg border flex items-start justify-between space-x-3 transition-colors ${
                      isDark 
                        ? 'bg-[#101114] border-[#23252C] hover:border-[#32353E]' 
                        : 'bg-[#F8FAFC] border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {entity.name}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
                        }`}>
                          model
                        </span>
                      </div>
                      {entity.description && (
                        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-600'}`}>
                          {entity.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveEntity(entity.id)}
                      className="p-1 rounded text-[#71727D] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      title="Remove entity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`p-6 rounded-lg border border-dashed text-center text-xs ${
                isDark ? 'border-[#262832] text-[#71727D]' : 'border-slate-200 text-slate-400'
              }`}>
                No domain entities declared yet. Click "Auto-Extract" or add below.
              </div>
            )}

            {/* Add Entity Row */}
            <form onSubmit={handleAddEntity} className="space-y-2 pt-1">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Entity Name (e.g. LedgerAccount)"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  className={`w-1/2 text-xs p-2 rounded-lg outline-none ${
                    isDark ? 'studio-input-dark' : 'studio-input-light'
                  }`}
                />
                <input
                  type="text"
                  placeholder="Responsibility / Role"
                  value={newEntityDesc}
                  onChange={(e) => setNewEntityDesc(e.target.value)}
                  className={`flex-1 text-xs p-2 rounded-lg outline-none ${
                    isDark ? 'studio-input-dark' : 'studio-input-light'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={!newEntityName.trim()}
                className={`w-full py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1 transition-colors cursor-pointer ${
                  isDark 
                    ? 'border-[#27282F] text-slate-300 hover:bg-white/[0.04] disabled:opacity-30' 
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Entity Model</span>
              </button>
            </form>
          </div>

          {/* Right Column (6 Cols): Non-Negotiables & Workflows */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Non-Negotiable Rules */}
            <div className={`rounded-xl border p-5 space-y-4 transition-colors ${
              isDark ? 'studio-panel-dark' : 'studio-panel-light'
            }`}>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  3. Non-Negotiable Rules ({ruleCount})
                </h3>
              </div>

              {spec.nonNegotiables && spec.nonNegotiables.length > 0 ? (
                <div className="space-y-2">
                  {spec.nonNegotiables.map((rule, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-start justify-between space-x-2.5 transition-colors ${
                        isDark ? 'bg-[#101114] border-[#23252C]' : 'bg-[#F8FAFC] border-slate-200/90'
                      }`}
                    >
                      <div className="flex items-start space-x-2 min-w-0 flex-1 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span className={`text-xs leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {rule}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveRule(idx)}
                        className="p-1 rounded text-[#71727D] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        title="Remove rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-6 rounded-lg border border-dashed text-center text-xs ${
                  isDark ? 'border-[#262832] text-[#71727D]' : 'border-slate-200 text-slate-400'
                }`}>
                  No non-negotiables defined. What must never happen in this system?
                </div>
              )}

              {/* Add Rule Form */}
              <form onSubmit={handleAddRule} className="flex space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="e.g. Account balance can never be negative"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  className={`flex-1 text-xs p-2 rounded-lg outline-none ${
                    isDark ? 'studio-input-dark' : 'studio-input-light'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newRule.trim()}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors ${
                    isDark 
                      ? 'border-[#27282F] text-slate-300 hover:bg-white/[0.04] disabled:opacity-30' 
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Critical Workflows */}
            <div className={`rounded-xl border p-5 space-y-4 transition-colors ${
              isDark ? 'studio-panel-dark' : 'studio-panel-light'
            }`}>
              <div className="flex items-center space-x-2">
                <Workflow className="w-4 h-4 text-blue-500" />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  4. Critical System Workflows ({workflowCount})
                </h3>
              </div>

              {spec.criticalWorkflows && spec.criticalWorkflows.length > 0 ? (
                <div className="space-y-2">
                  {spec.criticalWorkflows.map((workflow, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-center justify-between space-x-2.5 transition-colors ${
                        isDark ? 'bg-[#101114] border-[#23252C]' : 'bg-[#F8FAFC] border-slate-200/90'
                      }`}
                    >
                      <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {workflow}
                      </span>
                      <button
                        onClick={() => handleRemoveWorkflow(idx)}
                        className="p-1 rounded text-[#71727D] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        title="Remove workflow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-4 rounded-lg border border-dashed text-center text-xs ${
                  isDark ? 'border-[#262832] text-[#71727D]' : 'border-slate-200 text-slate-400'
                }`}>
                  No workflows specified yet.
                </div>
              )}

              {/* Add Workflow Form */}
              <form onSubmit={handleAddWorkflow} className="flex space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="e.g. Idempotent charge & webhook dispatch"
                  value={newWorkflow}
                  onChange={(e) => setNewWorkflow(e.target.value)}
                  className={`flex-1 text-xs p-2 rounded-lg outline-none ${
                    isDark ? 'studio-input-dark' : 'studio-input-light'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newWorkflow.trim()}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors ${
                    isDark 
                      ? 'border-[#27282F] text-slate-300 hover:bg-white/[0.04] disabled:opacity-30' 
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>

          </div>

        </div>

        {/* Bottom Synthesis Action Footer */}
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#141519] border-[#23252C]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="space-y-0.5">
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Ready to generate invariant check constraints?
            </div>
            <div className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Proceed to Step 2 to generate database nullability rules and state transition matrices.
            </div>
          </div>

          <button
            onClick={onProceedToInvariants}
            className="btn-primary-blue px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <span>Proceed to Schema Invariants</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
