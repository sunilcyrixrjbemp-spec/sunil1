
interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export default function Loader({ message = "Loading Workspace...", fullPage = false }: LoaderProps) {
  const loaderGraphic = (
    <div className="relative flex items-center justify-center w-14 h-14">
      {/* UIverse Dual-Ring Pulse Orbit Loader */}
      <div className="absolute inset-0 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin [animation-duration:0.8s] [animation-direction:reverse]" />
      <div className="w-3 h-3 bg-indigo-600 rounded-full animate-ping" />
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-md flex items-center justify-center animate-fade-in">
        <div className="flex flex-col items-center gap-4 bg-white/95 p-8 rounded-2xl border border-white/60 shadow-2xl">
          {loaderGraphic}
          {message && (
            <p className="text-xs font-bold text-slate-700 tracking-wider uppercase">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center py-12 gap-4">
      {loaderGraphic}
      {message && (
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
          {message}
        </p>
      )}
    </div>
  );
}
