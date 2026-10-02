import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  ArrowRight, 
  Plus, 
  Edit3,
  Layers,
  Database,
  GitBranch,
  ShieldCheck,
  FolderCode,
  CheckCircle2,
  Code2,
  Cpu,
  CornerDownLeft
} from 'lucide-react';

type TechStack = 'TypeScript' | 'Rust' | 'Python' | 'Go';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('blueprint_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [projectName, setProjectName] = useState<string>(() => {
    return localStorage.getItem('blueprint_project_name') || '';
  });

  const [inputName, setInputName] = useState('');
  const [selectedStack, setSelectedStack] = useState<TechStack>('TypeScript');
  const [activeTab, setActiveTab] = useState<'pre-flight' | 'in-flight' | 'post-flight'>('pre-flight');
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
    <div className={`min-h-screen flex flex-col font-display transition-colors duration-200 select-none ${
      isDark 
        ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200' 
        : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900'
    }`}>
      {/* Desktop Header / Titlebar */}
      <header className={`h-12 border-b px-5 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl transition-colors duration-200 ${
        isDark 
          ? 'bg-[#121316]/95 border-[#23242A]' 
          : 'bg-white/95 border-slate-200/90 shadow-xs'
      }`}>
        <div className="flex items-center space-x-3">
          {/* Logo Mark */}
          <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center shadow-sm">
            <div className="w-2 h-2 border-[1.5px] border-white rounded-[1px] rotate-45" />
          </div>

          <div className="flex items-center space-x-2.5">
            <span className={`font-bold text-xs tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Blueprint
            </span>
            <span className={`text-[11px] ${isDark ? 'text-[#60616B]' : 'text-slate-400'}`}>/</span>
            <span className={`text-xs ${isDark ? 'text-[#9496A1]' : 'text-slate-500'}`}>
              {projectName && !isEditing ? projectName : 'Workspace Setup'}
            </span>

            {projectName && !isEditing && (
              <button
                onClick={() => {
                  setInputName(projectName);
                  setIsEditing(true);
                }}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? 'text-[#7A7B85] hover:text-white hover:bg-white/[0.06]' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Rename Project"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2">
          {projectName && !isEditing && (
            <button
              onClick={() => {
                setInputName('');
                setIsEditing(true);
              }}
              className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer font-medium ${
                isDark 
                  ? 'border-[#27282F] text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]' 
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Switch Project
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center ${
              isDark 
                ? 'bg-[#1B1C22] border-[#2E3038] text-slate-300 hover:text-white hover:bg-[#25262E]' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200 shadow-xs'
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

      {/* Main Studio Viewport */}
      <main className="flex-1 flex overflow-hidden">
        {!projectName || isEditing ? (
          /* Workspace Creator Card - Strictly Asking for Project Name */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className={`w-full max-w-md rounded-2xl border p-7 space-y-6 transition-all animate-in fade-in zoom-in-95 duration-200 ${
              isDark ? 'desktop-card-dark' : 'desktop-card-light'
            }`}>
              {/* Header */}
              <div className="flex items-center space-x-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-600'
                }`}>
                  <FolderCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isEditing ? 'Rename Project' : 'New Project'}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                    What is the name of the project?
                  </p>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Project Name Field */}
                <div className="space-y-2">
                  <div className={`px-3.5 py-2.5 rounded-xl border flex items-center transition-all ${
                    isDark 
                      ? 'bg-[#141519] border-[#2B2C33] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30' 
                      : 'bg-white border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 shadow-xs'
                  }`}>
                    <input
                      type="text"
                      className={`w-full text-sm font-medium bg-transparent border-none outline-none ${
                        isDark ? 'text-white placeholder-[#5E606B]' : 'text-slate-900 placeholder-slate-400'
                      }`}
                      placeholder="e.g. payment-service"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className={`text-[11px] font-mono ${isDark ? 'text-[#60616B]' : 'text-slate-400'}`}>
                    Workspace: ~/blueprint/{inputName.trim() ? inputName.trim().toLowerCase().replace(/\s+/g, '-') : 'project-name'}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-1">
                  <div className={`flex items-center space-x-1 text-[11px] font-mono ${isDark ? 'text-[#60616B]' : 'text-slate-400'}`}>
                    <CornerDownLeft className="w-3 h-3" />
                    <span>Press Enter</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className={`text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                          isDark ? 'text-[#8E8F99] hover:text-white' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!inputName.trim()}
                      className="btn-primary-blue disabled:opacity-30 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-md"
                    >
                      <span>{isEditing ? 'Save' : 'Continue'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

        ) : (
          /* Active Workstation Dashboard */
          <div className="flex-1 flex">
            {/* Left Navigation Rail */}
            <aside className={`w-64 border-r flex flex-col justify-between transition-colors ${
              isDark ? 'bg-[#141519]/70 border-[#23242A]' : 'bg-slate-50/60 border-slate-200'
            }`}>
              <div className="p-4 space-y-6">
                <div className="space-y-1">
                  <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    isDark ? 'text-[#71727D]' : 'text-slate-400'
                  }`}>
                    Engineering Phases
                  </div>
                  <nav className="space-y-1">
                    <button
                      onClick={() => setActiveTab('pre-flight')}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                        activeTab === 'pre-flight'
                          ? isDark
                            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                            : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                          : isDark
                            ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Layers className="w-4 h-4 shrink-0" />
                      <span>1. Pre-Flight Gate</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('in-flight')}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                        activeTab === 'in-flight'
                          ? isDark
                            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                            : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                          : isDark
                            ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Code2 className="w-4 h-4 shrink-0" />
                      <span>2. In-Flight Execution</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('post-flight')}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                        activeTab === 'post-flight'
                          ? isDark
                            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                            : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                          : isDark
                            ? 'text-[#8E8F99] hover:text-white hover:bg-white/[0.04]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>3. Post-Flight Audit</span>
                    </button>
                  </nav>
                </div>

                <div className="space-y-2">
                  <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    isDark ? 'text-[#71727D]' : 'text-slate-400'
                  }`}>
                    Runtime Context
                  </div>
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                    isDark ? 'bg-[#18191E] border-[#27282F]' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-3.5 h-3.5 text-blue-500" />
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedStack}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${isDark ? 'text-[#71727D]' : 'text-slate-400'}`}>v1.0</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 border-t ${isDark ? 'border-[#23242A]' : 'border-slate-200'}`}>
                <div className={`text-[11px] ${isDark ? 'text-[#71727D]' : 'text-slate-500'}`}>
                  Blueprint Desktop Studio
                </div>
              </div>
            </aside>

            {/* Main Stage Content */}
            <div className="flex-1 flex flex-col overflow-y-auto p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Pre-Flight Invariant Gates
                  </h1>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                    Define unbreachable constraints for {projectName} before prompting code generation.
                  </p>
                </div>

                <button
                  className="btn-primary-blue px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Invariant Contract</span>
                </button>
              </div>

              {/* Invariant Rule Empty State / Initializer */}
              <div className={`p-10 rounded-2xl border text-center space-y-4 ${
                isDark ? 'bg-[#18191E]/60 border-[#27282F]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                  isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    No Invariant Gates Configured Yet
                  </h3>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-[#8E8F99]' : 'text-slate-500'}`}>
                    Add your first database constraint (e.g. non-nullable money cents, state enum) to generate failing test harnesses.
                  </p>
                </div>
                <div>
                  <button
                    className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                      isDark 
                        ? 'border-[#383944] text-white hover:bg-white/[0.05]' 
                        : 'border-slate-300 text-slate-800 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    Load Standard E-Commerce / SaaS Invariants
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

