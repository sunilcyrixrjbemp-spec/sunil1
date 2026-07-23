interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export default function Loader({ message = "Loading...", fullPage = false }: LoaderProps) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          {message && (
            <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Inline / section loader
  return (
    <div className="w-full flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
      {message && (
        <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
          {message}
        </p>
      )}
    </div>
  );
}
