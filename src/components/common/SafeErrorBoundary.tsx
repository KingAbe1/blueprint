import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  /** Full-viewport centered card (app shell). Default keeps a compact in-panel fallback. */
  variant?: 'inline' | 'page';
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

  private handleRetry = () => {
    if (this.props.variant === 'page') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const panel = overviewPanelClass(isDark);
    const border = overviewBorderClass(isDark);
    const title = isDark ? 'text-slate-100' : 'text-slate-900';
    const muted = isDark ? 'text-slate-500' : 'text-slate-500';
    const heading = this.props.fallbackTitle || 'Unable to display this section';

    const card = (
      <div className={`overflow-hidden rounded-2xl border text-left ${panel}`}>
        <div className={`border-b px-5 py-4 sm:px-6 ${border}`}>
          <h2 className={`text-[15px] font-medium ${title}`}>{heading}</h2>
          <p className={`mt-1 text-[13px] leading-relaxed ${muted}`}>
            Something unexpected prevented this view from rendering. You can retry or refresh the page.
          </p>
        </div>
        {this.state.error?.message ? (
          <div className={`border-b px-5 py-3 sm:px-6 ${border}`}>
            <p className={`font-mono text-[11px] leading-relaxed break-all ${muted}`}>{this.state.error.message}</p>
          </div>
        ) : null}
        <div className="px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={this.handleRetry}
            className={
              isDark
                ? 'inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-400 hover:text-blue-300'
                : 'inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-800'
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {this.props.variant === 'page' ? 'Reload blueprint studio' : 'Try again'}
          </button>
        </div>
      </div>
    );

    if (this.props.variant === 'page') {
      return (
        <div
          className={`flex min-h-screen w-full items-center justify-center px-4 py-16 ${
            isDark ? 'bg-[#101113]' : 'bg-slate-50'
          }`}
        >
          <div className="w-full max-w-md">{card}</div>
        </div>
      );
    }

    return <div className="p-1">{card}</div>;
  }
}
