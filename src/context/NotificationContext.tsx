import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useTheme } from './ThemeContext';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  action?: NotificationAction;
  duration?: number;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  showNotification: (notification: Omit<NotificationItem, 'id'>) => string;
  dismissNotification: (id: string) => void;
  notify: {
    success: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) => string;
    error: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) => string;
    warning: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) => string;
    info: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) => string;
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { isDark } = useTheme();

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showNotification = useCallback((item: Omit<NotificationItem, 'id'>) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const duration = item.duration ?? (item.type === 'error' ? 6000 : 4500);

    const newNotification: NotificationItem = {
      ...item,
      id,
      duration,
    };

    setNotifications((prev) => [newNotification, ...prev.slice(0, 4)]); // max 5 concurrent toasts

    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }

    return id;
  }, [dismissNotification]);

  const notify = {
    success: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'success', message, ...options }),
    error: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'error', message, ...options }),
    warning: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'warning', message, ...options }),
    info: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'info', message, ...options }),
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />;
    }
  };

  const getCardStyles = (type: NotificationType) => {
    if (isDark) {
      switch (type) {
        case 'success':
          return 'bg-[#12141A]/95 border-emerald-500/40 text-white shadow-emerald-950/40';
        case 'error':
          return 'bg-[#181114]/95 border-rose-500/40 text-white shadow-rose-950/40';
        case 'warning':
          return 'bg-[#181510]/95 border-amber-500/40 text-white shadow-amber-950/40';
        case 'info':
        default:
          return 'bg-[#12141C]/95 border-blue-500/40 text-white shadow-blue-950/40';
      }
    } else {
      switch (type) {
        case 'success':
          return 'bg-white/95 border-emerald-300 text-slate-900 shadow-slate-200';
        case 'error':
          return 'bg-white/95 border-rose-300 text-slate-900 shadow-slate-200';
        case 'warning':
          return 'bg-white/95 border-amber-300 text-slate-900 shadow-slate-200';
        case 'info':
        default:
          return 'bg-white/95 border-blue-300 text-slate-900 shadow-slate-200';
      }
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, dismissNotification, notify }}>
      {children}

      {/* Floating Push / Toast Notification Container */}
      <div 
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none select-none"
      >
        {notifications.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto rounded-xl border p-3.5 shadow-xl backdrop-blur-md flex items-start space-x-3 transition-all animate-in slide-in-from-top-3 fade-in duration-200 ${getCardStyles(
              toast.type
            )}`}
          >
            {getIcon(toast.type)}

            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <div className="text-xs font-bold leading-snug mb-0.5 tracking-tight">
                  {toast.title}
                </div>
              )}
              <div className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {toast.message}
              </div>

              {toast.action && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissNotification(toast.id);
                    }}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    {toast.action.label}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismissNotification(toast.id)}
              className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
