import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';

export const UserProfileDropdown: React.FC = () => {
  const { user, logout } = useAuth();
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

  // Get user initials for fallback avatar
  const initials = user.name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AR';

  return (
    <div className="relative font-display" ref={dropdownRef}>
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
        <div className={`absolute right-0 mt-1.5 w-48 rounded-xl border p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-[#141518] border-white/[0.09] text-white shadow-black/60' 
            : 'bg-white border-slate-200 text-slate-900 shadow-lg'
        }`}>
          {/* User Name & Info */}
          <div className={`px-2.5 py-2 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
            <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {user.name}
            </p>
            <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {user.email}
            </p>
          </div>

          {/* Sign Out Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
