import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  ArrowRight,
  CheckCircle,
  Loader2,
  Box,
  Cpu,
  Key
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useAI } from '../../context/AIContext';
import { DomainEntity } from '../../types/project';
import { generateEntitiesWithAI } from '../../services/aiService';

interface DomainIntentViewProps {
  onProceedToInvariants: () => void;
}

export const DomainIntentView: React.FC<DomainIntentViewProps> = ({ onProceedToInvariants }) => {
  const { activeProject, updateProjectSpec } = useProjects();
  const { isDark } = useTheme();
  const { settings, isAiConfigured, setIsSettingsOpen } = useAI();

  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityDesc, setNewEntityDesc] = useState('');

  if (!activeProject) return null;

  const { spec } = activeProject;

  const handleDescriptionChange = (desc: string) => {
    updateProjectSpec(activeProject.id, { description: desc });
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setNotification(null);

    try {
      const result = await generateEntitiesWithAI(
        activeProject.name,
        spec.description || '',
        settings
      );

      updateProjectSpec(activeProject.id, {
        coreEntities: result.entities
      });

      setIsGenerating(false);
      if (result.source === 'ai') {
        setNotification(`Generated ${result.entities.length} items with ${result.providerName || 'AI'}.`);
      } else {
        setNotification(`Added ${result.entities.length} Key Items.`);
      }
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      setIsGenerating(false);
      setNotification('Failed to generate items. Please check your AI API key.');
      setTimeout(() => setNotification(null), 4000);
    }
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

  const entityCount = spec.coreEntities?.length || 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto w-full">
      {/* Top Header Bar */}
      <div className={`px-8 py-4 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#0E0F12]/90 border-[#23252C]' : 'bg-white/90 border-slate-200/60 shadow-2xs'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-wider">
              Step 1
            </span>
            <span className={`text-xs ${isDark ? 'text-[#5E606B]' : 'text-slate-300'}`}>/</span>
            <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Project Overview & Plan
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 pl-3 border-l border-slate-200/60 dark:border-[#262832]">
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
              isDark ? 'bg-[#18191E] border-[#2B2C33] text-[#A1A1AA]' : 'bg-slate-50 border-slate-200/60 text-slate-600'
            }`}>
              {entityCount} {entityCount === 1 ? 'Key Item' : 'Key Items'}
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
            className="btn-primary-blue px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <span>Next: Data & Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="p-8 space-y-6 w-full">
        
        {/* Section 1: Project Description */}
        <div className={`rounded-xl border p-5 space-y-3 transition-all focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/20 ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <label htmlFor="system-objective-input" className={`text-xs font-bold uppercase tracking-wider cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  1. What are you building?
                </label>
              </div>
              <p className={`text-[11px] pl-6 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                Describe what your app or website does in everyday language.
              </p>
            </div>

            <button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="btn-primary-blue disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing idea...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Auto-Fill Key Items</span>
                </>
              )}
            </button>
          </div>

          <textarea
            id="system-objective-input"
            rows={3}
            value={spec.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Describe what your app does (e.g. A store where customers can browse items, add them to a cart, pay securely, and get order receipts)..."
            className={`w-full text-xs leading-relaxed p-3 rounded-lg border outline-none resize-y transition-colors ${
              isDark 
                ? 'bg-[#101114] border-[#20222A] text-white placeholder-[#5E606B] focus:border-[#2E313D]' 
                : 'bg-[#F8FAFC] border-slate-200/80 text-slate-900 placeholder-slate-400 focus:border-slate-300'
            }`}
          />

          {!isAiConfigured && (
            <div className={`text-[11px] flex items-center justify-between pt-1 ${
              isDark ? 'text-[#8E8F99]' : 'text-slate-500'
            }`}>
              <div className="flex items-center space-x-1.5">
                <Key className="w-3 h-3 text-blue-500" />
                <span>Tip: Connect your own Claude, OpenAI, Gemini, or Ollama API key for deeper intelligence.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Connect AI Key
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Key Items & People (Full Width Clean Layout) */}
        <div className={`rounded-xl border p-5 space-y-4 transition-colors ${
          isDark ? 'studio-panel-dark' : 'studio-panel-light'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Box className="w-4 h-4 text-blue-500" />
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  2. Key Items & People ({entityCount})
                </h3>
                <p className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                  The main records, items, or user types in your app (e.g. Customer, Order, Product).
                </p>
              </div>
            </div>
          </div>

          {/* Items Grid/List */}
          {spec.coreEntities && spec.coreEntities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                        item
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
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 rounded-lg border border-dashed text-center text-xs ${
              isDark ? 'border-[#262832] text-[#71727D]' : 'border-slate-200 text-slate-400'
            }`}>
              No items added yet. Click "Auto-Fill Key Items" above or add one below.
            </div>
          )}

          {/* Add Item Form */}
          <form onSubmit={handleAddEntity} className="pt-2 border-t border-slate-100 dark:border-[#1E2028] space-y-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-[#8E8F99]">
              Add a new item or user type:
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Item Name (e.g. Customer, Order, Product)"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                className={`sm:w-1/3 text-xs p-2 rounded-lg outline-none ${
                  isDark ? 'studio-input-dark' : 'studio-input-light'
                }`}
              />
              <input
                type="text"
                placeholder="What is this for? (e.g. Stores customer profile and email)"
                value={newEntityDesc}
                onChange={(e) => setNewEntityDesc(e.target.value)}
                className={`flex-1 text-xs p-2 rounded-lg outline-none ${
                  isDark ? 'studio-input-dark' : 'studio-input-light'
                }`}
              />
              <button
                type="submit"
                disabled={!newEntityName.trim()}
                className={`px-4 py-2 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shrink-0 ${
                  isDark 
                    ? 'border-[#27282F] text-slate-300 hover:bg-white/[0.04] disabled:opacity-30' 
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Synthesis Action Footer */}
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
          isDark ? 'bg-[#141519] border-[#23252C]' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="space-y-0.5">
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Ready for the next step?
            </div>
            <div className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
              Move to Step 2 to set up required fields and guardrails.
            </div>
          </div>

          <button
            onClick={onProceedToInvariants}
            className="btn-primary-blue px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <span>Continue to Step 2: Data & Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
