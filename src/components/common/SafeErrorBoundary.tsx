import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SafeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('SafeErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-400 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{this.props.fallbackTitle || 'Unable to display this section'}</span>
            </div>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
          {this.state.error && (
            <p className="mt-1 text-[11px] text-slate-400 font-mono">
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
