import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
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
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by React ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#e9ecef] p-6 font-sans">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl space-y-6 text-center animate-scale-up">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-red-50 border border-red-100 text-red-500 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Interface Crash Recovered</h1>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                An unexpected component rendering exception was securely caught and isolated.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg text-left text-[10px] font-mono text-red-700 max-h-32 overflow-y-auto no-scrollbar">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-blue-700 active:scale-95 transition-all shadow-md"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
