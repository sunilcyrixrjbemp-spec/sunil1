
interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export default function Loader({ message = "Processing...", fullPage = false }: LoaderProps) {
  const loaderStyle = `
    @keyframes pulseGradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes bounceDot {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes spinFancy {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .fancy-progress-bar {
      background: linear-gradient(-45deg, #3b82f6, #8b5cf6, #ec4899, #10b981);
      background-size: 400% 400%;
      animation: pulseGradient 4s ease infinite;
    }
    .bounce-dot-1 { animation: bounceDot 1.2s infinite ease-in-out; }
    .bounce-dot-2 { animation: bounceDot 1.2s infinite ease-in-out 0.2s; }
    .bounce-dot-3 { animation: bounceDot 1.2s infinite ease-in-out 0.4s; }
    
    .spinner-ring {
      border: 3px solid transparent;
      border-top-color: #3b82f6;
      border-right-color: #8b5cf6;
      animation: spinFancy 1s linear infinite;
    }
  `;

  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none">
      <style>{loaderStyle}</style>
      
      {/* Visual Animation Box */}
      <div className="relative flex items-center justify-center w-24 h-24 mb-4">
        {/* Outer rotating fancy gradient border */}
        <div className="absolute inset-0 rounded-full spinner-ring"></div>
        {/* Inner core with Cyrix logo */}
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-inner overflow-hidden">
          <img src="/brand.png" alt="Cyrix" className="w-10 h-10 object-contain" />
        </div>
      </div>

      {/* Bouncing Dot Indicator */}
      <div className="flex items-center gap-1.5 justify-center mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 bounce-dot-1"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-purple-600 bounce-dot-2"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-pink-500 bounce-dot-3"></div>
      </div>

      {message && (
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4 animate-pulse">
          {message}
        </span>
      )}

      {/* Pulsing Gradient Slim Bar */}
      <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mx-auto">
        <div className="h-full fancy-progress-bar rounded-full w-full"></div>
      </div>
      <p className="text-[10px] text-slate-400 mt-2 font-medium">Please wait, we are syncing with secure servers</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[9999] animate-fadeIn">
        <div className="bg-white border border-slate-200 rounded shadow-2xl p-6 flex flex-col items-center justify-center min-w-[280px] border-t-4 border-t-blue-600 animate-scaleIn">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
