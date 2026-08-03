import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

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
    
    // Auto-recover from chunk load errors / deployment changes
    const errorStr = String(error);
    if (errorStr.indexOf("Failed to fetch dynamically imported module") > -1 ||
        errorStr.indexOf("Importing a module script failed") > -1 ||
        errorStr.indexOf("ChunkLoadError") > -1) {
      
      console.warn("Chunk load error caught by ErrorBoundary. Auto-refreshing to fetch latest version...");
      const now = Date.now();
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      if (!lastReload || (now - parseInt(lastReload)) > 10000) {
        sessionStorage.setItem('last_chunk_reload', now.toString());
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorStr = String(this.state.error || "");
      const isDeploymentError = errorStr.indexOf("Failed to fetch dynamically imported module") > -1 ||
                                errorStr.indexOf("Importing a module script failed") > -1 ||
                                errorStr.indexOf("ChunkLoadError") > -1;

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50 p-6 font-sans">
          <div className="max-w-md w-full p-8 rounded-2xl bg-surface-0 border border-border shadow-lg space-y-6 text-center animate-scale-up">
            <div className="flex justify-center">
              <div className="p-3.5 rounded-full bg-accent-subtle border border-accent-100 text-accent-600">
                <RefreshCw className="w-7 h-7" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-ink-900">
                {isDeploymentError ? "System Updating" : "Interface Recovery"}
              </h1>
              
              <div className="text-xs text-ink-500 font-normal leading-relaxed space-y-2">
                <p>
                  The system is being updated with the latest application build. Please refresh to load the latest version.
                </p>
              </div>
            </div>

            {this.state.error && !isDeploymentError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-md text-left text-xs font-mono text-red-700 max-h-32 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-accent-600 text-white font-medium text-sm hover:bg-accent-700 active:scale-95 transition-all shadow-xs cursor-pointer border-0"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
