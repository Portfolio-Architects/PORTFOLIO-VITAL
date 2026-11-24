'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-2xl border border-red-100/50 w-full min-h-[200px]">
          <div className="bg-red-50 text-red-500 p-3 rounded-full mb-3">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">
            {this.props.sectionName ? `${this.props.sectionName} 로드 실패` : '컴포넌트 로드 실패'}
          </h3>
          <p className="text-xs text-slate-500 text-center mb-4 max-w-[250px]">
            {this.state.error?.message || '화면 렌더링 오류 발생'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className="text-slate-400" />
            다시 로드
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
