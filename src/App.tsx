import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  ArrowRight, 
  Sparkles, 
  Database, 
  Terminal, 
  ShieldCheck, 
  Plus, 
  Edit3,
  Layers
} from 'lucide-react';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('blueprint_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [projectName, setProjectName] = useState<string>(() => {
    return localStorage.getItem('blueprint_project_name') || '';
  });

  const [inputName, setInputName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    localStorage.setItem('blueprint_theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputName.trim()) return;
    const name = inputName.trim();
    setProjectName(name);
    localStorage.setItem('blueprint_project_name', name);
    setInputName('');
    setIsEditing(false);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-display selection:bg-blue-500/25 selection:text-blue-300 ${
      isDark ? 'text-[#F4F4F6]' : 'text-slate-900'
    }`}>
      {/* Header */}
      <header className={`h-14 border-b px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl transition-all ${
        isDark 
          ? 'bg-[#121316]/85 border-[#23242A]' 
          : 'bg-white/85 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center space-x-3">
          {/* Logo Mark */}
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 border border-blue-400/30">
            <div className="w-2.5 h-2.5 border-2 border-white rounded-xs rotate-45" />
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-tight text-white dark:text-white">Blueprint</span>
            <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-semibold tracking-wider ${
              isDark ? 'bg-white/[0.06] text-[#A1A1AA]' : 'bg-slate-100 text-slate-600'
            }`}>
              Studio
            </span>

            {projectName && !isEditing && (
              <div className="flex items-center space-x-1.5 pl-3 border-l border-[#2B2C33]">
                <span className={`text-xs font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {projectName}
                </span>
                <button
                  onClick={() => {
                    setInputName(projectName);
                    setIsEditing(true);
                  }}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                  title="Rename"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Toolbar */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-1.5 rounded-full border transition-all cursor-pointer flex items-center ${
              isDark 
                ? 'bg-[#1B1C22] border-[#2E3038] text-slate-400 hover:text-white hover:bg-[#25262E]' 
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {!projectName || isEditing ? (
          /* Velvet Graphite Onboarding Card */
          <div className="max-w-xl w-full mx-auto flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Ambient Badge */}
            <div className={`inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-medium border ${
              isDark 
                ? 'bg-blue-500/[0.08] border-blue-500/25 text-blue-400' 
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Phase 1: Pre-Flight Gate</span>
            </div>

            {/* Editorial Heading */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Architect before you prompt.
              </h1>
              <p className={`text-sm sm:text-base max-w-md mx-auto leading-relaxed ${
                isDark ? 'text-[#8E8F99]' : 'text-slate-600'
              }`}>
                Define data contracts, state machines, and failing test harnesses before generating code with AI.
              </p>
            </div>

            {/* Floating Carbon Input Bar */}
            <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
              <div className={`p-1.5 rounded-2xl transition-all ${
                isDark ? 'glass-surface-dark' : 'glass-surface-light'
              }`}>
                <div className="flex items-center px-3 py-1">
                  <input
                    type="text"
                    className="w-full text-sm font-medium bg-transparent border-none outline-none text-inherit placeholder-slate-500 py-2"
                    placeholder="Enter project name..."
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!inputName.trim()}
                    className="btn-primary-blue disabled:opacity-30 disabled:pointer-events-none px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center space-x-1 cursor-pointer shrink-0 ml-2 shadow-sm"
                  >
                    <span>{isEditing ? 'Save' : 'Start'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-[#8E8F99] hover:text-slate-200 transition-colors"
                >
                  Cancel editing
                </button>
              )}
            </form>

            {/* Feature Pillars */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-md pt-2">
              <div className={`p-3.5 rounded-xl border text-left space-y-1 ${
                isDark ? 'bg-[#18191E]/80 border-[#27282F]' : 'bg-slate-50 border-slate-100'
              }`}>
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <div className="text-[11px] font-bold">1. Invariants</div>
                <div className={`text-[10px] ${isDark ? 'text-[#7A7B85]' : 'text-slate-500'}`}>Database contracts</div>
              </div>

              <div className={`p-3.5 rounded-xl border text-left space-y-1 ${
                isDark ? 'bg-[#18191E]/80 border-[#27282F]' : 'bg-slate-50 border-slate-100'
              }`}>
                <Terminal className="w-3.5 h-3.5 text-blue-500" />
                <div className="text-[11px] font-bold">2. TDD Harness</div>
                <div className={`text-[10px] ${isDark ? 'text-[#7A7B85]' : 'text-slate-500'}`}>Prompt guardrails</div>
              </div>

              <div className={`p-3.5 rounded-xl border text-left space-y-1 ${
                isDark ? 'bg-[#18191E]/80 border-[#27282F]' : 'bg-slate-50 border-slate-100'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <div className="text-[11px] font-bold">3. Concurrency</div>
                <div className={`text-[10px] ${isDark ? 'text-[#7A7B85]' : 'text-slate-500'}`}>Failure domain gates</div>
              </div>
            </div>
          </div>
        ) : (
          /* Project Studio Workspace */
          <div className="max-w-xl w-full mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className={`p-8 rounded-3xl text-center space-y-6 ${
              isDark ? 'glass-surface-dark' : 'glass-surface-light'
            }`}>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto shadow-inner">
                <Layers className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase font-mono tracking-wider text-blue-500 font-bold">
                  Project Workspace
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {projectName}
                </h2>
                <p className={`text-xs max-w-sm mx-auto leading-relaxed ${
                  isDark ? 'text-[#8E8F99]' : 'text-slate-500'
                }`}>
                  Ready to construct your first architectural invariant gate.
                </p>
              </div>

              <div className="pt-2">
                <button
                  className="btn-primary-blue px-5 py-2.5 rounded-xl text-xs font-semibold text-white inline-flex items-center space-x-2 cursor-pointer shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Pre-Flight Gate</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
