import React, { useState } from 'react';
import { 
  Plus, 
  Database, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  Search, 
  Sparkles, 
  Code2, 
  Play, 
  Trash2, 
  Check, 
  X,
  Layers,
  FileCode,
  Tag,
  ArrowRight
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';

export interface DataInvariantRule {
  id: string;
  field: string;
  entity: string;
  ruleType: 'range' | 'format' | 'presence' | 'business' | 'enum';
  expression: string;
  errorMessage: string;
  severity: 'error' | 'warning';
  enabled: boolean;
  zodSnippet: string;
}

const DEFAULT_RULES: DataInvariantRule[] = [
  {
    id: 'rule-1',
    entity: 'User',
    field: 'email',
    ruleType: 'format',
    expression: '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/',
    errorMessage: 'Must be a valid RFC 5322 email address format',
    severity: 'error',
    enabled: true,
    zodSnippet: "z.string().email('Invalid email address format')"
  },
  {
    id: 'rule-2',
    entity: 'Order',
    field: 'totalAmount',
    ruleType: 'range',
    expression: 'totalAmount >= 0',
    errorMessage: 'Total order amount cannot be negative',
    severity: 'error',
    enabled: true,
    zodSnippet: "z.number().min(0, 'Amount must be greater than or equal to 0')"
  },
  {
    id: 'rule-3',
    entity: 'Product',
    field: 'sku',
    ruleType: 'format',
    expression: '/^[A-Z]{3}-[0-9]{4}$/',
    errorMessage: 'SKU must match format ABC-1234',
    severity: 'warning',
    enabled: true,
    zodSnippet: "z.string().regex(/^[A-Z]{3}-[0-9]{4}$/, 'Invalid SKU format')"
  },
  {
    id: 'rule-4',
    entity: 'Account',
    field: 'balance',
    ruleType: 'business',
    expression: 'balance >= minThreshold',
    errorMessage: 'Account balance below minimum overdraft protection limit',
    severity: 'error',
    enabled: true,
    zodSnippet: "z.number().refine(val => val >= 0, { message: 'Overdraft limit exceeded' })"
  }
];

const PRESET_TEMPLATES = [
  { label: 'Email Format', entity: 'User', field: 'email', ruleType: 'format' as const, expression: 'valid_email', errorMessage: 'Must be a valid email format', zodSnippet: "z.string().email()" },
  { label: 'Positive Price', entity: 'Product', field: 'price', ruleType: 'range' as const, expression: 'price > 0', errorMessage: 'Price must be positive', zodSnippet: "z.number().positive()" },
  { label: 'Non-Empty Name', entity: 'Customer', field: 'fullName', ruleType: 'presence' as const, expression: 'length >= 2', errorMessage: 'Name must be at least 2 chars', zodSnippet: "z.string().min(2)" },
  { label: 'UUID Identifier', entity: 'Session', field: 'id', ruleType: 'format' as const, expression: 'is_uuid_v4', errorMessage: 'Must be a valid UUID v4', zodSnippet: "z.string().uuid()" },
];

export const InvariantWorkbench: React.FC = () => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();
  const { notify } = useNotification();

  const [rules, setRules] = useState<DataInvariantRule[]>(DEFAULT_RULES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxInput, setSandboxInput] = useState('{\n  "email": "invalid-email",\n  "totalAmount": -50,\n  "balance": 250\n}');
  const [sandboxResults, setSandboxResults] = useState<{ field: string; passed: boolean; message: string }[] | null>(null);

  // New Rule Form State
  const [newEntity, setNewEntity] = useState('User');
  const [newField, setNewField] = useState('');
  const [newType, setNewType] = useState<'range' | 'format' | 'presence' | 'business' | 'enum'>('range');
  const [newExpression, setNewExpression] = useState('');
  const [newErrorMessage, setNewErrorMessage] = useState('');
  const [newSeverity, setNewSeverity] = useState<'error' | 'warning'>('error');

  if (!activeProject) return null;

  const filteredRules = rules.filter(r => {
    const matchesSearch = r.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.errorMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || r.ruleType === selectedType;
    return matchesSearch && matchesType;
  });

  const toggleRuleEnabled = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    notify.info('Rule removed successfully');
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.trim() || !newErrorMessage.trim()) return;

    const created: DataInvariantRule = {
      id: `rule-${Date.now()}`,
      entity: newEntity.trim() || 'General',
      field: newField.trim(),
      ruleType: newType,
      expression: newExpression.trim() || 'val !== undefined',
      errorMessage: newErrorMessage.trim(),
      severity: newSeverity,
      enabled: true,
      zodSnippet: `z.${newType === 'range' ? 'number()' : 'string()'}.refine(val => Boolean(val), '${newErrorMessage}')`
    };

    setRules(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewField('');
    setNewExpression('');
    setNewErrorMessage('');
    notify.success('Data invariant rule added');
  };

  const applyTemplate = (tmpl: typeof PRESET_TEMPLATES[0]) => {
    setNewEntity(tmpl.entity);
    setNewField(tmpl.field);
    setNewType(tmpl.ruleType);
    setNewExpression(tmpl.expression);
    setNewErrorMessage(tmpl.errorMessage);
  };

  const runSandboxEval = () => {
    try {
      const parsed = JSON.parse(sandboxInput);
      const results: { field: string; passed: boolean; message: string }[] = [];

      rules.filter(r => r.enabled).forEach(rule => {
        const val = parsed[rule.field];
        let passed = true;

        if (rule.ruleType === 'presence') {
          passed = val !== undefined && val !== null && val !== '';
        } else if (rule.ruleType === 'format' && rule.field === 'email') {
          passed = typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        } else if (rule.ruleType === 'range') {
          passed = typeof val === 'number' && val >= 0;
        } else if (rule.ruleType === 'business') {
          passed = typeof val === 'number' && val >= 100;
        }

        results.push({
          field: rule.field,
          passed,
          message: passed ? 'Validation passed cleanly' : rule.errorMessage
        });
      });

      setSandboxResults(results);
    } catch {
      notify.error('Invalid JSON input in Sandbox');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto w-full">
      <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6">
        
        {/* Header Hero Banner */}
        <div className={`p-6 rounded-2xl border transition-all relative overflow-hidden ${
          isDark 
            ? 'studio-panel-dark border-[#232530] shadow-xl' 
            : 'studio-panel-light border-slate-200/80 shadow-md'
        }`}>
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Data Invariants & Guardrails
                  </h2>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                    isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {rules.filter(r => r.enabled).length} Active Guards
                  </span>
                </div>
                <p className={`text-xs leading-relaxed max-w-2xl ${isDark ? 'text-[#8E8F99]' : 'text-slate-600'}`}>
                  Define mandatory schema assertions, range constraints, and business invariants to prevent invalid data state across your client and database layers.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                onClick={() => setShowSandbox(!showSandbox)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition-all cursor-pointer ${
                  showSandbox
                    ? isDark ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-purple-50 border-purple-300 text-purple-700'
                    : isDark ? 'bg-[#181920] border-[#2B2C36] text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>{showSandbox ? 'Hide Validator' : 'Rule Sandbox'}</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary-blue px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-md hover:shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Data Rule</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Rule Sandbox Box */}
        {showSandbox && (
          <div className={`p-6 rounded-2xl border space-y-4 animate-in fade-in duration-200 ${
            isDark ? 'bg-[#13141A] border-purple-500/30 text-white' : 'bg-purple-50/40 border-purple-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold">Interactive Validation Evaluator</h3>
              </div>
              <button
                onClick={runSandboxEval}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-xs flex items-center space-x-1"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test Payload</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={`block text-[11px] font-mono uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Input JSON Payload
                </label>
                <textarea
                  rows={5}
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  className={`w-full font-mono text-xs p-3 rounded-xl border outline-none resize-none ${
                    isDark ? 'bg-[#0A0B0E] border-[#262730] text-purple-200 focus:border-purple-500' : 'bg-white border-slate-200 text-slate-800 focus:border-purple-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-mono uppercase mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Validation Results ({sandboxResults?.length || 0})
                </label>
                <div className={`h-[118px] p-3 rounded-xl border overflow-y-auto space-y-2 ${
                  isDark ? 'bg-[#0A0B0E] border-[#262730]' : 'bg-white border-slate-200'
                }`}>
                  {!sandboxResults ? (
                    <p className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Click "Test Payload" to evaluate current rules against your JSON payload.
                    </p>
                  ) : (
                    sandboxResults.map((res, idx) => (
                      <div key={idx} className={`flex items-start space-x-2 text-xs p-1.5 rounded-lg ${
                        res.passed 
                          ? isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                          : isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'
                      }`}>
                        {res.passed ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                        <div>
                          <span className="font-mono font-semibold">{res.field}:</span> {res.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search field, entity, rule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full text-xs pl-9 pr-3 py-2 rounded-xl border outline-none transition-all ${
                isDark 
                  ? 'bg-[#14151B] border-[#272832] text-white focus:border-blue-500' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'range', 'format', 'presence', 'business'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer shrink-0 ${
                  selectedType === type
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark
                      ? 'bg-[#15161C] text-[#8E8F99] hover:text-white border border-[#23242E]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Rule Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all space-y-3 relative group ${
                !rule.enabled ? 'opacity-50' : ''
              } ${
                isDark 
                  ? 'studio-panel-dark border-[#232530] hover:border-blue-500/40' 
                  : 'studio-panel-light border-slate-200 hover:border-blue-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                    isDark ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rule.entity}
                  </span>
                  <span className={`text-xs font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    .{rule.field}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    rule.severity === 'error'
                      ? isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'
                      : isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {rule.severity}
                  </span>

                  <button
                    onClick={() => toggleRuleEnabled(rule.id)}
                    className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${
                      rule.enabled ? 'bg-emerald-500' : isDark ? 'bg-[#2B2C36]' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5 ${
                      rule.enabled ? 'translate-x-3' : 'translate-x-0'
                    }`} />
                  </button>

                  <button
                    onClick={() => deleteRule(rule.id)}
                    className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                      isDark ? 'text-slate-500 hover:text-red-400 hover:bg-white/5' : 'text-slate-400 hover:text-red-600 hover:bg-slate-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {rule.errorMessage}
                </p>
                <div className={`font-mono text-[11px] px-2.5 py-1 rounded-lg ${
                  isDark ? 'bg-[#0D0E12] text-emerald-400 border border-[#1E1F28]' : 'bg-slate-100 text-emerald-700'
                }`}>
                  {rule.expression}
                </div>
              </div>

              <div className={`pt-2 border-t flex items-center justify-between text-[11px] font-mono ${
                isDark ? 'border-[#1E202B] text-slate-400' : 'border-slate-100 text-slate-500'
              }`}>
                <div className="flex items-center space-x-1">
                  <Code2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="truncate max-w-[240px]">{rule.zodSnippet}</span>
                </div>
                <span className="capitalize text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  {rule.ruleType}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Create Rule Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-2xl ${
              isDark ? 'bg-[#14151B] border-[#292A36] text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold">Add Data Guardrail</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Quick Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyTemplate(tmpl)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        isDark 
                          ? 'bg-[#1B1C24] border-[#2D2E3C] text-blue-300 hover:bg-blue-500/20' 
                          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      + {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddRule} className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Entity / Model</label>
                    <input
                      type="text"
                      placeholder="e.g. User, Order"
                      value={newEntity}
                      onChange={(e) => setNewEntity(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none ${
                        isDark ? 'bg-[#0E0F13] border-[#2A2B36] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Field Name</label>
                    <input
                      type="text"
                      placeholder="e.g. email, price"
                      value={newField}
                      onChange={(e) => setNewField(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none ${
                        isDark ? 'bg-[#0E0F13] border-[#2A2B36] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Rule Category</label>
                    <select
                      value={newType}
                      onChange={(e: any) => setNewType(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none ${
                        isDark ? 'bg-[#0E0F13] border-[#2A2B36] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                    >
                      <option value="range">Range / Bound</option>
                      <option value="format">Format / Regex</option>
                      <option value="presence">Presence / Non-Null</option>
                      <option value="business">Business Rule</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Severity Level</label>
                    <select
                      value={newSeverity}
                      onChange={(e: any) => setNewSeverity(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border outline-none ${
                        isDark ? 'bg-[#0E0F13] border-[#2A2B36] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                    >
                      <option value="error">Error (Reject request)</option>
                      <option value="warning">Warning (Log & Flag)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Validation Expression</label>
                  <input
                    type="text"
                    placeholder="e.g. price > 0 or /^[A-Z]+$/"
                    value={newExpression}
                    onChange={(e) => setNewExpression(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border font-mono outline-none ${
                      isDark ? 'bg-[#0E0F13] border-[#2A2B36] text-emerald-400 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-emerald-700 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Error Message</label>
                  <input
                    type="text"
                    placeholder="e.g. Total order amount cannot be negative"
                    value={newErrorMessage}
                    onChange={(e) => setNewErrorMessage(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-xl border outline-none ${
                      isDark ? 'bg-[#0E0F13] border-[#2A2B36] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                    }`}
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-blue px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
