import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, ExternalLink } from 'lucide-react';
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
  timestamp: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  showNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => string;
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

  // Request native OS notification permission on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Synthesize native desktop notification audio chime via Web Audio API
  const playNotificationSound = useCallback((type: NotificationType) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      if (type === 'success') {
        // macOS style dual chime: D5 (587.3Hz) -> A5 (880Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.08);

        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.12);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.38);
      } else if (type === 'error') {
        // Native desktop error thud alert
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'warning') {
        // Attention ping (440Hz -> 659.25Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(659.25, now + 0.07);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.32);
      } else {
        // Info droplet ping (600Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch {
      // Audio playback fails silently if browser gesture policy restricts it
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showNotification = useCallback((item: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const duration = item.duration ?? (item.type === 'error' ? 7000 : 5000);

    const newNotification: NotificationItem = {
      ...item,
      id,
      duration,
      timestamp: 'now'
    };

    setNotifications((prev) => [newNotification, ...prev.slice(0, 3)]); // max 4 concurrent desktop banners

    // Play native desktop audio chime
    playNotificationSound(item.type);

    // Dispatch to native Desktop Notification API if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const titleText = item.title || (item.type === 'error' ? 'Blueprint Error' : item.type === 'success' ? 'Blueprint Success' : 'Blueprint Notification');
        new Notification(titleText, {
          body: item.message,
          silent: false
        });
      } catch (e) {
        // Ignore iframe / restricted sandbox restrictions
      }
    }

    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }

    return id;
  }, [dismissNotification, playNotificationSound]);

  const notify = {
    success: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'success', message, title: options?.title || 'Success', ...options }),
    error: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'error', message, title: options?.title || 'System Alert', ...options }),
    warning: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'warning', message, title: options?.title || 'Attention Needed', ...options }),
    info: (message: string, options?: { title?: string; action?: NotificationAction; duration?: number }) =>
      showNotification({ type: 'info', message, title: options?.title || 'Notification', ...options }),
  };

  const getTypeIcon = (type: NotificationType) => {
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

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, dismissNotification, notify }}>
      {children}

      {/* Native Desktop Banner Container (Top-Right macOS / Windows Style HUD) */}
      <div 
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col space-y-3 w-88 max-w-[calc(100vw-32px)] pointer-events-none select-none"
      >
        {notifications.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto rounded-2xl border p-3.5 shadow-2xl backdrop-blur-2xl flex flex-col space-y-2.5 transition-all animate-in slide-in-from-top-3 fade-in duration-200 ${
              isDark 
                ? 'bg-[#16171D]/90 border-white/[0.08] shadow-black/60 text-white' 
                : 'bg-white/90 border-slate-200/80 shadow-slate-400/25 text-slate-900'
            }`}
          >
            {/* Desktop Notification Header (App Icon + Name + Timestamp + Close) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Blueprint App Icon */}
                <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center shadow-xs">
                  <div className="w-1.5 h-1.5 border-[1.2px] border-white rounded-[0.5px] rotate-45" />
                </div>
                <span className={`text-[10px] font-bold tracking-wider uppercase font-mono ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Blueprint
                </span>
                <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>•</span>
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {toast.timestamp}
                </span>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => dismissNotification(toast.id)}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isDark ? 'text-slate-500 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notification Body with Indicator & Message */}
            <div className="flex items-start space-x-2.5 pt-0.5">
              {getTypeIcon(toast.type)}

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="text-xs font-semibold leading-tight tracking-tight mb-0.5">
                    {toast.title}
                  </div>
                )}
                <div className={`text-xs leading-relaxed break-words ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {toast.message}
                </div>

                {/* Optional Action Button */}
                {toast.action && (
                  <div className="mt-2.5 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onClick();
                        dismissNotification(toast.id);
                      }}
                      className="text-xs font-medium px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-xs flex items-center space-x-1"
                    >
                      <span>{toast.action.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissNotification(toast.id)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        isDark 
                          ? 'border-[#2D3038] text-slate-300 hover:bg-white/[0.05]' 
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
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
