import React, { useState, useRef, useEffect } from 'react';
import { 
  LogOut, 
  ChevronDown, 
  FolderGit2, 
  ShieldCheck, 
  Users, 
  ExternalLink 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';

export const UserProfileDropdown: React.FC = () => {
  const { user, logout, quickLoginAsPersona } = useAuth();
  const { setIsCreatingNew, activeProject } = useProjects();
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!user) return null;

  const handleSignOut = () => {
    logout();
    notify.info('Signed out of Blueprint Studio.');
    setIsOpen(false);
  };

  const handleGoToProjects = () => {
    setIsCreatingNew(true);
    setIsOpen(false);
  };

  // Get user initials for fallback avatar
  const initials = user.name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AR';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-xl border transition-all cursor-pointer ${
          isDark 
            ? 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-slate-200' 
            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-xs'
        }`}
        title={`Account: ${user.name}`}
      >
        {user.avatarUrl ? (
          <img 
            src={user.avatarUrl} 
            alt={user.name} 
            className="w-6 h-6 rounded-lg object-cover ring-1 ring-blue-500/40" 
          />
        ) : (
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
            {initials}
          </div>
        )}
        <span className="hidden sm:inline text-xs font-medium max-w-[110px] truncate">
          {user.name}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-72 rounded-2xl border p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-[#14151B] border-white/[0.1] text-white shadow-black/60' 
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}>
          {/* User Header */}
          <div className={`p-3 rounded-xl mb-1 border ${
            isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200/60'
          }`}>
            <div className="flex items-center space-x-3">
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt={user.name} 
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-blue-500/40" 
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{user.name}</div>
                <div className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {user.email}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px]">
              <span className={`px-2 py-0.5 rounded-md border font-medium ${
                isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}>
                {user.role}
              </span>
              <span className={`flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>Active</span>
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-1 py-1">
            <button
              type="button"
              onClick={handleGoToProjects}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isDark ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <FolderGit2 className="w-4 h-4 text-blue-500" />
                <span>Projects & Workspaces</span>
              </div>
              {activeProject && (
                <span className={`text-[10px] truncate max-w-[90px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {activeProject.name}
                </span>
              )}
            </button>
          </div>

          {/* Persona Switcher Quick Shortcut */}
          <div className={`my-1 border-t pt-1.5 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <div className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Switch Profile
            </div>
            <div className="grid grid-cols-2 gap-1 px-1">
              <button
                type="button"
                onClick={() => { quickLoginAsPersona('alex'); setIsOpen(false); }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left transition-colors ${
                  user.email === 'alex.rivera@blueprint.dev'
                    ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                    : isDark ? 'hover:bg-white/[0.05] text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                Alex Rivera
              </button>
              <button
                type="button"
                onClick={() => { quickLoginAsPersona('elena'); setIsOpen(false); }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left transition-colors ${
                  user.email === 'elena@arch.studio'
                    ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                    : isDark ? 'hover:bg-white/[0.05] text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                Elena Rostova
              </button>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className={`mt-1 border-t pt-1.5 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <button
              type="button"
              onClick={handleSignOut}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer`}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out to Login Screen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
