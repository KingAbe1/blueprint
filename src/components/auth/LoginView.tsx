import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  ExternalLink,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { isDesktopApp } from '../../utils/platform';

export const LoginView: React.FC = () => {
  const { 
    login, 
    signup, 
    loginWithOAuth, 
    loginAsGuest, 
    isLoading 
  } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { notify } = useNotification();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keyboard shortcut: Escape to clear error
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setErrorMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email.');
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your name.');
      return;
    }

    try {
      if (mode === 'signin') {
        await login({ email: trimmedEmail, password, rememberMe });
        notify.success(`Unlocked workspace for ${trimmedEmail}`);
      } else {
        await signup({ name: name.trim(), email: trimmedEmail, password, rememberMe });
        notify.success(`Created profile for ${name.trim()}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    try {
      await loginWithOAuth(provider);
      notify.success(`Connected via ${provider === 'github' ? 'GitHub' : 'Google'}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const handleGuest = () => {
    loginAsGuest();
    notify.info('Started guest session.');
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const desktop = isDesktopApp();

  const shellBg = isDark
    ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200 bg-[#101113]'
    : desktop
      ? 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900 bg-[#F5F7FA]'
      : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900 bg-[radial-gradient(ellipse_at_40%_38%,#ffffff_0%,#f7f9fd_48%,#eef3fa_100%)]';

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      className={`rounded-lg p-2 transition-colors cursor-pointer ${
        isDark
          ? 'text-[#8E9098] hover:bg-white/[0.06] hover:text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  return (
    <div className={`desktop-hub-shell relative flex h-screen w-screen flex-col select-none overflow-hidden font-display transition-colors duration-200 ${shellBg}`}>
      {desktop ? (
        <div
          data-tauri-drag-region
          className={`drag-window desktop-titlebar-inset flex h-12 shrink-0 items-center justify-between border-b pr-4 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}
        >
          <span className={`text-sm font-medium ${isDark ? 'text-[#C4C6CC]' : 'text-slate-700'}`}>Blueprint Studio</span>
          <div className="no-drag">{themeToggle}</div>
        </div>
      ) : (
        <div className="absolute top-4 right-4 z-20">{themeToggle}</div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full w-full items-center justify-center px-5 py-10 sm:px-8">
          <div className={`desktop-panel w-full max-w-[420px] border p-6 sm:p-7 transition-all ${desktop ? 'rounded-lg shadow-none' : 'rounded-2xl shadow-sm'} ${
        isDark 
          ? 'border-white/[0.09] bg-[#141518]' 
          : desktop
            ? 'border-slate-200 bg-white'
            : 'border-slate-200/80 bg-white/95 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.26)]'
      }`}>
        
        {/* Simplified Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl mb-3 ${
            isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'
          }`}>
            <Layers className="h-5 w-5" />
          </div>
          <h1 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {mode === 'signin' ? 'Sign in to Blueprint' : 'Plan a new project'}
          </h1>
          <p className={`mt-1.5 text-sm leading-5 ${muted}`}>
            {mode === 'signin' 
              ? 'Sign in to access your projects and workspaces.' 
              : 'Set up your workspace to get started.'}
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleOAuth('github')}
            disabled={isLoading}
            className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              isDark 
                ? 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-blue-400/30 hover:bg-white/[0.04] hover:text-white' 
                : 'border-slate-200 bg-white/60 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-slate-900'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 opacity-50 ml-0.5" />
          </button>

          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={isLoading}
            className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              isDark 
                ? 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-blue-400/30 hover:bg-white/[0.04] hover:text-white' 
                : 'border-slate-200 bg-white/60 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-slate-900'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>Google</span>
            <ExternalLink className="w-3 h-3 opacity-50 ml-0.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className={`w-full border-t ${divider}`} />
          <span className={`absolute px-2.5 text-xs ${
            isDark ? 'bg-[#141518] text-slate-400' : 'bg-white text-slate-400'
          }`}>
            or with email
          </span>
        </div>

        {/* Segmented Mode Toggle */}
        <div className={`grid grid-cols-2 p-1 rounded-xl border mb-4 ${
          isDark ? 'border-white/[0.08] bg-[#0F1012]' : 'border-slate-200 bg-slate-100/70'
        }`}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMessage(null); }}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? isDark 
                  ? 'border border-blue-400/30 bg-blue-500/[0.12] text-blue-300' 
                  : 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMessage(null); }}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? isDark 
                  ? 'border border-blue-400/30 bg-blue-500/[0.12] text-blue-300' 
                  : 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Profile
          </button>
        </div>

        {/* Form with exact same input styles as CreateProjectView */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div role="alert" className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Full Name
              </label>
              <div className="relative">
                <UserIcon className={`absolute left-3.5 top-3 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm font-medium outline-none transition-colors ${
                    isDark 
                      ? 'border-white/[0.1] bg-[#0F1012] text-white placeholder:text-slate-600 focus:border-blue-500/70' 
                      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Email Address
            </label>
            <div className="relative">
              <Mail className={`absolute left-3.5 top-3 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="developer@studio.internal"
                className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm font-medium outline-none transition-colors ${
                  isDark 
                    ? 'border-white/[0.1] bg-[#0F1012] text-white placeholder:text-slate-600 focus:border-blue-500/70' 
                    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                }`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className={`absolute left-3.5 top-3 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-sm font-medium outline-none transition-colors ${
                  isDark 
                    ? 'border-white/[0.1] bg-[#0F1012] text-white placeholder:text-slate-600 focus:border-blue-500/70' 
                    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className={`absolute right-3.5 top-3 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className={`text-xs ${muted}`}>
                Remember on this device
              </span>
            </label>

            <button
              type="button"
              onClick={handleGuest}
              className={`text-xs font-medium hover:underline cursor-pointer ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              Guest mode
            </button>
          </div>

          {/* Submit Button (Uses btn-primary-blue matching CreateProjectView) */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:pointer-events-none ${
              isLoading
                ? isDark ? 'bg-white/[0.07] text-slate-500' : 'bg-slate-200 text-slate-500'
                : 'btn-primary-blue'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>{mode === 'signin' ? 'Sign In' : 'Create Profile'}</span>
            )}
          </button>
        </form>

          </div>
        </div>
      </div>
    </div>
  );
};
