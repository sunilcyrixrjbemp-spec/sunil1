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
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f4f6] p-6 font-sans">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-gray-150 shadow-2xl space-y-6 text-center animate-scale-up">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-blue-50 border border-blue-100 text-blue-600 animate-bounce duration-1000">
                <RefreshCw className="w-8 h-8" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-base font-black text-slate-800 uppercase tracking-wider">
                {isDeploymentError ? "System Updating / सिस्टम अपडेट हो रहा है" : "Interface Recovery"}
              </h1>
              
              <div className="text-xs text-slate-600 font-bold leading-relaxed space-y-3">
                <p>
                  The site is currently under deployment as new updates are being rolled out. Just like a mobile app updates, this system is updating to the latest version.
                </p>
                <p className="border-t border-gray-100 pt-3 text-slate-500 font-semibold">
                  साइट अभी डिप्लॉयमेंट (under deployment) में है और नए अपडेट्स लाइव हो रहे हैं। जैसे मोबाइल ऐप अपडेट होता है, वैसे ही यह साइट भी अपडेट हो रही है। कृपया कुछ सेकंड प्रतीक्षा करें।
                </p>
              </div>
            </div>

            {this.state.error && !isDeploymentError && (
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg text-left text-[10px] font-mono text-red-700 max-h-32 overflow-y-auto no-scrollbar">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-blue-700 active:scale-95 transition-all shadow-md cursor-pointer border-0"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh & Use / रिफ्रेश करके उपयोग करें
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
